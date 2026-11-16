import assert from "node:assert/strict";
import {
  loadAttendanceSubjects,
  saveAttendanceSubjects,
  loadAttendanceSettings,
  saveAttendanceSettings,
  resetAttendanceData,
  EVENT_SUBJECTS_UPDATED,
  EVENT_DATA_RESET,
} from "./src/services/attendanceStorage.js";

import {
  calculateSubjectAnalysis,
  calculateSimulatedScenario,
} from "./src/utils/attendanceCalculations.js";

console.log("=== BunkPredictor Prediction Center Integration & Storage Suite ===");

// Create mock localStorage & window event system
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

class MockEventTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  removeEventListener(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, filtered);
  }
  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const cb of list) {
      cb(event);
    }
    return true;
  }
}

globalThis.localStorage = new MockStorage();
globalThis.window = new MockEventTarget();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, params = {}) {
    this.type = type;
    this.detail = params.detail;
  }
};

// -------------------------------------------------------------
// SCENARIO 1: No subjects saved (Empty State)
// -------------------------------------------------------------
console.log("\n--- SCENARIO 1: No subjects saved ---");
resetAttendanceData();
const emptySubjects = loadAttendanceSubjects();
assert.equal(Array.isArray(emptySubjects), true);
assert.equal(emptySubjects.length, 0);
console.log("✓ No subjects in storage: returns [] without fabricating fake demo data.");

// -------------------------------------------------------------
// SCENARIO 2: One subject saved
// -------------------------------------------------------------
console.log("\n--- SCENARIO 2: One subject saved ---");
const singleSubject = [
  {
    id: "sub-101",
    subject_name: "Computer Architecture",
    subject_code: "CS201",
    lectures_conducted: 36,
    lectures_attended: 30,
    lectures_remaining: 14,
    minimum_attendance: 75,
    input_mode: "counts",
  },
];
saveAttendanceSubjects(singleSubject);
const loadedSingle = loadAttendanceSubjects();
assert.equal(loadedSingle.length, 1);
assert.equal(loadedSingle[0].id, "sub-101");
assert.equal(loadedSingle[0].subject_name, "Computer Architecture");
assert.equal(loadedSingle[0].subject_code, "CS201");
assert.equal(loadedSingle[0].lectures_conducted, 36);
assert.equal(loadedSingle[0].lectures_attended, 30);
assert.equal(loadedSingle[0].lectures_remaining, 14);

const analysisSingle = calculateSubjectAnalysis(loadedSingle[0], 75);
assert.equal(analysisSingle.isValid, true);
assert.equal(analysisSingle.currentPercentage.toFixed(2), "83.33");
// total = 36 + 14 = 50. ceil(0.75 * 50) = 38. reqFuture = 38 - 30 = 8. safe = 14 - 8 = 6.
assert.equal(analysisSingle.safeBunks, 6);
assert.equal(analysisSingle.maxProjected.toFixed(2), "88.00"); // (30+14)/50 = 44/50 = 88%
assert.equal(analysisSingle.minProjected.toFixed(2), "60.00"); // 30/50 = 60%
console.log("✓ Single subject loaded with exact values and deterministic predictions.");

// -------------------------------------------------------------
// SCENARIO 3: Multiple subjects saved (Subject Isolation)
// -------------------------------------------------------------
console.log("\n--- SCENARIO 3: Multiple subjects saved ---");
const multiSubjects = [
  {
    id: "sub-101",
    subject_name: "Computer Architecture",
    subject_code: "CS201",
    lectures_conducted: 36,
    lectures_attended: 30,
    lectures_remaining: 14,
    minimum_attendance: 75,
    input_mode: "counts",
  },
  {
    id: "sub-102",
    subject_name: "Database Management",
    subject_code: "CS202",
    lectures_conducted: 24,
    lectures_attended: 18,
    lectures_remaining: 20,
    minimum_attendance: 80,
    input_mode: "counts",
  },
  {
    id: "sub-103",
    subject_name: "Operating Systems",
    subject_code: "CS203",
    lectures_conducted: 40,
    current_percentage: 85,
    lectures_remaining: 10,
    minimum_attendance: 75,
    input_mode: "percentage",
  },
];
saveAttendanceSubjects(multiSubjects);
const loadedMulti = loadAttendanceSubjects();
assert.equal(loadedMulti.length, 3);

// Verify that remaining lectures and predictions remain strictly independent per subject
const a1 = calculateSubjectAnalysis(loadedMulti[0]);
const a2 = calculateSubjectAnalysis(loadedMulti[1]);
const a3 = calculateSubjectAnalysis(loadedMulti[2]);

assert.equal(a1.remaining, 14);
assert.equal(a2.remaining, 20);
assert.equal(a3.remaining, 10);
assert.notEqual(a1.remaining, a2.remaining);
assert.notEqual(a2.remaining, a3.remaining);

// Sub 2: 24 conducted, 18 attended (75%), 20 remaining, target 80%
// Total = 44. ceil(0.80 * 44) = 36. reqFuture = 36 - 18 = 18. safe = 20 - 18 = 2.
assert.equal(a2.safeBunks, 2);

// Sub 3: 40 conducted, 85%, 10 remaining
// 85% of 40 = 34 attended. Total = 50. ceil(0.75 * 50) = 38. reqFuture = 38 - 34 = 4. safe = 10 - 4 = 6.
assert.equal(a3.safeBunks, 6);
console.log("✓ Multiple subjects: loaded and analyzed with strict isolation.");

// -------------------------------------------------------------
// SCENARIO 4: Editing a subject in Attendance Tracker (Live Updates)
// -------------------------------------------------------------
console.log("\n--- SCENARIO 4: Editing a subject in Attendance Tracker ---");
let eventReceived = false;
let updatedDetail = null;

const listener = (e) => {
  eventReceived = true;
  updatedDetail = e.detail;
};
window.addEventListener(EVENT_SUBJECTS_UPDATED, listener);

// Student edits Sub-102 (attended increases from 18 to 22)
const editedSubjects = loadedMulti.map((s) =>
  s.id === "sub-102" ? { ...s, lectures_attended: 22 } : s
);
saveAttendanceSubjects(editedSubjects);

assert.equal(eventReceived, true);
assert.equal(updatedDetail.length, 3);
const reloaded = loadAttendanceSubjects();
const editedAnalysis = calculateSubjectAnalysis(reloaded.find((s) => s.id === "sub-102"));
// 24 conducted, 22 attended (91.67%), 20 remaining, target 80%
// Total = 44. ceil(0.80 * 44) = 36. reqFuture = max(0, 36 - 22) = 14. safe = 20 - 14 = 6.
assert.equal(editedAnalysis.attended, 22);
assert.equal(editedAnalysis.safeBunks, 6); // increased from 2 to 6!
window.removeEventListener(EVENT_SUBJECTS_UPDATED, listener);
console.log("✓ Editing a subject dispatches live event and updates predictions immediately.");

// -------------------------------------------------------------
// SCENARIO 5: Deleting a subject
// -------------------------------------------------------------
console.log("\n--- SCENARIO 5: Deleting a subject ---");
const remainingAfterDelete = reloaded.filter((s) => s.id !== "sub-103");
saveAttendanceSubjects(remainingAfterDelete);
const afterDelete = loadAttendanceSubjects();
assert.equal(afterDelete.length, 2);
assert.equal(afterDelete.some((s) => s.id === "sub-103"), false);
console.log("✓ Deleting a subject removes it cleanly without corrupting other subjects.");

// -------------------------------------------------------------
// SCENARIO 6: Zero remaining lectures (R = 0, Semester Completed)
// -------------------------------------------------------------
console.log("\n--- SCENARIO 6: Zero remaining lectures (R = 0) ---");
const completedSubject = {
  id: "sub-complete",
  subject_name: "Machine Learning Capstone",
  subject_code: "CS499",
  lectures_conducted: 50,
  lectures_attended: 42,
  lectures_remaining: 0,
  minimum_attendance: 75,
  input_mode: "counts",
};
const analysisCompleted = calculateSubjectAnalysis(completedSubject, 75);
assert.equal(analysisCompleted.isValid, true);
assert.equal(analysisCompleted.remaining, 0);
assert.equal(analysisCompleted.currentPercentageFormatted, "84.00%");
assert.equal(analysisCompleted.maxProjectedFormatted, "84.00%");
assert.equal(analysisCompleted.minProjectedFormatted, "84.00%");
assert.equal(analysisCompleted.safeBunks, 0);

const simCompleted = calculateSimulatedScenario(42, 50, 0, 0, 75);
assert.equal(simCompleted.simulatedPercentageFormatted, "84.00%");
assert.equal(simCompleted.futureAttended, 0);
assert.equal(simCompleted.futureMissed, 0);
console.log("✓ Zero remaining lectures: Best case == Worst case == Current == 84.00%, Safe Bunks = 0.");

// -------------------------------------------------------------
// SCENARIO 7: Invalid or missing attendance data (Validation)
// -------------------------------------------------------------
console.log("\n--- SCENARIO 7: Invalid or missing attendance data ---");
const invalidSubject = {
  id: "sub-invalid",
  subject_name: "Discrete Mathematics",
  subject_code: "MATH201",
  lectures_conducted: 15,
  lectures_attended: 25, // Inconsistent: Attended > Conducted
  lectures_remaining: 10,
  minimum_attendance: 75,
};
saveAttendanceSubjects([invalidSubject]);
// Storage does not silently alter the user's data:
const loadedInvalid = loadAttendanceSubjects();
assert.equal(loadedInvalid[0].lectures_conducted, 15);
assert.equal(loadedInvalid[0].lectures_attended, 25);

// Validation layer catches error cleanly:
const analysisInvalid = calculateSubjectAnalysis(loadedInvalid[0], 75);
assert.equal(analysisInvalid.isValid, false);
assert.equal(analysisInvalid.currentPercentageFormatted, "—");
assert.equal(analysisInvalid.maxProjectedFormatted, "—");
assert.equal(analysisInvalid.minProjectedFormatted, "—");
assert.ok(analysisInvalid.validationError.includes("cannot exceed conducted lectures"));
console.log("✓ Inconsistent data: User's saved numbers preserved, validation flags error cleanly.");

// -------------------------------------------------------------
// SCENARIO 8: Settings update and Data Reset
// -------------------------------------------------------------
console.log("\n--- SCENARIO 8: Settings update and Data Reset ---");
let resetEventFired = false;
window.addEventListener(EVENT_DATA_RESET, () => {
  resetEventFired = true;
});

saveAttendanceSettings({ minimumAttendance: 80 });
const loadedSettings = loadAttendanceSettings();
assert.equal(loadedSettings.minimumAttendance, 80);

resetAttendanceData();
assert.equal(resetEventFired, true);
assert.equal(loadAttendanceSubjects().length, 0);
assert.equal(loadAttendanceSettings().minimumAttendance, 75);
console.log("✓ Settings update and data reset event cycle verified.");

console.log("\n=======================================================");
console.log("ALL PREDICTION CENTER INTEGRATION TESTS PASSED!");
console.log("=======================================================\n");
