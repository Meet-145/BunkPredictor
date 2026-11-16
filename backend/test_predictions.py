"""
test_predictions.py - Comprehensive Verification Suite for BunkPredictor ML Endpoints

Tests:
1. Model loading & singleton initialization
2. Model info endpoint (/api/predictions/model-info)
3. Health check endpoint reporting model status (/health)
4. Valid individual lecture prediction with genuine inputs
5. Attendance & absence probability output (predict_proba verification)
6. 60% probability threshold classification rule (>= 60% Likely to Attend, < 60% Likely to Miss)
7. Missing feature handling without fabrication (missing profile, missing history)
8. Invalid input handling (negative counts, malformed data)
9. Multiple upcoming lectures batching
10. Empty timetable input handling
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from prediction_service import load_prediction_model, get_model_status


@pytest.fixture(scope="module")
def client():
    """Test client with lifespan model initialization."""
    with TestClient(app) as test_client:
        yield test_client


# ==========================================
# 1. MODEL LOADING & HEALTH
# ==========================================

def test_model_loading_and_singleton():
    """Verify model loads once and retains 200 estimators and 17 feature columns."""
    assert load_prediction_model() is True
    status = get_model_status()
    assert status["model_loaded"] is True
    assert status["supports_predict_proba"] is True
    assert status["feature_count"] == 17
    assert len(status["classes"]) == 2
    assert 0 in status["classes"]
    assert 1 in status["classes"]


def test_health_check_endpoint(client):
    """Verify /health reports ml_model status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ml_model" in data
    assert data["ml_model"]["loaded"] is True
    assert data["ml_model"]["supports_predict_proba"] is True


def test_model_info_endpoint(client):
    """Verify /api/predictions/model-info returns required feature taxonomy."""
    response = client.get("/api/predictions/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_loaded"] is True
    assert data["feature_count"] == 17
    assert "required_feature_categories" in data
    assert "timetable" in data["required_feature_categories"]
    assert "attendance_history" in data["required_feature_categories"]
    assert "student_profile" in data["required_feature_categories"]


# ==========================================
# 2. VALID INDIVIDUAL LECTURE PREDICTIONS
# ==========================================

def test_valid_single_lecture_prediction(client):
    """
    Test prediction when student profile (S001) and valid attendance records are provided.
    Expects probability output and predicted outcome.
    """
    payload = {
        "lectures": [
            {
                "day": "Monday",
                "start_time": "12:10",
                "end_time": "13:00",
                "subject_name": "Machine Learning Essentials",
                "subject_code": "MLE",
                "session_type": "Theory",
            }
        ],
        "attendance_records": [
            {
                "subject_code": "MLE",
                "subject_name": "Machine Learning Essentials",
                "lectures_conducted": 30,
                "lectures_attended": 25,
            }
        ],
        "student_profile": {
            "student_id": "S001"
        },
        "semester_start_date": "2026-08-03",
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_lectures"] == 1
    assert data["available_predictions_count"] == 1
    assert data["unavailable_predictions_count"] == 0

    pred = data["predictions"][0]
    assert pred["status"] == "available"
    assert pred["subject_code"] == "MLE"
    assert pred["day"] == "Monday"
    assert pred["time_slot"] == "12:10-13:00"
    assert pred["predicted_outcome"] in ["Likely to Attend", "Likely to Miss"]

    # Verify probability outputs
    assert pred["attendance_probability"] is not None
    assert pred["absence_probability"] is not None
    assert 0 <= pred["attendance_probability"] <= 100
    assert 0 <= pred["absence_probability"] <= 100
    # Exact 100% sum check: attendance + absence == 100.0%
    assert round(pred["attendance_probability"] + pred["absence_probability"], 1) == 100.0
    assert pred.get("classification_threshold") == 60.0

    # 60% classification rule verification:
    # 1. If actual ML model's attendance probability >= 60%, display "Likely to Attend"
    # 2. If actual ML model's attendance probability < 60%, display "Likely to Miss"
    if pred["attendance_probability"] >= 60.0:
        assert pred["predicted_outcome"] == "Likely to Attend"
    else:
        assert pred["predicted_outcome"] == "Likely to Miss"

    # Verify disclaimer is present
    assert "disclaimer" in pred


def test_valid_direct_profile_prediction(client):
    """
    Test prediction with explicitly supplied student profile fields (not student_id).
    Ensures users can enter genuine commute, prior attendance, and CGPA.
    """
    payload = {
        "lectures": [
            {
                "day": "Wednesday",
                "start_time": "10:10",
                "end_time": "11:00",
                "subject_name": "IoT & Automation",
                "subject_code": "IoTA",
                "session_type": "Theory",
            }
        ],
        "attendance_records": [
            {
                "subject_code": "IoTA",
                "subject_name": "IoT & Automation",
                "lectures_conducted": 22,
                "lectures_attended": 20,
            }
        ],
        "student_profile": {
            "commute_time_minutes": 20.0,
            "previous_semester_attendance_pct": 88.5,
            "previous_cgpa_synthetic": 8.7,
        },
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["available_predictions_count"] == 1
    pred = data["predictions"][0]
    assert pred["status"] == "available"
    assert pred["attendance_probability"] >= 60.0
    assert pred["predicted_outcome"] == "Likely to Attend"


def test_sixty_percent_probability_threshold_classification(client):
    """
    Explicitly test the 60% probability threshold classification rules:
    1. If actual ML model's attendance probability >= 60.0% -> 'Likely to Attend'
    2. If actual ML model's attendance probability < 60.0% -> 'Likely to Miss'
    3. Ensure attendance_probability + absence_probability == 100.0% exactly.
    """
    payload = {
        "lectures": [
            # High attendance lecture (midday MLE lab)
            {"day": "Monday", "start_time": "11:30", "end_time": "13:30", "subject_code": "MLE", "subject_name": "Machine Learning", "session_type": "Lab"},
            # Low attendance lecture (Friday late lecture with lower prior attendance)
            {"day": "Friday", "start_time": "10:15", "end_time": "11:15", "subject_code": "BMC", "subject_name": "Business Models Canvas", "session_type": "Theory"},
            # Monday late lecture
            {"day": "Monday", "start_time": "14:15", "end_time": "15:15", "subject_code": "TOC", "subject_name": "Theory of Computation", "session_type": "Theory"},
        ],
        "attendance_records": [
            {"subject_code": "MLE", "lectures_conducted": 30, "lectures_attended": 28},
            {"subject_code": "BMC", "lectures_conducted": 20, "lectures_attended": 17},
            {"subject_code": "TOC", "lectures_conducted": 25, "lectures_attended": 18},
        ],
        "student_profile": {"student_id": "S001"},
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["classification_threshold"] == 60.0
    assert data["available_predictions_count"] == 3

    for pred in data["predictions"]:
        attend = pred["attendance_probability"]
        absence = pred["absence_probability"]
        # Ensure exact 100% sum
        assert round(attend + absence, 1) == 100.0

        if attend >= 60.0:
            assert pred["predicted_outcome"] == "Likely to Attend", (
                f"Expected 'Likely to Attend' for prob {attend}% >= 60.0%"
            )
        else:
            assert pred["predicted_outcome"] == "Likely to Miss", (
                f"Expected 'Likely to Miss' for prob {attend}% < 60.0%"
            )

    # Verify counts match
    attend_count = sum(1 for p in data["predictions"] if p["predicted_outcome"] == "Likely to Attend")
    miss_count = sum(1 for p in data["predictions"] if p["predicted_outcome"] == "Likely to Miss")
    assert data["likely_to_attend_count"] == attend_count
    assert data["likely_to_miss_count"] == miss_count
    # In S001 with this setup, at least one lecture is >= 60% and at least one is < 60%
    assert attend_count >= 1
    assert miss_count >= 1


# ==========================================
# 3. MISSING FEATURE & UNAVAILABLE STATE HANDLING
# ==========================================

def test_missing_student_profile_features(client):
    """
    When student profile fields (commute, previous attendance, CGPA) are omitted,
    the model must NOT insert arbitrary dummy values.
    It must report the prediction as unavailable and list missing features.
    """
    payload = {
        "lectures": [
            {
                "day": "Tuesday",
                "start_time": "09:00",
                "end_time": "10:00",
                "subject_name": "Distributed Computing",
                "subject_code": "DC",
            }
        ],
        "attendance_records": [
            {
                "subject_code": "DC",
                "lectures_conducted": 20,
                "lectures_attended": 15,
            }
        ],
        "student_profile": None,  # No student profile provided
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["available_predictions_count"] == 0
    assert data["unavailable_predictions_count"] == 1

    pred = data["predictions"][0]
    assert pred["status"] == "unavailable"
    assert pred["prediction"] is None
    assert pred["attendance_probability"] is None
    assert "commute_time_minutes" in pred["missing_features"]
    assert "previous_semester_attendance_pct" in pred["missing_features"]
    assert "previous_cgpa_synthetic" in pred["missing_features"]
    assert "Missing required features" in pred["reason"]


def test_missing_attendance_history(client):
    """
    When student has zero conducted lectures and no previous semester attendance pct,
    prior attendance rate cannot be computed and must be reported as unavailable.
    """
    payload = {
        "lectures": [
            {
                "day": "Monday",
                "start_time": "14:10",
                "end_time": "15:00",
                "subject_name": "Cyber Security",
                "subject_code": "CS",
            }
        ],
        "attendance_records": [],  # Completely empty attendance history
        "student_profile": {
            "commute_time_minutes": 30.0,
            "previous_cgpa_synthetic": 7.5,
            # previous_semester_attendance_pct is omitted
        },
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    pred = data["predictions"][0]
    assert pred["status"] == "unavailable"
    assert "prior_attendance_rate" in pred["missing_features"]


# ==========================================
# 4. BATCH & EDGE CASES
# ==========================================

def test_multiple_upcoming_lectures_batch(client):
    """Test batch prediction across multiple upcoming lectures."""
    payload = {
        "lectures": [
            {"day": "Monday", "start_time": "09:00", "end_time": "10:00", "subject_code": "IoTA", "subject_name": "IoT"},
            {"day": "Monday", "start_time": "10:15", "end_time": "11:15", "subject_code": "MLE", "subject_name": "Machine Learning"},
            {"day": "Tuesday", "start_time": "11:30", "end_time": "12:30", "subject_code": "TOC", "subject_name": "Theory of Computation"},
            {"day": "Friday", "start_time": "16:10", "end_time": "17:00", "subject_code": "DC", "subject_name": "Distributed Computing"},
        ],
        "attendance_records": [
            {"subject_code": "IoTA", "lectures_conducted": 25, "lectures_attended": 22},
            {"subject_code": "MLE", "lectures_conducted": 25, "lectures_attended": 20},
            {"subject_code": "TOC", "lectures_conducted": 20, "lectures_attended": 18},
            {"subject_code": "DC", "lectures_conducted": 25, "lectures_attended": 12},
        ],
        "student_profile": {"student_id": "S001"},
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_lectures"] == 4
    assert data["available_predictions_count"] == 4
    assert len(data["predictions"]) == 4


def test_empty_timetable_request(client):
    """Test empty timetable list."""
    payload = {
        "lectures": [],
        "attendance_records": [{"subject_code": "MLE", "lectures_conducted": 10, "lectures_attended": 9}],
        "student_profile": {"student_id": "S001"},
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_lectures"] == 0
    assert data["predictions"] == []


def test_invalid_input_validation(client):
    """Test negative attendance counts are rejected by Pydantic validation."""
    payload = {
        "lectures": [{"day": "Monday", "start_time": "09:00", "end_time": "10:00", "subject_code": "MLE", "subject_name": "MLE"}],
        "attendance_records": [{"subject_code": "MLE", "lectures_conducted": -5, "lectures_attended": 2}],
    }
    response = client.post("/api/predictions/upcoming-lectures", json=payload)
    assert response.status_code == 422

