/**
 * attendanceStorage.js
 * Storage service for BunkPredictor Attendance Tracker (Subject-Wise Attendance & Predictions).
 * Manages versioned localStorage persistence, safe deserialization, timetable subject imports,
 * and data reset controls.
 */

export const STORAGE_KEY_SUBJECTS = "bunkpredictor_attendance_subjects_v2";
export const STORAGE_KEY_SETTINGS = "bunkpredictor_attendance_settings_v2";
export const STORAGE_KEY_TIMETABLE = "bunkpredictor_timetable_entries";

export const DEFAULT_SETTINGS = {
  minimumAttendance: 75,
};

export const EVENT_SUBJECTS_UPDATED = "bunkpredictor:subjects_updated";
export const EVENT_SETTINGS_UPDATED = "bunkpredictor:settings_updated";
export const EVENT_DATA_RESET = "bunkpredictor:data_reset";

/**
 * Loads subjects from localStorage with schema validation.
 * Does not inject fake default data. Returns [] if no data exists.
 * Preserves the actual saved numbers without silently clamping or altering inconsistent data.
 */
export function loadAttendanceSubjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBJECTS);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    return data
      .filter((s) => s && typeof s === "object" && s.id && s.subject_name)
      .map((s) => ({
        id: String(s.id),
        subject_name: String(s.subject_name).trim(),
        subject_code: String(s.subject_code || "").trim().toUpperCase(),
        lectures_conducted: Number.isFinite(Number(s.lectures_conducted)) ? Number(s.lectures_conducted) : 0,
        lectures_attended: Number.isFinite(Number(s.lectures_attended)) ? Number(s.lectures_attended) : 0,
        current_percentage: Number.isFinite(Number(s.current_percentage)) ? Number(s.current_percentage) : 0,
        lectures_remaining: Number.isFinite(Number(s.lectures_remaining)) ? Number(s.lectures_remaining) : 0,
        minimum_attendance: Number.isFinite(Number(s.minimum_attendance)) ? Number(s.minimum_attendance) : 75,
        input_mode: s.input_mode === "percentage" ? "percentage" : "counts",
      }));
  } catch (error) {
    console.error("Error loading attendance subjects from storage:", error);
    return [];
  }
}

/**
 * Persists subjects array to localStorage and dispatches a live update event.
 */
export function saveAttendanceSubjects(subjects) {
  try {
    localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(subjects));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_SUBJECTS_UPDATED, { detail: subjects }));
    }
    return true;
  } catch (error) {
    console.error("Failed to save attendance subjects:", error);
    return false;
  }
}

/**
 * Loads global attendance settings.
 */
export function loadAttendanceSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      minimumAttendance:
        typeof parsed.minimumAttendance === "number" &&
        parsed.minimumAttendance >= 1 &&
        parsed.minimumAttendance <= 100
          ? parsed.minimumAttendance
          : DEFAULT_SETTINGS.minimumAttendance,
    };
  } catch (error) {
    console.warn("Error loading attendance settings, using defaults:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves global attendance settings and dispatches a live update event.
 */
export function saveAttendanceSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_SETTINGS_UPDATED, { detail: settings }));
    }
    return true;
  } catch (error) {
    console.error("Failed to save attendance settings:", error);
    return false;
  }
}

/**
 * Resets all attendance subjects and restores settings to defaults.
 */
export function resetAttendanceData() {
  try {
    localStorage.removeItem(STORAGE_KEY_SUBJECTS);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_DATA_RESET));
    }
    return true;
  } catch (error) {
    console.error("Failed to reset attendance data:", error);
    return false;
  }
}

/**
 * Inspects existing timetable entries from localStorage and extracts unique subjects.
 * Returns normalized unique subjects without inventing attendance figures.
 */
export function getAvailableTimetableSubjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMETABLE);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const map = new Map();
    for (const entry of entries) {
      const code = (entry.subjectCode || entry.subject_code || "").trim().toUpperCase();
      const name = (entry.subjectName || entry.subject_name || "").trim();

      if (!code && !name) continue;

      const key = code || name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          code: code || key.slice(0, 4),
          name: name || code,
        });
      }
    }

    return Array.from(map.values());
  } catch (error) {
    console.warn("Failed to inspect timetable subjects:", error);
    return [];
  }
}
