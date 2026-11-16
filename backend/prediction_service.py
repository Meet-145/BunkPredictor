"""
prediction_service.py - ML Prediction Service for BunkPredictor
Integrates the trained Random Forest model (models/attendance_model.pkl)
and feature definitions (models/attendance_feature_columns.pkl).

Supports:
- Singleton model loading once at application startup
- Feature engineering for upcoming timetable lectures using genuine student attendance history
- Probabilistic prediction (predict_proba) for individual upcoming lectures
- Graceful handling and reporting of missing/unavailable features without fabrication
"""

import os
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple

import joblib
import pandas as pd
import numpy as np

logger = logging.getLogger("bunkpredictor.prediction_service")

# Resolve project base directory (parent of backend/ or current dir)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR) if os.path.basename(BACKEND_DIR) == "backend" else BACKEND_DIR

MODEL_PATH = os.path.join(BASE_DIR, "models", "attendance_model.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "models", "attendance_feature_columns.pkl")
STUDENTS_CSV_PATH = os.path.join(BASE_DIR, "data", "students.csv")

# Global singleton storage
_MODEL = None
_FEATURE_COLUMNS = None
_STUDENTS_CACHE: Dict[str, Dict[str, Any]] = {}
_IS_INITIALIZED = False


def load_prediction_model() -> bool:
    """
    Loads the trained model pipeline and feature columns once into memory.
    Avoids reloading pickle files on every HTTP request.
    """
    global _MODEL, _FEATURE_COLUMNS, _STUDENTS_CACHE, _IS_INITIALIZED

    if _IS_INITIALIZED and _MODEL is not None:
        return True

    try:
        if not os.path.exists(MODEL_PATH):
            logger.error(f"Model artifact not found at {MODEL_PATH}")
            return False

        if not os.path.exists(FEATURES_PATH):
            logger.error(f"Feature columns artifact not found at {FEATURES_PATH}")
            return False

        logger.info(f"Loading trained ML model from {MODEL_PATH}...")
        _MODEL = joblib.load(MODEL_PATH)

        logger.info(f"Loading feature column definitions from {FEATURES_PATH}...")
        _FEATURE_COLUMNS = joblib.load(FEATURES_PATH)

        # Cache students dataset if available for valid profile lookups
        if os.path.exists(STUDENTS_CSV_PATH):
            try:
                students_df = pd.read_csv(STUDENTS_CSV_PATH)
                for _, row in students_df.iterrows():
                    sid = str(row["student_id"]).strip()
                    _STUDENTS_CACHE[sid] = {
                        "student_id": sid,
                        "commute_time_minutes": float(row["commute_time_minutes"]) if pd.notna(row.get("commute_time_minutes")) else None,
                        "previous_semester_attendance_pct": float(row["previous_semester_attendance_pct"]) if pd.notna(row.get("previous_semester_attendance_pct")) else None,
                        "previous_cgpa_synthetic": float(row["previous_cgpa_synthetic"]) if pd.notna(row.get("previous_cgpa_synthetic")) else None,
                    }
                logger.info(f"Loaded {len(_STUDENTS_CACHE)} student profiles into cache.")
            except Exception as e:
                logger.warning(f"Could not load students cache: {e}")

        _IS_INITIALIZED = True
        logger.info("ML Prediction Engine initialized successfully.")
        return True

    except Exception as e:
        logger.error(f"Failed to load ML model: {e}", exc_info=True)
        return False


def get_model_status() -> Dict[str, Any]:
    """Returns metadata and health information about the loaded model."""
    loaded = _MODEL is not None and _FEATURE_COLUMNS is not None
    supports_proba = False
    classes = []
    pipeline_steps = []

    if loaded:
        supports_proba = hasattr(_MODEL, "predict_proba")
        if hasattr(_MODEL, "classes_"):
            classes = [int(c) for c in _MODEL.classes_]
        if hasattr(_MODEL, "named_steps"):
            pipeline_steps = list(_MODEL.named_steps.keys())

    return {
        "model_loaded": loaded,
        "model_name": "Random Forest Classifier (Supervised Pipeline)" if loaded else "Unavailable",
        "supports_predict_proba": supports_proba,
        "classes": classes,
        "classification_threshold": 60.0,
        "classification_rule": ">= 60.0% Attendance Probability -> Likely to Attend, < 60.0% -> Likely to Miss",
        "feature_count": len(_FEATURE_COLUMNS) if _FEATURE_COLUMNS else 0,
        "feature_columns": _FEATURE_COLUMNS if _FEATURE_COLUMNS else [],
        "pipeline_steps": pipeline_steps,
        "required_feature_categories": {
            "timetable": ["day", "time_slot", "subject_code", "session_type", "slot_number", "month", "week_of_semester", "is_friday", "is_late_lecture", "is_early_lecture", "is_lab", "is_practical"],
            "attendance_history": ["prior_attendance_rate", "prior_subject_attendance_rate"],
            "student_profile": ["commute_time_minutes", "previous_semester_attendance_pct", "previous_cgpa_synthetic"],
        },
        "model_purpose": "Individual upcoming lecture attendance prediction (binary classification: 0=Absent, 1=Present).",
        "notes": "Trained on individual student lecture attendance with supervised Random Forest classifier."
    }


def map_time_to_slot(start_time: str) -> int:
    """
    Maps timetable start time (e.g. '10:10', '09:00', '12:10') to slot number (1-9).
    Matches the slot numbering used during model training.
    """
    clean_time = str(start_time).strip().replace(" ", "")
    parts = clean_time.split(":")
    try:
        hour = int(parts[0])
    except (ValueError, IndexError):
        return 1

    if hour <= 9:
        return 1
    elif hour == 10:
        return 2
    elif hour == 11:
        return 3
    elif hour == 12:
        return 4
    elif hour == 13:
        return 5
    elif hour == 14:
        return 6
    elif hour == 15:
        return 7
    elif hour == 16:
        return 8
    else:
        return 9


def get_next_date_for_day(day_name: str, reference_date: Optional[date] = None) -> date:
    """Calculates the nearest upcoming date corresponding to a given day of the week."""
    if reference_date is None:
        reference_date = date.today()

    day_map = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    target_weekday = day_map.get(day_name.lower().strip(), 0)
    current_weekday = reference_date.weekday()

    days_ahead = target_weekday - current_weekday
    if days_ahead <= 0:  # Target day already occurred this week or is today
        days_ahead += 7

    return reference_date + timedelta(days=days_ahead)


def resolve_student_profile(
    student_id: Optional[str] = None,
    commute_time_minutes: Optional[float] = None,
    previous_semester_attendance_pct: Optional[float] = None,
    previous_cgpa_synthetic: Optional[float] = None,
) -> Tuple[Dict[str, Optional[float]], Optional[str]]:
    """
    Resolves genuine student demographic features from explicit input or cached student record.
    Returns (profile_dict, error_or_lookup_status).
    Does NOT fabricate missing features with arbitrary numbers.
    """
    resolved = {
        "commute_time_minutes": commute_time_minutes,
        "previous_semester_attendance_pct": previous_semester_attendance_pct,
        "previous_cgpa_synthetic": previous_cgpa_synthetic,
    }

    # If student_id is given, fill any missing fields from verified dataset
    if student_id and student_id.strip() in _STUDENTS_CACHE:
        cached = _STUDENTS_CACHE[student_id.strip()]
        if resolved["commute_time_minutes"] is None:
            resolved["commute_time_minutes"] = cached.get("commute_time_minutes")
        if resolved["previous_semester_attendance_pct"] is None:
            resolved["previous_semester_attendance_pct"] = cached.get("previous_semester_attendance_pct")
        if resolved["previous_cgpa_synthetic"] is None:
            resolved["previous_cgpa_synthetic"] = cached.get("previous_cgpa_synthetic")

    return resolved, None


def predict_single_lecture(
    lecture: Dict[str, Any],
    attendance_records: List[Dict[str, Any]],
    student_profile: Optional[Dict[str, Any]] = None,
    semester_start_date: Optional[str] = "2026-08-03",
    reference_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Predicts attendance for a single upcoming lecture.
    Verifies availability of all required features.
    If features are missing, gracefully returns status='unavailable' with the exact missing list.
    """
    if not _IS_INITIALIZED or _MODEL is None:
        load_prediction_model()
        if _MODEL is None:
            return {
                "status": "unavailable",
                "reason": "Model artifact could not be loaded into memory.",
                "missing_features": ["model_pipeline"],
                "subject_code": lecture.get("subject_code", ""),
                "subject_name": lecture.get("subject_name", ""),
                "date": None,
                "day": lecture.get("day", ""),
                "time_slot": f"{lecture.get('start_time', '')}-{lecture.get('end_time', '')}",
                "prediction": None,
                "attendance_probability": None,
                "absence_probability": None,
            }

    # 1. Resolve date and timing
    day_name = str(lecture.get("day", "Monday")).strip().capitalize()
    ref_d = datetime.strptime(reference_date, "%Y-%m-%d").date() if reference_date else date.today()

    if lecture.get("date"):
        try:
            lec_date = datetime.strptime(str(lecture["date"]).strip(), "%Y-%m-%d").date()
        except ValueError:
            lec_date = get_next_date_for_day(day_name, ref_d)
    else:
        lec_date = get_next_date_for_day(day_name, ref_d)

    start_time = str(lecture.get("start_time", "09:00")).strip()
    end_time = str(lecture.get("end_time", "10:00")).strip()
    time_slot = f"{start_time}-{end_time}"
    subject_code = str(lecture.get("subject_code", "")).strip().toUpperCase() if hasattr(str, "toUpperCase") else str(lecture.get("subject_code", "")).strip().upper()
    subject_name = str(lecture.get("subject_name", subject_code)).strip()
    session_type = str(lecture.get("session_type", "Theory")).strip()
    slot_number = lecture.get("slot_number") or map_time_to_slot(start_time)

    # 2. Semester calendar features
    try:
        sem_start = datetime.strptime(semester_start_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        sem_start = date(2026, 8, 3)

    month = lec_date.month
    week_of_semester = max(1, (lec_date - sem_start).days // 7 + 1)
    is_friday = 1 if day_name.lower() == "friday" else 0
    is_late_lecture = 1 if slot_number >= 8 else 0
    is_early_lecture = 1 if slot_number <= 2 else 0
    is_lab = 1 if session_type.lower() == "lab" else 0
    is_practical = 1 if "practical" in session_type.lower() else 0

    # 3. Attendance history features
    total_conducted = 0
    total_attended = 0
    subj_conducted = 0
    subj_attended = 0

    for rec in attendance_records:
        cond = int(rec.get("lectures_conducted", 0))
        att = int(rec.get("lectures_attended", 0))
        total_conducted += cond
        total_attended += att

        code = str(rec.get("subject_code", "")).strip().upper()
        name = str(rec.get("subject_name", "")).strip().upper()
        if (code and code == subject_code) or (name and name == subject_name.upper()):
            subj_conducted += cond
            subj_attended += att

    prior_rate = None
    prior_subj_rate = None

    if total_conducted > 0:
        prior_rate = round(total_attended / total_conducted, 4)
        if subj_conducted > 0:
            prior_subj_rate = round(subj_attended / subj_conducted, 4)
        else:
            # If subject has not yet been conducted, overall student attendance rate is the natural prior
            prior_subj_rate = prior_rate

    # 4. Student demographic profile features
    profile_input = student_profile or {}
    resolved_profile, _ = resolve_student_profile(
        student_id=profile_input.get("student_id"),
        commute_time_minutes=profile_input.get("commute_time_minutes"),
        previous_semester_attendance_pct=profile_input.get("previous_semester_attendance_pct"),
        previous_cgpa_synthetic=profile_input.get("previous_cgpa_synthetic"),
    )

    commute_time = resolved_profile["commute_time_minutes"]
    prev_sem_att = resolved_profile["previous_semester_attendance_pct"]
    prev_cgpa = resolved_profile["previous_cgpa_synthetic"]

    # If student has zero attendance history recorded yet, but previous semester attendance pct is provided,
    # during training the feature pipeline filled initial prior with previous_semester_attendance_pct / 100
    if prior_rate is None and prev_sem_att is not None:
        prior_rate = round(prev_sem_att / 100.0, 4)
        prior_subj_rate = prior_rate

    # 5. Check for missing/unavailable features strictly
    missing_features = []
    if commute_time is None:
        missing_features.append("commute_time_minutes")
    if prev_sem_att is None:
        missing_features.append("previous_semester_attendance_pct")
    if prev_cgpa is None:
        missing_features.append("previous_cgpa_synthetic")
    if prior_rate is None:
        missing_features.append("prior_attendance_rate")
    if prior_subj_rate is None:
        missing_features.append("prior_subject_attendance_rate")

    if missing_features:
        return {
            "status": "unavailable",
            "reason": (
                f"Missing required features: {', '.join(missing_features)}. "
                "The trained Random Forest model requires these genuine inputs. "
                "Inference cannot be performed without inserting arbitrary values."
            ),
            "missing_features": missing_features,
            "subject_code": subject_code,
            "subject_name": subject_name,
            "date": lec_date.isoformat(),
            "day": day_name,
            "start_time": start_time,
            "end_time": end_time,
            "time_slot": time_slot,
            "slot_number": slot_number,
            "session_type": session_type,
            "prediction": None,
            "attendance_probability": None,
            "absence_probability": None,
        }

    # 6. Build exact features DataFrame matching training column order
    raw_features = {
        "day": day_name,
        "time_slot": time_slot,
        "subject_code": subject_code,
        "session_type": session_type,
        "slot_number": int(slot_number),
        "month": int(month),
        "week_of_semester": int(week_of_semester),
        "is_friday": int(is_friday),
        "is_late_lecture": int(is_late_lecture),
        "is_early_lecture": int(is_early_lecture),
        "is_lab": int(is_lab),
        "is_practical": int(is_practical),
        "commute_time_minutes": float(commute_time),
        "previous_semester_attendance_pct": float(prev_sem_att),
        "previous_cgpa_synthetic": float(prev_cgpa),
        "prior_attendance_rate": float(prior_rate),
        "prior_subject_attendance_rate": float(prior_subj_rate),
    }

    try:
        features_df = pd.DataFrame([raw_features])
        features_df = features_df[_FEATURE_COLUMNS]

        # Model predict_proba outputs: [P(class=0 / Absent), P(class=1 / Present)]
        probabilities = _MODEL.predict_proba(features_df)[0]
        prob_absent = float(probabilities[0])
        prob_present = float(probabilities[1])

        # Standardize rounding so attendance_probability + absence_probability == 100.0% exactly:
        attendance_prob = round(prob_present * 100, 1)
        absence_prob = round(100.0 - attendance_prob, 1)

        # 60% probability threshold for classifying individual lecture predictions:
        # 1. If actual ML model's attendance probability >= 60%, display "Likely to Attend"
        # 2. If actual ML model's attendance probability < 60%, display "Likely to Miss"
        CLASSIFICATION_THRESHOLD = 60.0
        predicted_outcome = (
            "Likely to Attend" if attendance_prob >= CLASSIFICATION_THRESHOLD else "Likely to Miss"
        )

        diff = abs(attendance_prob - CLASSIFICATION_THRESHOLD)
        confidence = "High" if diff >= 20.0 else ("Moderate" if diff >= 8.0 else "Low")

        return {
            "status": "available",
            "subject_code": subject_code,
            "subject_name": subject_name,
            "date": lec_date.isoformat(),
            "day": day_name,
            "start_time": start_time,
            "end_time": end_time,
            "time_slot": time_slot,
            "slot_number": slot_number,
            "session_type": session_type,
            "predicted_outcome": predicted_outcome,
            "attendance_probability": attendance_prob,
            "absence_probability": absence_prob,
            "probability_present_raw": round(prob_present, 4),
            "probability_absent_raw": round(prob_absent, 4),
            "classification_threshold": CLASSIFICATION_THRESHOLD,
            "confidence": confidence,
            "features_used": raw_features,
            "disclaimer": "This is a statistical probability generated by the trained Random Forest model and is not a guaranteed outcome.",
        }

    except Exception as e:
        logger.error(f"Inference error for {subject_code}: {e}", exc_info=True)
        return {
            "status": "error",
            "reason": f"Model inference error: {str(e)}",
            "missing_features": [],
            "subject_code": subject_code,
            "subject_name": subject_name,
            "date": lec_date.isoformat(),
            "day": day_name,
            "start_time": start_time,
            "end_time": end_time,
            "time_slot": time_slot,
            "prediction": None,
            "attendance_probability": None,
            "absence_probability": None,
        }


def predict_upcoming_lectures(
    lectures: List[Dict[str, Any]],
    attendance_records: List[Dict[str, Any]],
    student_profile: Optional[Dict[str, Any]] = None,
    semester_start_date: Optional[str] = "2026-08-03",
    reference_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Batches upcoming lecture predictions and reports overall prediction status.
    """
    if not lectures:
        return {
            "success": True,
            "total_lectures": 0,
            "available_predictions_count": 0,
            "unavailable_predictions_count": 0,
            "predictions": [],
            "message": "No upcoming lectures provided in the request.",
        }

    results = []
    avail_count = 0
    unavail_count = 0

    for lec in lectures:
        pred = predict_single_lecture(
            lecture=lec,
            attendance_records=attendance_records,
            student_profile=student_profile,
            semester_start_date=semester_start_date,
            reference_date=reference_date,
        )
        if pred["status"] == "available":
            avail_count += 1
        else:
            unavail_count += 1
        results.append(pred)

    likely_to_attend_count = sum(1 for p in results if p.get("predicted_outcome") == "Likely to Attend")
    likely_to_miss_count = sum(1 for p in results if p.get("predicted_outcome") == "Likely to Miss")

    return {
        "success": True,
        "total_lectures": len(lectures),
        "available_predictions_count": avail_count,
        "unavailable_predictions_count": unavail_count,
        "likely_to_attend_count": likely_to_attend_count,
        "likely_to_miss_count": likely_to_miss_count,
        "classification_threshold": 60.0,
        "predictions": results,
    }

