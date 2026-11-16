import assert from "node:assert/strict";
import {
  normalizeLecturesForApi,
  loadStudentProfile,
  saveStudentProfile,
  loadTimetableForPredictions,
  classifyAttendanceOutcome,
  ATTENDANCE_PROBABILITY_THRESHOLD,
} from "./src/services/predictionApi.js";

console.log("=== BunkPredictor ML Features & Upcoming Lecture Test Suite ===");

// Mock localStorage
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockStorage();

// -------------------------------------------------------------
// TEST 1: Timetable Normalization for ML Prediction Service
// -------------------------------------------------------------
console.log("\n--- TEST 1: Timetable Normalization for ML Service ---");
const rawLectures = [
  {
    id: "mon-1",
    day: "Monday",
    startTime: "10:10",
    endTime: "11:00",
    subjectName: "Machine Learning Essentials",
    subjectCode: "mle",
    sessionType: "Theory",
  },
  {
    id: "tue-1",
    day: "Tuesday",
    start_time: "12:10",
    end_time: "13:00",
    subject_name: "Distributed Computing",
    subject_code: "DC",
    session_type: "Lab",
    batch: "B2",
  },
];

const normalized = normalizeLecturesForApi(rawLectures);
assert.equal(normalized.length, 2);
assert.equal(normalized[0].subject_code, "MLE"); // normalized uppercase
assert.equal(normalized[0].start_time, "10:10");
assert.equal(normalized[0].end_time, "11:00");
assert.equal(normalized[0].session_type, "Theory");

assert.equal(normalized[1].subject_code, "DC");
assert.equal(normalized[1].start_time, "12:10");
assert.equal(normalized[1].session_type, "Lab");
assert.equal(normalized[1].batch, "B2");
console.log("✓ Timetable normalization converts keys, normalizes uppercase codes, and preserves batches.");

// -------------------------------------------------------------
// TEST 2: Student Profile Persistence & Defaults
// -------------------------------------------------------------
console.log("\n--- TEST 2: Student Profile Persistence & Defaults ---");
localStorage.clear();
assert.equal(loadStudentProfile(), null);

// Save custom profile
const customProfile = {
  student_id: null,
  commute_time_minutes: 35,
  previous_semester_attendance_pct: 82.5,
  previous_cgpa_synthetic: 7.9,
};
saveStudentProfile(customProfile);

const loaded = loadStudentProfile();
assert.equal(loaded.commute_time_minutes, 35);
assert.equal(loaded.previous_semester_attendance_pct, 82.5);
assert.equal(loaded.previous_cgpa_synthetic, 7.9);
assert.equal(loaded.student_id, null);

// Clear profile
saveStudentProfile(null);
assert.equal(loadStudentProfile(), null);
console.log("✓ Student profile loads, saves, and clears cleanly without fabricating default data.");

// -------------------------------------------------------------
// TEST 3: Timetable Fallback Loading
// -------------------------------------------------------------
console.log("\n--- TEST 3: Timetable Loading & Fallback ---");
localStorage.clear();
const timetable = loadTimetableForPredictions();
assert.equal(Array.isArray(timetable), true);
assert.ok(timetable.length > 0, "Expected sample timetable fallback entries");
assert.ok(timetable.some((e) => (e.subjectCode || e.subject_code) === "MLE"));
console.log(`✓ Loaded timetable fallback with ${timetable.length} entries.`);

// -------------------------------------------------------------
// TEST 4: 60% Probability Threshold Classification & Outcome Mapping
// -------------------------------------------------------------
console.log("\n--- TEST 4: 60% Probability Threshold Classification ---");
assert.equal(ATTENDANCE_PROBABILITY_THRESHOLD, 60.0);

function interpretPrediction(probPresent) {
  const attendPct = Math.round(probPresent * 1000) / 10;
  const missPct = Math.round((100.0 - attendPct) * 10) / 10;
  return {
    attendance_probability: attendPct,
    absence_probability: missPct,
    predicted_outcome: classifyAttendanceOutcome(attendPct),
  };
}

// Case 1: 82.4% attend (>= 60%) -> Likely to Attend
const highAttend = interpretPrediction(0.824);
assert.equal(highAttend.attendance_probability, 82.4);
assert.equal(highAttend.absence_probability, 17.6);
assert.equal(highAttend.attendance_probability + highAttend.absence_probability, 100.0);
assert.equal(highAttend.predicted_outcome, "Likely to Attend");

// Case 2: Exactly 60.0% boundary (>= 60%) -> Likely to Attend
const border60 = interpretPrediction(0.60);
assert.equal(border60.attendance_probability, 60.0);
assert.equal(border60.absence_probability, 40.0);
assert.equal(border60.attendance_probability + border60.absence_probability, 100.0);
assert.equal(border60.predicted_outcome, "Likely to Attend");

// Case 3: 59.9% (< 60%) -> Likely to Miss
const justBelow = interpretPrediction(0.599);
assert.equal(justBelow.attendance_probability, 59.9);
assert.equal(justBelow.absence_probability, 40.1);
assert.equal(justBelow.attendance_probability + justBelow.absence_probability, 100.0);
assert.equal(justBelow.predicted_outcome, "Likely to Miss");

// Case 4: 50.0% (< 60%) -> Likely to Miss (proves 60% threshold divergence from 50%)
const midFifty = interpretPrediction(0.50);
assert.equal(midFifty.attendance_probability, 50.0);
assert.equal(midFifty.absence_probability, 50.0);
assert.equal(midFifty.attendance_probability + midFifty.absence_probability, 100.0);
assert.equal(midFifty.predicted_outcome, "Likely to Miss");

// Case 5: 38.2% (< 60%) -> Likely to Miss
const highMiss = interpretPrediction(0.382);
assert.equal(highMiss.attendance_probability, 38.2);
assert.equal(highMiss.absence_probability, 61.8);
assert.equal(highMiss.attendance_probability + highMiss.absence_probability, 100.0);
assert.equal(highMiss.predicted_outcome, "Likely to Miss");

console.log("✓ 60% probability threshold: >= 60% -> Likely to Attend, < 60% -> Likely to Miss. Sum = 100%.");

// -------------------------------------------------------------
// TEST 5: Missing Features Identification
// -------------------------------------------------------------
console.log("\n--- TEST 5: Missing Features Identification ---");
function auditRequiredFeatures(lecture, attendanceHistory, studentProfile) {
  const missing = [];
  if (!lecture.day) missing.push("day");
  if (!lecture.subject_code) missing.push("subject_code");
  if (!studentProfile || studentProfile.commute_time_minutes == null) missing.push("commute_time_minutes");
  if (!studentProfile || studentProfile.previous_semester_attendance_pct == null) missing.push("previous_semester_attendance_pct");
  if (!studentProfile || studentProfile.previous_cgpa_synthetic == null) missing.push("previous_cgpa_synthetic");
  if (!attendanceHistory || attendanceHistory.length === 0) missing.push("prior_attendance_rate");

  return {
    isAvailable: missing.length === 0,
    missingFeatures: missing,
  };
}

const auditMissing = auditRequiredFeatures(
  { day: "Monday", subject_code: "MLE" },
  [], // empty history
  null // no profile
);

assert.equal(auditMissing.isAvailable, false);
assert.ok(auditMissing.missingFeatures.includes("commute_time_minutes"));
assert.ok(auditMissing.missingFeatures.includes("previous_semester_attendance_pct"));
assert.ok(auditMissing.missingFeatures.includes("previous_cgpa_synthetic"));
assert.ok(auditMissing.missingFeatures.includes("prior_attendance_rate"));
console.log("✓ Missing feature audit correctly catches absent profile and attendance history.");

console.log("\n=======================================================");
console.log("ALL UPCOMING LECTURE & ML PREDICTION TESTS PASSED!");
console.log("=======================================================\n");
