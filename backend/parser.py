"""
parser.py - Robust Timetable Extraction & Parsing Engine for BunkPredictor
Supports:
  1. Spatial 2D coordinate grid binning (word bounding boxes via PyMuPDF).
  2. Table structure extraction via PyMuPDF `find_tables()`.
  3. Spatial OCR word-box extraction via pytesseract image_to_data.
  4. Linear / section-based text fallback.
  5. Multi-batch lab splitting, day/time normalization, and confidence assessment.
"""

import io
import os
import re
import shutil
import logging
from typing import List, Dict, Any, Tuple, Optional
import pymupdf
from PIL import Image
import pytesseract

logger = logging.getLogger("bunkpredictor.parser")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(asctime)s - %(name)s: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Standard day normalization mapping
DAY_MAP = {
    "mon": "Monday",
    "monday": "Monday",
    "tue": "Tuesday",
    "tues": "Tuesday",
    "tuesday": "Tuesday",
    "wed": "Wednesday",
    "weds": "Wednesday",
    "wednesday": "Wednesday",
    "thu": "Thursday",
    "thur": "Thursday",
    "thurs": "Thursday",
    "thursday": "Thursday",
    "fri": "Friday",
    "friday": "Friday",
    "sat": "Saturday",
    "saturday": "Saturday",
    "sun": "Sunday",
    "sunday": "Sunday",
}

# Known college subjects dictionary
KNOWN_SUBJECTS = {
    "IOTA": "IoT & Automation",
    "FAI": "Foundations of AI",
    "MLE": "Machine Learning Essentials",
    "TOC": "Theory of Computation",
    "CS": "Cyber Security",
    "DC": "Distributed Computing",
    "BMC": "Business Models Canvas",
    "DBMS": "Database Management Systems",
    "OS": "Operating Systems",
    "CN": "Computer Networks",
    "DSA": "Data Structures & Algorithms",
    "AI": "Artificial Intelligence",
    "ML": "Machine Learning",
    "SE": "Software Engineering",
    "COA": "Computer Organization & Architecture",
    "DAA": "Design & Analysis of Algorithms",
    "WT": "Web Technology",
}

SUBJECT_NAME_TO_CODE = {
    "iot & automation": "IOTA",
    "iot and automation": "IOTA",
    "foundations of ai": "FAI",
    "machine learning essentials": "MLE",
    "theory of computation": "TOC",
    "cyber security": "CS",
    "distributed computing": "DC",
    "business models canvas": "BMC",
    "database management systems": "DBMS",
    "operating systems": "OS",
    "computer networks": "CN",
    "data structures & algorithms": "DSA",
    "artificial intelligence": "AI",
    "machine learning": "ML",
}

# Common non-subject tokens in cells (breaks, holidays, headers)
IGNORE_WORDS = {
    "RECESS", "BREAK", "LUNCH", "FREE", "NIL", "OFF", "VACANT",
    "HOLIDAY", "SPORTS", "LIBRARY", "MENTORING", "TIME", "DAY", "TOTAL"
}


def find_tesseract_binary() -> Optional[str]:
    """Detects if tesseract is in PATH or standard Windows installation directories."""
    which_path = shutil.which("tesseract")
    if which_path:
        return which_path

    common_windows_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    ]
    for p in common_windows_paths:
        if os.path.isfile(p):
            return p
    return None


def get_tesseract_status() -> Tuple[bool, str]:
    """Checks Tesseract availability and sets the command path if found."""
    bin_path = find_tesseract_binary()
    if bin_path:
        pytesseract.pytesseract.tesseract_cmd = bin_path
        return True, bin_path
    return False, (
        "Tesseract OCR is not installed or not found in system PATH. "
        "For scanned PDFs or image timetables, please install Tesseract OCR "
        "(e.g. from https://github.com/UB-Mannheim/tesseract/wiki) "
        "or upload a text-based PDF timetable."
    )


def normalize_day(day_str: str) -> Optional[str]:
    """Normalizes raw day strings (e.g. 'mon', 'THURSDAY', 'Wed.') into standard Title Case."""
    if not day_str:
        return None
    cleaned = re.sub(r"[^a-zA-Z]", "", day_str).lower()
    return DAY_MAP.get(cleaned)


def normalize_time(time_str: str, is_end_time: bool = False, ref_start_hour: Optional[int] = None) -> Optional[str]:
    """
    Converts various time string formats to standardized 24-hr HH:MM.
    Handles:
      - '09:00', '9:00', '9.00', '9'
      - '10:15 AM', '2:30 PM', '1:00'
      - Automatic rollover when end time like '1:00' follows start time '12:10' -> '13:00'
    """
    if not time_str:
        return None

    cleaned = time_str.strip().upper()
    is_pm = "PM" in cleaned
    is_am = "AM" in cleaned
    cleaned = re.sub(r"[^0-9:\.]", "", cleaned)
    cleaned = cleaned.replace(".", ":")

    if ":" in cleaned:
        parts = cleaned.split(":")
        try:
            hour = int(parts[0])
            minute = int(parts[1][:2])
        except (ValueError, IndexError):
            return None
    else:
        try:
            hour = int(cleaned)
            minute = 0
        except ValueError:
            return None

    if is_pm and hour < 12:
        hour += 12
    elif is_am and hour == 12:
        hour = 0
    elif not is_am and not is_pm:
        if 1 <= hour <= 7:
            hour += 12
        elif is_end_time and ref_start_hour and hour < ref_start_hour:
            if hour <= 12:
                hour += 12

    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return f"{hour:02d}:{minute:02d}"
    return None


def parse_time_range(raw_str: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Finds and parses start and end times in strings like:
    '10:10 AM - 11:00 AM', '09:00 to 10:00', '12:10-13:00', '11:30 - 1:30'
    """
    pattern = re.compile(
        r"(\b\d{1,2}(?:[:\.]\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\b\d{1,2}(?:[:\.]\d{2})?\s*(?:AM|PM)?)",
        re.IGNORECASE,
    )
    match = pattern.search(raw_str)
    if not match:
        return None, None

    start_raw = match.group(1).strip()
    end_raw = match.group(2).strip()

    start_norm = normalize_time(start_raw)
    ref_hour = None
    if start_norm:
        try:
            ref_hour = int(start_norm.split(":")[0])
        except ValueError:
            pass

    end_norm = normalize_time(end_raw, is_end_time=True, ref_start_hour=ref_hour)
    return start_norm, end_norm


def extract_session_type(text: str) -> str:
    """Infers session type: 'Lab', 'Practical/Programming', or 'Theory'."""
    lower = text.lower()
    if "lab" in lower:
        return "Lab"
    if "practical" in lower or "programming" in lower or re.search(r"\bpr\b", lower):
        return "Practical/Programming"
    return "Theory"


def extract_faculty(text: str) -> str:
    """Matches faculty designations (Dr. ..., Prof. ..., or initials like '(AR)', 'PRG')."""
    prof_match = re.search(r"\b((?:Dr\.|Prof\.)\s+[A-Z][a-zA-Z\.\s]+)", text)
    if prof_match:
        cleaned = prof_match.group(1).strip()
        cleaned = re.split(
            r"[,|\n\(\)\-\]:]|\b(?:Room|Lab|Batch|Theory|Practical|Programming|Hall|CR|LH)\b",
            cleaned,
            flags=re.IGNORECASE,
        )[0].strip()
        words = cleaned.split()
        if 1 <= len(words) <= 4:
            return cleaned

    # Matches initials in parentheses like (AR), (SM), [KV]
    initials_match = re.search(r"[\(\[]([A-Z]{2,4})[\)\]]", text)
    if initials_match:
        return initials_match.group(1).strip()

    # Matches standalone 2-3 uppercase initials like PRG, HRC, VC, DP, AR, KH
    faculty_codes = {"PRG", "KH", "AR", "HRC", "DP", "VC", "GS", "JS"}
    for word in re.findall(r"\b[A-Z]{2,4}\b", text):
        if word in faculty_codes:
            return word

    return ""


def extract_room(text: str) -> str:
    """Attempts to match room or lab location."""
    room_patterns = [
        r"\b([A-Za-z0-9]+\s+Lab(?:\s+[A-Za-z0-9\-]+)?)\b",
        r"\b((?:Room|LH|CR|Hall|Room\s*No\.?)\s*#?\s*[A-Za-z0-9\-]+)\b",
        r"\b(Lab\s*#?\s*[A-Za-z0-9\-]+)\b",
    ]
    for pat in room_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def extract_batch(text: str) -> str:
    """Extracts lab batch identifiers like 'Batch B1', 'Batch 2', 'B1'."""
    batch_match = re.search(r"\b(Batch\s*[A-Z0-9]+)\b", text, re.IGNORECASE)
    if batch_match:
        return batch_match.group(1).title()

    b_match = re.search(r"\b([B|G][1-4])\b", text)
    if b_match:
        return f"Batch {b_match.group(1).upper()}"
    return ""


def extract_subject_info(text: str) -> Tuple[str, str, bool]:
    """
    Identifies subject code, subject name, and confidence flag from text.
    Uses known full names, known subject codes, course code regex, or fallback words.
    Returns: (subject_code, subject_name, is_confident)
    """
    lower = text.lower()
    # 1. Match full name first
    for full_name, code in SUBJECT_NAME_TO_CODE.items():
        if full_name in lower:
            return code, KNOWN_SUBJECTS[code], True

    # 2. Match known codes directly
    for code, full_name in KNOWN_SUBJECTS.items():
        if re.search(rf"\b{code}\b", text, re.IGNORECASE):
            return code, full_name, True

    # 3. Look for standard course codes like 'CS301', 'IT402'
    code_match = re.search(r"\b([A-Z]{2,5}(?:[0-9]{2,4})?)\b", text)
    if code_match:
        cand_code = code_match.group(1).upper()
        blacklist = {"ROOM", "BATCH", "LAB", "THEORY", "TIME", "DAY", "MON", "TUE", "WED", "THU", "FRI", "SAT"}
        if cand_code not in blacklist:
            name = KNOWN_SUBJECTS.get(cand_code, cand_code)
            return cand_code, name, True

    # 4. Fallback: extract first capitalized words (excluding common non-subject words)
    words = [w for w in text.split() if w.isalpha() and len(w) > 2 and w.upper() not in IGNORE_WORDS]
    if words:
        cand = " ".join(words[:3])
        return cand[:4].upper(), cand, False

    return "", "", False


def parse_cell_content(cell_text: str, day: str, default_start: str, default_end: str) -> List[Dict[str, Any]]:
    """
    Parses the text of a single timetable cell.
    Handles:
      - Single class lecture
      - Embedded custom time range (e.g. 2-period lab 11:30 - 13:30)
      - Parallel lab batches (e.g. 'B1: MLE / B2: TOC / B3: DC')
    """
    cleaned_cell = cell_text.strip()
    if not cleaned_cell:
        return []

    # Check for ignore / free tokens (Recess, Lunch, Break, Free)
    words_upper = [w.upper() for w in re.findall(r"[A-Za-z]+", cleaned_cell)]
    if any(w in {"RECESS", "BREAK", "LUNCH", "HOLIDAY", "FREE", "NIL", "OFF", "VACANT"} for w in words_upper):
        return []

    # Check if cell overrides timing
    st, et = parse_time_range(cleaned_cell)
    start_time = st or default_start
    end_time = et or default_end

    # Check for parallel lab batch groups (e.g. lines with 'B1', 'B2', 'B3')
    batch_lines = re.split(r"[\n/|]+", cleaned_cell)
    # Check if multiple lines contain distinct batches
    detected_batches = [line.strip() for line in batch_lines if re.search(r"\b(?:Batch\s*)?[B|G][1-4]\b", line, re.IGNORECASE)]

    if len(detected_batches) >= 2:
        batch_entries = []
        for bline in detected_batches:
            sub_code, sub_name, is_conf = extract_subject_info(bline)
            if not sub_code:
                # Inherit from overall cell if available
                sub_code, sub_name, is_conf = extract_subject_info(cleaned_cell)
            if sub_code:
                batch_entries.append({
                    "day": day,
                    "start_time": start_time,
                    "end_time": end_time,
                    "subject_name": sub_name or sub_code,
                    "subject_code": sub_code,
                    "session_type": extract_session_type(bline) or "Lab",
                    "faculty": extract_faculty(bline) or extract_faculty(cleaned_cell),
                    "room": extract_room(bline) or extract_room(cleaned_cell),
                    "lab_batch": extract_batch(bline),
                    "needs_review": not is_conf,
                })
        if batch_entries:
            return batch_entries

    # Standard single entry
    sub_code, sub_name, is_confident = extract_subject_info(cleaned_cell)
    session_type = extract_session_type(cleaned_cell)
    faculty = extract_faculty(cleaned_cell)
    room = extract_room(cleaned_cell)
    batch = extract_batch(cleaned_cell)

    if not sub_code:
        # Check if cell contains meaningful text that might be a subject
        words = [w for w in cleaned_cell.split() if w.upper() not in IGNORE_WORDS and not re.match(r"^[\d:\.\-\(\)]+$", w)]
        if words and len(" ".join(words)) > 2:
            sub_name = " ".join(words[:4])
            sub_code = sub_name[:4].upper()
            needs_review = True
        else:
            return []
    else:
        needs_review = not is_confident

    return [{
        "day": day,
        "start_time": start_time,
        "end_time": end_time,
        "subject_name": sub_name,
        "subject_code": sub_code,
        "session_type": session_type,
        "faculty": faculty,
        "room": room,
        "lab_batch": batch,
        "needs_review": needs_review,
    }]


# ---------------------------------------------------------------------------
# STRATEGY 1: Spatial 2D Coordinate Grid Extraction
# ---------------------------------------------------------------------------

def extract_spatial_grid_from_words(words: List[Tuple[float, float, float, float, str]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Groups words into timetable cells using their 2D bounding box coordinates.
    Works for both PyMuPDF words and Tesseract OCR words.
    """
    entries: List[Dict[str, Any]] = []
    warnings: List[str] = []

    if not words:
        return entries, warnings

    # 1. Identify Day header candidates
    day_candidates = []
    for w in words:
        c = re.sub(r"[^a-zA-Z]", "", w[4]).lower()
        if c in DAY_MAP:
            day_candidates.append({
                "day": DAY_MAP[c],
                "x0": w[0],
                "y0": w[1],
                "x1": w[2],
                "y1": w[3],
                "xc": (w[0] + w[2]) / 2,
                "yc": (w[1] + w[3]) / 2,
            })

    # Deduplicate day items that refer to the same day in similar position
    unique_day_items = []
    for d in day_candidates:
        if not any(u["day"] == d["day"] and abs(u["xc"] - d["xc"]) < 30 and abs(u["yc"] - d["yc"]) < 30 for u in unique_day_items):
            unique_day_items.append(d)

    # 2. Identify Time slot candidates
    time_candidates = []

    # Reconstruct lines of words on similar Y coordinates, then cluster by horizontal proximity
    sorted_words = sorted(words, key=lambda w: (round(w[1] / 6) * 6, w[0]))
    lines_by_pos: List[List[Any]] = []
    current_line: List[Any] = []
    for w in sorted_words:
        if not current_line:
            current_line.append(w)
        elif abs(w[1] - current_line[0][1]) < 6:
            current_line.append(w)
        else:
            lines_by_pos.append(current_line)
            current_line = [w]
    if current_line:
        lines_by_pos.append(current_line)

    for line_w in lines_by_pos:
        # Cluster words into phrases separated by horizontal gap >= 20px
        line_w_sorted = sorted(line_w, key=lambda w: w[0])
        clusters: List[List[Any]] = []
        cur_cluster: List[Any] = []
        for w in line_w_sorted:
            if not cur_cluster:
                cur_cluster.append(w)
            elif (w[0] - cur_cluster[-1][2]) < 20:
                cur_cluster.append(w)
            else:
                clusters.append(cur_cluster)
                cur_cluster = [w]
        if cur_cluster:
            clusters.append(cur_cluster)

        for cluster in clusters:
            cluster_text = " ".join(w[4] for w in cluster)
            st, et = parse_time_range(cluster_text)
            if st and et:
                lx0 = min(w[0] for w in cluster)
                ly0 = min(w[1] for w in cluster)
                lx1 = max(w[2] for w in cluster)
                ly1 = max(w[3] for w in cluster)
                time_candidates.append({
                    "start": st,
                    "end": et,
                    "x0": lx0,
                    "y0": ly0,
                    "x1": lx1,
                    "y1": ly1,
                    "xc": (lx0 + lx1) / 2,
                    "yc": (ly0 + ly1) / 2,
                })

    # Deduplicate time items
    unique_time_items = []
    for t in time_candidates:
        if not any(u["start"] == t["start"] and abs(u["yc"] - t["yc"]) < 15 and abs(u["xc"] - t["xc"]) < 30 for u in unique_time_items):
            unique_time_items.append(t)

    logger.info(
        "Spatial grid detection: found %d day headings and %d time slots",
        len(unique_day_items),
        len(unique_time_items),
    )
    if unique_day_items:
        logger.info(
            "Detected day headings: %s",
            [f"{d['day']}(x={d['xc']:.1f},y={d['yc']:.1f})" for d in unique_day_items],
        )
    if unique_time_items:
        logger.info(
            "Detected time slots: %s",
            [f"{t['start']}-{t['end']}(x={t['xc']:.1f},y={t['yc']:.1f})" for t in unique_time_items],
        )

    if len(unique_day_items) < 2 or len(unique_time_items) < 2:
        return entries, warnings

    # Determine layout orientation:
    # Are Days columns or rows?
    dx_day_span = max(d["xc"] for d in unique_day_items) - min(d["xc"] for d in unique_day_items)
    dy_day_span = max(d["yc"] for d in unique_day_items) - min(d["yc"] for d in unique_day_items)

    days_are_columns = dx_day_span > dy_day_span

    if days_are_columns:
        # Columns = Days, Rows = Times
        cols = sorted(unique_day_items, key=lambda d: d["xc"])
        rows = sorted(unique_time_items, key=lambda t: t["yc"])

        col_bounds = [(cols[i]["xc"] + cols[i + 1]["xc"]) / 2 for i in range(len(cols) - 1)]
        row_bounds = [(rows[i]["yc"] + rows[i + 1]["yc"]) / 2 for i in range(len(rows) - 1)]

        header_bottom_y = max(d["y1"] for d in unique_day_items)
        time_is_on_left = max(t["xc"] for t in unique_time_items) < max(d["xc"] for d in unique_day_items)
        time_col_bound_x = max(t["x1"] for t in unique_time_items) if time_is_on_left else min(t["x0"] for t in unique_time_items)

        cell_bins: Dict[Tuple[str, Tuple[str, str]], List[Tuple[float, float, str]]] = {}

        for w in words:
            xc, yc = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            # Skip words in day header row
            if yc <= header_bottom_y + 2:
                continue
            # Skip words in time header column
            if time_is_on_left and xc <= time_col_bound_x + 2:
                continue
            elif not time_is_on_left and xc >= time_col_bound_x - 2:
                continue

            # Find matching column (Day)
            c_idx = 0
            while c_idx < len(col_bounds) and xc > col_bounds[c_idx]:
                c_idx += 1
            if c_idx >= len(cols):
                continue
            day = cols[c_idx]["day"]

            # Find matching row (Time slot)
            r_idx = 0
            while r_idx < len(row_bounds) and yc > row_bounds[r_idx]:
                r_idx += 1
            if r_idx >= len(rows):
                continue
            time_slot = (rows[r_idx]["start"], rows[r_idx]["end"])

            cell_bins.setdefault((day, time_slot), []).append((yc, xc, w[4]))

        # Parse contents of each cell
        for (day, (start_time, end_time)), word_list in cell_bins.items():
            # Sort words inside cell top-to-bottom, left-to-right
            word_list.sort(key=lambda item: (round(item[0] / 8) * 8, item[1]))
            cell_text = " ".join([item[2] for item in word_list])

            parsed_items = parse_cell_content(cell_text, day, start_time, end_time)
            entries.extend(parsed_items)

    else:
        # Layout B: Rows = Days, Columns = Times
        rows = sorted(unique_day_items, key=lambda d: d["yc"])
        cols = sorted(unique_time_items, key=lambda t: t["xc"])

        row_bounds = [(rows[i]["yc"] + rows[i + 1]["yc"]) / 2 for i in range(len(rows) - 1)]
        col_bounds = [(cols[i]["xc"] + cols[i + 1]["xc"]) / 2 for i in range(len(cols) - 1)]

        day_col_right_x = max(d["x1"] for d in unique_day_items)
        time_header_bottom_y = max(t["y1"] for t in unique_time_items)

        cell_bins = {}

        for w in words:
            xc, yc = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            if xc <= day_col_right_x + 2 or yc <= time_header_bottom_y + 2:
                continue

            r_idx = 0
            while r_idx < len(row_bounds) and yc > row_bounds[r_idx]:
                r_idx += 1
            if r_idx >= len(rows):
                continue
            day = rows[r_idx]["day"]

            c_idx = 0
            while c_idx < len(col_bounds) and xc > col_bounds[c_idx]:
                c_idx += 1
            if c_idx >= len(cols):
                continue
            time_slot = (cols[c_idx]["start"], cols[c_idx]["end"])

            cell_bins.setdefault((day, time_slot), []).append((yc, xc, w[4]))

        for (day, (start_time, end_time)), word_list in cell_bins.items():
            word_list.sort(key=lambda item: (round(item[0] / 8) * 8, item[1]))
            cell_text = " ".join([item[2] for item in word_list])
            parsed_items = parse_cell_content(cell_text, day, start_time, end_time)
            entries.extend(parsed_items)

    logger.info("Spatial grid extraction generated %d timetable entries", len(entries))
    return entries, warnings


# ---------------------------------------------------------------------------
# STRATEGY 2: Table Matrix Extraction via PyMuPDF find_tables()
# ---------------------------------------------------------------------------

def extract_from_pdf_tables(doc: pymupdf.Document) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Uses PyMuPDF's built-in table finder to extract structured table grids."""
    entries: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for page_idx, page in enumerate(doc):
        tabs = page.find_tables()
        if not tabs or not tabs.tables:
            continue

        for tab in tabs.tables:
            matrix = tab.extract()
            if not matrix or len(matrix) < 2:
                continue

            header_row = [str(c or "").strip() for c in matrix[0]]
            col_days = [normalize_day(c) for c in header_row]

            # Check if Days are columns
            if sum(1 for d in col_days if d is not None) >= 3:
                # Header row contains Days!
                for row in matrix[1:]:
                    if not row:
                        continue
                    row_time_str = " ".join([str(c or "") for c in row[:2]])
                    st, et = parse_time_range(row_time_str)
                    if not st or not et:
                        continue

                    for col_idx, day_name in enumerate(col_days):
                        if not day_name or col_idx >= len(row):
                            continue
                        cell_text = str(row[col_idx] or "").strip()
                        parsed = parse_cell_content(cell_text, day_name, st, et)
                        entries.extend(parsed)

            # Check if Days are row labels in Column 0
            first_col_days = [normalize_day(str(row[0] or "").strip()) for row in matrix]
            if sum(1 for d in first_col_days if d is not None) >= 3:
                # Row 0 contains Time headers
                time_headers = [parse_time_range(str(c or "")) for c in header_row]
                for r_idx, day_name in enumerate(first_col_days):
                    if not day_name or r_idx >= len(matrix):
                        continue
                    row = matrix[r_idx]
                    for c_idx, (st, et) in enumerate(time_headers):
                        if not st or not et or c_idx >= len(row):
                            continue
                        cell_text = str(row[c_idx] or "").strip()
                        parsed = parse_cell_content(cell_text, day_name, st, et)
                        entries.extend(parsed)

    logger.info("PDF find_tables extraction generated %d timetable entries", len(entries))
    return entries, warnings


# ---------------------------------------------------------------------------
# STRATEGY 3: Linear / Section-Based Text Parsing Fallback
# ---------------------------------------------------------------------------

def parse_linear_timetable_text(raw_text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Robust fallback parser for plain text / linear schedule listings.
    Correctly handles separate day/time lines and avoids getting stuck on Friday.
    """
    entries: List[Dict[str, Any]] = []
    warnings: List[str] = []

    if not raw_text or not raw_text.strip():
        return entries, warnings

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    current_day: Optional[str] = None
    i = 0

    while i < len(lines):
        line = lines[i]

        # 1. Check if line is a single Day heading (e.g. 'Monday', 'Monday:')
        words_in_line = re.findall(r"[a-zA-Z]+", line)
        detected_days = [DAY_MAP[w.lower()] for w in words_in_line if w.lower() in DAY_MAP]

        if len(detected_days) == 1 and len(words_in_line) <= 3:
            # Single day heading!
            current_day = detected_days[0]
            i += 1
            continue
        elif len(detected_days) > 1:
            # Multi-day header line like "Time Mon Tue Wed Thu Fri" -> do NOT set current_day!
            i += 1
            continue

        # 2. Check for time range on this line
        st, et = parse_time_range(line)
        if st and et:
            # Collect surrounding text (this line + following lines until next time or day)
            block_lines = [line]
            j = i + 1
            while j < len(lines):
                next_line = lines[j]
                next_words = re.findall(r"[a-zA-Z]+", next_line)
                next_days = [DAY_MAP[w.lower()] for w in next_words if w.lower() in DAY_MAP]
                next_st, next_et = parse_time_range(next_line)
                if next_days or (next_st and next_et):
                    break
                block_lines.append(next_line)
                j += 1
                if len(block_lines) >= 4:
                    break

            block_text = " ".join(block_lines)
            day_to_use = current_day or (detected_days[0] if detected_days else None)

            if day_to_use:
                parsed = parse_cell_content(block_text, day_to_use, st, et)
                entries.extend(parsed)
            else:
                # Missing day, flag for review
                sub_code, sub_name, _ = extract_subject_info(block_text)
                if sub_code:
                    entries.append({
                        "day": "Monday",
                        "start_time": st,
                        "end_time": et,
                        "subject_name": sub_name,
                        "subject_code": sub_code,
                        "session_type": extract_session_type(block_text),
                        "faculty": extract_faculty(block_text),
                        "room": extract_room(block_text),
                        "lab_batch": extract_batch(block_text),
                        "needs_review": True,
                    })
                    warnings.append(f"Uncertain day for slot {st}–{et} ({sub_code}); defaulted to Monday.")
            i = j
            continue

        i += 1

    logger.info("Linear timetable parsing generated %d entries", len(entries))
    return entries, warnings


parse_timetable_text = parse_linear_timetable_text


# ---------------------------------------------------------------------------
# MAIN EXTRACTION WORKFLOWS
# ---------------------------------------------------------------------------

def deduplicate_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates entries by day, start_time, end_time, and subject_code."""
    unique = []
    seen = set()
    for e in entries:
        # Standardize empty strings
        e["faculty"] = e.get("faculty") or ""
        e["room"] = e.get("room") or ""
        e["lab_batch"] = e.get("lab_batch") or ""
        e["needs_review"] = bool(e.get("needs_review", False))

        key = (e["day"], e["start_time"], e["end_time"], e["subject_code"], e["lab_batch"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique


def extract_from_pdf(file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]], List[str], str]:
    """
    Extracts timetable from PDF file bytes using:
      1. Spatial 2D Coordinate Grid Binning (PyMuPDF words)
      2. PyMuPDF find_tables() table detection
      3. Linear text fallback
      4. Tesseract OCR for scanned/image PDFs
    """
    warnings: List[str] = []

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Failed to open PDF document: {str(e)}")

    if len(doc) == 0:
        raise ValueError("PDF document contains no pages.")

    max_pages = min(len(doc), 10)
    total_text = ""
    all_words = []

    for i in range(max_pages):
        page = doc[i]
        total_text += page.get_text("text") or ""
        words = page.get_text("words") or []
        all_words.extend(words)

    logger.info("PDF extraction: scanned %d pages, %d words, %d text characters", max_pages, len(all_words), len(total_text))

    # Check if scanned PDF (< 40 characters across document)
    if len(total_text.strip()) < 40:
        is_tess_avail, tess_msg = get_tesseract_status()
        if not is_tess_avail:
            warnings.append("PDF contains scanned images with no embedded text. " + tess_msg)
            return "", [], warnings, "pdf_scanned_no_ocr"

        logger.info("Scanned PDF detected. Invoking PyMuPDF rendering + Tesseract OCR...")
        method = "pdf_scanned_ocr"
        ocr_words = []
        for i in range(max_pages):
            page = doc[i]
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            try:
                ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                for k in range(len(ocr_data["text"])):
                    txt = ocr_data["text"][k].strip()
                    conf = int(ocr_data["conf"][k]) if str(ocr_data["conf"][k]).isdigit() else -1
                    if txt and conf > 20:
                        x0 = ocr_data["left"][k]
                        y0 = ocr_data["top"][k]
                        x1 = x0 + ocr_data["width"][k]
                        y1 = y0 + ocr_data["height"][k]
                        ocr_words.append((x0, y0, x1, y1, txt))
            except Exception as ocr_err:
                logger.warning("OCR failed on page %d: %s", i + 1, ocr_err)

        entries, spatial_warn = extract_spatial_grid_from_words(ocr_words)
        warnings.extend(spatial_warn)
        if entries:
            return total_text, deduplicate_entries(entries), warnings, method

        # Fallback to OCR text
        ocr_full_text = ""
        for i in range(max_pages):
            pix = doc[i].get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            ocr_full_text += pytesseract.image_to_string(img) + "\n"
        entries, lin_warn = parse_linear_timetable_text(ocr_full_text)
        warnings.extend(lin_warn)
        return ocr_full_text, deduplicate_entries(entries), warnings, method

    # Digital PDF: Try Spatial 2D Grid Binning
    spatial_entries, spatial_warn = extract_spatial_grid_from_words(all_words)
    warnings.extend(spatial_warn)
    if len(spatial_entries) >= 2:
        logger.info("Using spatial 2D grid results (%d entries)", len(spatial_entries))
        return total_text, deduplicate_entries(spatial_entries), warnings, "pdf_spatial_grid"

    # Try PyMuPDF find_tables
    table_entries, table_warn = extract_from_pdf_tables(doc)
    warnings.extend(table_warn)
    if len(table_entries) >= 2:
        logger.info("Using PyMuPDF find_tables results (%d entries)", len(table_entries))
        return total_text, deduplicate_entries(table_entries), warnings, "pdf_table_detection"

    # Fallback to linear text parsing
    linear_entries, lin_warn = parse_linear_timetable_text(total_text)
    warnings.extend(lin_warn)
    logger.info("Using linear text parsing fallback (%d entries)", len(linear_entries))
    return total_text, deduplicate_entries(linear_entries), warnings, "pdf_text_linear"


def extract_from_image(file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]], List[str], str]:
    """Extracts timetable from PNG, JPG, or JPEG images using Tesseract OCR with spatial coordinates."""
    warnings: List[str] = []
    is_tess_avail, tess_msg = get_tesseract_status()
    if not is_tess_avail:
        raise RuntimeError(tess_msg)

    try:
        image = Image.open(io.BytesIO(file_bytes))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to read image file: {str(e)}")

    logger.info("Image OCR extraction: processing %dx%d image", image.width, image.height)

    # 1. Extract words with bounding box coordinates
    ocr_words = []
    try:
        ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        for i in range(len(ocr_data["text"])):
            txt = ocr_data["text"][i].strip()
            conf = int(ocr_data["conf"][i]) if str(ocr_data["conf"][i]).isdigit() else -1
            if txt and conf > 20:
                x0 = ocr_data["left"][i]
                y0 = ocr_data["top"][i]
                x1 = x0 + ocr_data["width"][i]
                y1 = y0 + ocr_data["height"][i]
                ocr_words.append((x0, y0, x1, y1, txt))
    except Exception as e:
        raise RuntimeError(f"OCR processing failed: {str(e)}")

    # 2. Try spatial grid binning on OCR words
    entries, spatial_warn = extract_spatial_grid_from_words(ocr_words)
    warnings.extend(spatial_warn)
    if len(entries) >= 2:
        logger.info("Image OCR spatial grid extraction succeeded with %d entries", len(entries))
        return "", deduplicate_entries(entries), warnings, "ocr_spatial_grid"

    # 3. Fallback to full string OCR
    extracted_text = pytesseract.image_to_string(image)
    entries, lin_warn = parse_linear_timetable_text(extracted_text)
    warnings.extend(lin_warn)
    return extracted_text, deduplicate_entries(entries), warnings, "ocr_linear"
