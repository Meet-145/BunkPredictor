"""
test_parser.py - Comprehensive Tests for Timetable Parser and FastAPI Endpoints
Tests:
  1. Day and time normalization (AM/PM, 24-hr, end-time rollover).
  2. Field extractors (session type, faculty initials/names, room/lab, batches).
  3. Spatial 2D coordinate grid extraction for PDFs with days as columns.
  4. Linear / section-based extraction with days and times on separate lines.
  5. Multiple classes distributed across Monday through Friday.
  6. Multi-line subject names inside cells.
  7. Missing or unclear subject information handling (needs_review flag).
  8. Duplicate extraction prevention.
  9. FastAPI API endpoints (/health, invalid inputs, synthetic grid PDF extraction).
"""

import pytest
from fastapi.testclient import TestClient
import pymupdf

from parser import (
    normalize_day,
    normalize_time,
    parse_time_range,
    parse_timetable_text,
    parse_linear_timetable_text,
    parse_cell_content,
    extract_from_pdf,
    extract_session_type,
    extract_faculty,
    extract_room,
    extract_batch,
    extract_subject_info,
    deduplicate_entries,
)
from main import app

client = TestClient(app)


def create_grid_timetable_pdf() -> bytes:
    """Helper to generate a synthetic grid-based timetable PDF using PyMuPDF."""
    doc = pymupdf.open()
    page = doc.new_page(width=700, height=500)

    # Header Row (Days as Columns)
    page.insert_text((50, 60), "Time", fontsize=11)
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    col_x = [150, 250, 350, 450, 550]
    for d, x in zip(days, col_x):
        page.insert_text((x, 60), d, fontsize=11)

    # Row 1: 09:00 - 10:00 (Theory lectures)
    page.insert_text((50, 140), "09:00 - 10:00", fontsize=10)
    page.insert_text((150, 140), "IoTA\nRoom 402", fontsize=10)
    page.insert_text((250, 140), "FAI\nRoom 401", fontsize=10)
    page.insert_text((350, 140), "MLE\nAI Lab 1", fontsize=10)
    page.insert_text((450, 140), "TOC\nRoom 305", fontsize=10)
    page.insert_text((550, 140), "CS\nRoom 401", fontsize=10)

    # Row 2: 10:15 - 11:15 (Multi-line subject names)
    page.insert_text((50, 220), "10:15 - 11:15", fontsize=10)
    page.insert_text((150, 220), "Distributed\nComputing\nDC", fontsize=10)
    page.insert_text((250, 220), "Machine\nLearning\nMLE", fontsize=10)
    page.insert_text((350, 220), "Cyber\nSecurity\nCS", fontsize=10)
    page.insert_text((450, 220), "Business\nModels Canvas\nBMC", fontsize=10)
    page.insert_text((550, 220), "IoT &\nAutomation\nIOTA", fontsize=10)

    # Row 3: 11:30 - 13:30 (Labs and Free slots)
    page.insert_text((50, 300), "11:30 - 13:30", fontsize=10)
    page.insert_text((150, 300), "MLE Lab\nBatch B1\nAI Lab 1", fontsize=10)
    page.insert_text((250, 300), "IoTA Lab\nBatch B2\nIoT Lab 2", fontsize=10)
    page.insert_text((350, 300), "CS Practical\nBatch B1\nRoom 401", fontsize=10)
    page.insert_text((450, 300), "FREE", fontsize=10)
    page.insert_text((550, 300), "BMC Lab\nBatch B3\nRoom 202", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# --- Unit Tests: Normalization & Regex ---

def test_normalize_day():
    assert normalize_day("mon") == "Monday"
    assert normalize_day("Monday") == "Monday"
    assert normalize_day("TUE") == "Tuesday"
    assert normalize_day("Wednesday,") == "Wednesday"
    assert normalize_day("Thurs") == "Thursday"
    assert normalize_day("Friday") == "Friday"
    assert normalize_day("InvalidDay") is None
    assert normalize_day("") is None


def test_normalize_time():
    assert normalize_time("9:00") == "09:00"
    assert normalize_time("09:00") == "09:00"
    assert normalize_time("10:15 AM") == "10:15"
    assert normalize_time("2:30 PM") == "14:30"
    assert normalize_time("12:10") == "12:10"
    # Afternoon heuristic (1-7 without am/pm -> 13-19)
    assert normalize_time("1:00") == "13:00"
    assert normalize_time("3:15") == "15:15"
    # End time rollover with ref_start_hour: 12:10 start -> 1:00 end
    assert normalize_time("1:00", is_end_time=True, ref_start_hour=12) == "13:00"
    assert normalize_time("invalid") is None


def test_parse_time_range():
    st, et = parse_time_range("10:10 AM - 11:00 AM")
    assert st == "10:10"
    assert et == "11:00"

    st2, et2 = parse_time_range("09:00 to 10:00")
    assert st2 == "09:00"
    assert et2 == "10:00"

    st3, et3 = parse_time_range("12:10 - 1:00")
    assert st3 == "12:10"
    assert et3 == "13:00"

    st_none, et_none = parse_time_range("No timing here")
    assert st_none is None
    assert et_none is None


def test_field_extractors():
    assert extract_session_type("MLE Lab AI Lab 1") == "Lab"
    assert extract_session_type("CS Practical/Programming") == "Practical/Programming"
    assert extract_session_type("IoTA Regular Lecture") == "Theory"

    assert extract_faculty("MLE Dr. A. Kapoor Room 402") == "Dr. A. Kapoor"
    assert extract_faculty("TOC Prof. S. Raman") == "Prof. S. Raman"
    assert extract_faculty("MLE (AR)") == "AR"

    assert "Room 402" in extract_room("IoTA Room 402")
    assert "AI Lab 1" in extract_room("MLE AI Lab 1")

    assert "Batch B1" in extract_batch("MLE Lab Batch B1")
    assert "Batch B2" in extract_batch("IoTA Lab B2")


def test_subject_info_extractor():
    code, name, conf = extract_subject_info("Machine Learning Essentials")
    assert code == "MLE"
    assert name == "Machine Learning Essentials"
    assert conf is True

    code2, name2, conf2 = extract_subject_info("TOC - Theory of Computation")
    assert code2 == "TOC"
    assert conf2 is True

    # Unknown subject should fall back with conf=False
    code3, name3, conf3 = extract_subject_info("Advanced Robotics Elective")
    assert conf3 is False


# --- Parser Tests: Layout Scenarios ---

def test_days_as_columns_grid_pdf():
    """Tests spatial grid extraction from synthetic PDF with days as columns."""
    pdf_bytes = create_grid_timetable_pdf()
    _, entries, warnings, method = extract_from_pdf(pdf_bytes)

    assert method == "pdf_spatial_grid"
    assert len(entries) >= 12

    # Ensure entries are distributed across all 5 weekdays
    days_found = {e["day"] for e in entries}
    assert days_found == {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

    # Verify Monday entries
    mon_entries = [e for e in entries if e["day"] == "Monday"]
    assert len(mon_entries) == 3
    mon_codes = [e["subject_code"] for e in mon_entries]
    assert "IOTA" in mon_codes
    assert "DC" in mon_codes
    assert "MLE" in mon_codes

    # Verify Friday is NOT the only day with slots
    fri_entries = [e for e in entries if e["day"] == "Friday"]
    assert len(fri_entries) == 3
    assert len(fri_entries) < len(entries)


def test_days_and_times_separate_lines():
    """Tests linear parsing when days, times, and subject details are on separate lines."""
    sample_text = (
        "COLLEGE TIMETABLE\n\n"
        "Monday\n"
        "09:00 - 10:00\n"
        "IoT & Automation (IOTA)\n"
        "Prof. R. Mehta\n"
        "Room 402\n\n"
        "10:15 - 11:15\n"
        "Machine Learning Essentials (MLE)\n"
        "Dr. A. Kapoor\n"
        "Room 402\n\n"
        "Tuesday\n"
        "09:00 - 10:00\n"
        "Foundations of AI (FAI)\n"
        "Dr. S. Verma\n"
        "Room 401\n"
    )
    entries, warnings = parse_linear_timetable_text(sample_text)
    assert len(entries) == 3

    mon_entries = [e for e in entries if e["day"] == "Monday"]
    tue_entries = [e for e in entries if e["day"] == "Tuesday"]
    fri_entries = [e for e in entries if e["day"] == "Friday"]

    assert len(mon_entries) == 2
    assert len(tue_entries) == 1
    assert len(fri_entries) == 0

    assert mon_entries[0]["subject_code"] == "IOTA"
    assert mon_entries[0]["start_time"] == "09:00"
    assert mon_entries[1]["subject_code"] == "MLE"
    assert tue_entries[0]["subject_code"] == "FAI"


def test_multiline_subject_names():
    """Tests multi-line subject name parsing."""
    sample_text = (
        "Wednesday\n"
        "09:00 - 10:00\n"
        "Distributed\nComputing\nDC\nDr. N. Iyer\nRoom 303\n"
        "10:15 - 11:15\n"
        "Database Management\nSystems\nDBMS\nProf. K. Joshi\nRoom 401\n"
    )
    entries, warnings = parse_linear_timetable_text(sample_text)
    assert len(entries) == 2
    assert entries[0]["subject_code"] == "DC"
    assert "Distributed Computing" in entries[0]["subject_name"]
    assert entries[1]["subject_code"] == "DBMS"
    assert "Database Management Systems" in entries[1]["subject_name"]


def test_missing_or_unclear_subject_info():
    """Tests handling of cells with missing, unclear, or empty subject information."""
    # Blank or noise text
    entries, warnings = parse_linear_timetable_text("Random syllabus text without times")
    assert entries == []

    # Free / Break / Lunch cells should produce no entries
    free_cells = parse_cell_content("RECESS LUNCH BREAK", "Monday", "13:00", "14:00")
    assert free_cells == []

    # Unclear subject text should be marked with needs_review=True
    unclear = parse_cell_content("General Session Overview", "Monday", "09:00", "10:00")
    assert len(unclear) == 1
    assert unclear[0]["needs_review"] is True


def test_duplicate_extraction_prevention():
    """Tests deduplication of repeated OCR or text fragments."""
    raw_entries = [
        {
            "day": "Monday",
            "start_time": "09:00",
            "end_time": "10:00",
            "subject_name": "Machine Learning Essentials",
            "subject_code": "MLE",
            "session_type": "Theory",
            "faculty": "Dr. A. Kapoor",
            "room": "Room 402",
            "lab_batch": "",
            "needs_review": False,
        },
        # Duplicate entry
        {
            "day": "Monday",
            "start_time": "09:00",
            "end_time": "10:00",
            "subject_name": "Machine Learning Essentials",
            "subject_code": "MLE",
            "session_type": "Theory",
            "faculty": "Dr. A. Kapoor",
            "room": "Room 402",
            "lab_batch": "",
            "needs_review": False,
        },
    ]
    deduped = deduplicate_entries(raw_entries)
    assert len(deduped) == 1


# --- API Endpoint Integration Tests ---

def test_api_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data


def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "tesseract_available" in data


def test_api_invalid_file_format():
    response = client.post(
        "/api/timetable/extract",
        files={"file": ("test.txt", b"random content", "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_api_empty_file():
    response = client.post(
        "/api/timetable/extract",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_api_extract_synthetic_pdf():
    doc = pymupdf.open()
    page = doc.new_page()
    timetable_text = (
        "COLLEGE TIMETABLE\n"
        "Wednesday\n"
        "09:00 - 10:00 DC - Distributed Computing (Dr. N. Iyer) Room 303\n"
        "10:15 - 11:15 TOC - Theory of Computation Room 305\n"
        "11:30 - 12:30 MLE - Machine Learning Essentials Room 402\n"
    )
    page.insert_text((50, 50), timetable_text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()

    response = client.post(
        "/api/timetable/extract",
        files={"file": ("timetable.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filename"] == "timetable.pdf"
    assert len(data["entries"]) >= 3
    assert "pdf" in data["extraction_method"]

    first_entry = data["entries"][0]
    assert first_entry["day"] == "Wednesday"
    assert first_entry["start_time"] == "09:00"
    assert first_entry["end_time"] == "10:00"
    assert first_entry["subject_code"] == "DC"


def test_api_extract_grid_pdf():
    """Tests the full API pipeline with the synthetic grid PDF (days as columns)."""
    pdf_bytes = create_grid_timetable_pdf()
    response = client.post(
        "/api/timetable/extract",
        files={"file": ("grid_timetable.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filename"] == "grid_timetable.pdf"
    assert data["extraction_method"] == "pdf_spatial_grid"
    assert len(data["entries"]) >= 10

    # Ensure days are distributed across the week and not only Friday
    day_counts = {}
    for e in data["entries"]:
        day_counts[e["day"]] = day_counts.get(e["day"], 0) + 1

    assert day_counts.get("Monday", 0) >= 2
    assert day_counts.get("Tuesday", 0) >= 2
    assert day_counts.get("Wednesday", 0) >= 2
    assert day_counts.get("Thursday", 0) >= 2
    assert day_counts.get("Friday", 0) >= 2

    # Verify no unlabeled subjects
    for e in data["entries"]:
        assert e["subject_name"] != "Unlabeled Subject"
        assert e["subject_code"] != ""
        assert e["day"] in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
