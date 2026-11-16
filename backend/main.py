"""
main.py - FastAPI Backend for BunkPredictor
Exposes timetable extraction and ML prediction endpoints:
- Timetable extraction (/api/timetable/extract)
- Model metadata (/api/predictions/model-info)
- Upcoming lecture prediction (/api/predictions/upcoming-lectures)
- Class attendance estimation & API contract (/api/predictions/class-attendance)
"""

import os
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from parser import (
    extract_from_pdf,
    extract_from_image,
    get_tesseract_status,
)
from prediction_service import (
    load_prediction_model,
    get_model_status,
    predict_upcoming_lectures,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Loads the trained Random Forest model once during application startup.
    Avoids loading large pickle artifacts on every prediction request.
    """
    load_prediction_model()
    yield


app = FastAPI(
    title="BunkPredictor API",
    description="Timetable extraction and ML attendance prediction engine for college lectures.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS setup for Vite frontend development
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):[0-9]+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


# ==========================================
# TIMETABLE EXTRACTION MODELS
# ==========================================

class TimetableEntry(BaseModel):
    day: str
    start_time: str
    end_time: str
    subject_name: str
    subject_code: str
    session_type: str = "Theory"
    faculty: Optional[str] = ""
    room: Optional[str] = ""
    lab_batch: Optional[str] = ""
    needs_review: bool = False


class ExtractionResponse(BaseModel):
    success: bool
    filename: str
    entries: List[TimetableEntry]
    warnings: List[str]
    extraction_method: str


# ==========================================
# PREDICTION MODELS
# ==========================================

class StudentProfileRequest(BaseModel):
    student_id: Optional[str] = None
    commute_time_minutes: Optional[float] = None
    previous_semester_attendance_pct: Optional[float] = None
    previous_cgpa_synthetic: Optional[float] = None


class SubjectAttendanceRecordRequest(BaseModel):
    subject_code: str
    subject_name: Optional[str] = ""
    lectures_conducted: int = Field(ge=0)
    lectures_attended: int = Field(ge=0)


class TimetableLectureRequest(BaseModel):
    id: Optional[str] = None
    day: str
    start_time: str
    end_time: str
    subject_name: str
    subject_code: str
    session_type: str = "Theory"
    slot_number: Optional[int] = None
    date: Optional[str] = None
    room: Optional[str] = ""
    faculty: Optional[str] = ""
    batch: Optional[str] = ""


class UpcomingLecturePredictionRequest(BaseModel):
    lectures: List[TimetableLectureRequest]
    attendance_records: List[SubjectAttendanceRecordRequest] = []
    student_profile: Optional[StudentProfileRequest] = None
    semester_start_date: Optional[str] = "2026-08-03"
    reference_date: Optional[str] = None


class UpcomingLecturePredictionResponse(BaseModel):
    success: bool
    total_lectures: int
    available_predictions_count: int
    unavailable_predictions_count: int
    likely_to_attend_count: Optional[int] = 0
    likely_to_miss_count: Optional[int] = 0
    classification_threshold: Optional[float] = 60.0
    predictions: List[Dict[str, Any]]
    message: Optional[str] = None


# ==========================================
# CORE & HEALTH ENDPOINTS
# ==========================================

@app.get("/")
def read_root():
    """Root status endpoint."""
    tess_available, tess_info = get_tesseract_status()
    model_status = get_model_status()
    return {
        "status": "ok",
        "service": "BunkPredictor API",
        "version": "2.0.0",
        "tesseract_available": tess_available,
        "model_loaded": model_status.get("model_loaded", False),
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    tess_available, tess_info = get_tesseract_status()
    model_status = get_model_status()
    return {
        "status": "healthy",
        "tesseract_available": tess_available,
        "tesseract_info": tess_info if tess_available else "Not installed in PATH",
        "ml_model": {
            "loaded": model_status.get("model_loaded", False),
            "model_name": model_status.get("model_name"),
            "supports_predict_proba": model_status.get("supports_predict_proba", False),
        },
    }


# ==========================================
# TIMETABLE EXTRACTION ENDPOINT
# ==========================================

@app.post("/api/timetable/extract", response_model=ExtractionResponse)
async def extract_timetable(file: UploadFile = File(...)):
    """
    Accepts PDF or Image (PNG/JPG/JPEG) timetable file and returns normalized schedule entries.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was provided in the upload request.",
        )

    # 1. Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, PNG, JPG, JPEG.",
        )

    # 2. Read file content with size check
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes).",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 10 MB ({len(content) / (1024 * 1024):.1f} MB).",
        )

    # 3. Perform text extraction
    try:
        if ext == ".pdf":
            _, entries, warnings, method = extract_from_pdf(content)
        else:
            _, entries, warnings, method = extract_from_image(content)

        return ExtractionResponse(
            success=True,
            filename=file.filename,
            entries=[TimetableEntry(**e) for e in entries],
            warnings=warnings,
            extraction_method=method,
        )

    except RuntimeError as re_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(re_err),
        )
    except ValueError as ve_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve_err),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during timetable extraction: {str(e)}",
        )


# ==========================================
# ML PREDICTION ENDPOINTS (FEATURES 1, 2, 3)
# ==========================================

@app.get("/api/predictions/model-info")
def get_model_info():
    """
    Returns architecture, status, feature definitions, and support for predict_proba()
    of the loaded Random Forest model.
    """
    return get_model_status()


@app.post("/api/predictions/upcoming-lectures", response_model=UpcomingLecturePredictionResponse)
def predict_upcoming(request: UpcomingLecturePredictionRequest):
    """
    FEATURE 1 & FEATURE 3:
    Predicts attendance probability and expected outcome for individual upcoming lectures.
    Uses timetable schedule, student attendance history, and student profile.
    If required features are missing, gracefully handles prediction as unavailable without fabrication.
    """
    lectures_dicts = [lec.model_dump() for lec in request.lectures]
    attendance_dicts = [rec.model_dump() for rec in request.attendance_records]
    profile_dict = request.student_profile.model_dump() if request.student_profile else None

    result = predict_upcoming_lectures(
        lectures=lectures_dicts,
        attendance_records=attendance_dicts,
        student_profile=profile_dict,
        semester_start_date=request.semester_start_date,
        reference_date=request.reference_date,
    )
    return UpcomingLecturePredictionResponse(**result)
