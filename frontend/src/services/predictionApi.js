/**
 * predictionApi.js - Frontend API Service for BunkPredictor ML Predictions
 * Interfaces with FastAPI endpoints for:
 * - Upcoming individual lecture predictions with probability scores
 * - Model status and feature metadata
 */

import { API_BASE_URL } from "./timetableApi.js";
import { SAMPLE_TIMETABLE_ENTRIES } from "../data/sampleTimetable.js";

export const STORAGE_KEY_TIMETABLE = "bunkpredictor_timetable_entries";
export const STORAGE_KEY_STUDENT_PROFILE = "bunkpredictor_student_profile_v1";

export const DEFAULT_STUDENT_PROFILE = {
  student_id: "S001",
  commute_time_minutes: 25,
  previous_semester_attendance_pct: 85.0,
  previous_cgpa_synthetic: 8.5,
};

/**
 * 60% probability threshold for individual lecture predictions:
 * - Attendance probability >= 60% -> "Likely to Attend"
 * - Attendance probability < 60% -> "Likely to Miss"
 */
export const ATTENDANCE_PROBABILITY_THRESHOLD = 60.0;

export function classifyAttendanceOutcome(attendanceProbability) {
  if (attendanceProbability == null || isNaN(attendanceProbability)) {
    return "Unavailable";
  }
  return attendanceProbability >= ATTENDANCE_PROBABILITY_THRESHOLD
    ? "Likely to Attend"
    : "Likely to Miss";
}

/**
 * Loads student profile from localStorage, or null if unconfigured
 */
export function loadStudentProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENT_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse student profile:", e);
    return null;
  }
}

/**
 * Saves student profile to localStorage
 */
export function saveStudentProfile(profile) {
  try {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEY_STUDENT_PROFILE);
    } else {
      localStorage.setItem(STORAGE_KEY_STUDENT_PROFILE, JSON.stringify(profile));
    }
    return true;
  } catch (e) {
    console.error("Failed to save student profile:", e);
    return false;
  }
}

/**
 * Loads current timetable entries from storage, falling back to sample timetable
 */
export function loadTimetableForPredictions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMETABLE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading timetable from storage:", e);
  }
  return SAMPLE_TIMETABLE_ENTRIES;
}

/**
 * Normalizes timetable items into backend expected payload format
 */
export function normalizeLecturesForApi(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((e, idx) => ({
    id: e.id || `lec-${idx}`,
    day: e.day || "Monday",
    start_time: e.startTime || e.start_time || "09:00",
    end_time: e.endTime || e.end_time || "10:00",
    subject_name: e.subjectName || e.subject_name || "Subject",
    subject_code: (e.subjectCode || e.subject_code || "SUB").toUpperCase(),
    session_type: e.sessionType || e.session_type || "Theory",
    room: e.room || "",
    faculty: e.faculty || "",
    batch: e.batch || e.lab_batch || "",
  }));
}

/**
 * Fetches trained model metadata and feature taxonomy
 */
export async function getModelInfo() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/predictions/model-info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("Could not fetch model info:", e);
    return {
      model_loaded: false,
      model_name: "Unavailable",
      supports_predict_proba: false,
      error: e.message,
    };
  }
}

/**
 * Calls POST /api/predictions/upcoming-lectures for individual lecture predictions
 */
export async function predictUpcomingLectures({
  lectures,
  attendanceRecords,
  studentProfile,
  semesterStartDate = "2026-08-03",
  referenceDate,
}) {
  const payload = {
    lectures: normalizeLecturesForApi(lectures),
    attendance_records: (attendanceRecords || []).map((s) => ({
      subject_code: (s.subject_code || "").toUpperCase(),
      subject_name: s.subject_name || "",
      lectures_conducted: Number(s.lectures_conducted) || 0,
      lectures_attended: Number(s.lectures_attended) || 0,
    })),
    student_profile: studentProfile || null,
    semester_start_date: semesterStartDate,
    reference_date: referenceDate || null,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/predictions/upcoming-lectures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = `Server returned ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // use fallback
      }
      throw new Error(detail);
    }

    return await res.json();
  } catch (e) {
    console.error("predictUpcomingLectures failed:", e);
    throw e;
  }
}
