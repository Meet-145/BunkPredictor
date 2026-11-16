import assert from "node:assert/strict";
import {
  calculateSafeBunks,
  calculateLecturesNeeded,
  calculateSubjectAnalysis,
  calculateOverallAttendance,
  calculateSimulatedScenario,
  getAttendanceStatus,
  getSubjectRiskStatus,
  validateSubjectData,
} from "./src/utils/attendanceCalculations.js";

console.log("=== BunkPredictor Attendance Calculation Verification Suite ===");

// ==========================================
// TEST A
// C = 40, A = 32, R = 20, T = 75
// Expected:
// Current attendance = 80%
// Best case = 86.67%
// Worst case = 53.33%
// Maximum safe bunks = 7
// ==========================================
console.log("\n--- TEST A: Conducted = 40, Attended = 32, Remaining = 20, Target = 75% ---");
const testA = calculateSubjectAnalysis({
  subject_name: "Test Subject A",
  lectures_conducted: 40,
  lectures_attended: 32,
  lectures_remaining: 20,
  minimum_attendance: 75,
  input_mode: "counts",
});

console.log("Current Attendance:", testA.currentPercentageFormatted);
assert.equal(testA.currentPercentage, 80);
assert.equal(testA.currentPercentageFormatted, "80.00%");

console.log("Best Case (All Remaining Attended):", testA.maxProjectedFormatted);
assert.equal(testA.maxProjected.toFixed(2), "86.67");
assert.equal(testA.maxProjectedFormatted, "86.67%");

console.log("Worst Case (All Remaining Missed):", testA.minProjectedFormatted);
assert.equal(testA.minProjected.toFixed(2), "53.33");
assert.equal(testA.minProjectedFormatted, "53.33%");

console.log("Maximum Safe Bunks:", testA.safeBunks);
// Integer formula: requiredTotal = ceil(0.75 * 60) = 45; requiredFuture = max(0, 45 - 32) = 13; safe = 20 - 13 = 7
assert.equal(testA.safeBunks, 7);
assert.equal(calculateSafeBunks(32, 40, 20, 75), 7);
assert.equal(testA.status.key, "safe"); // 80% >= 75 + 5%
console.log("✓ TEST A PASSED (Current = 80%, Best = 86.67%, Worst = 53.33%, Safe Bunks = 7)");

// ==========================================
// TEST B
// C = 40, A = 32, R = 20, T = 75, B = 7
// Expected simulated attendance = 75%
// ==========================================
console.log("\n--- TEST B: C = 40, A = 32, R = 20, T = 75, Missed = 7 ---");
const testB = calculateSimulatedScenario(32, 40, 20, 7, 75);
console.log("Simulated Attendance at B = 7:", testB.simulatedPercentageFormatted);
assert.equal(testB.simulatedPercentage.toFixed(2), "75.00");
assert.equal(testB.simulatedPercentageFormatted, "75.00%");
assert.equal(testB.futureAttended, 13);
assert.equal(testB.futureMissed, 7);
assert.equal(testB.simulatedAttended, 45); // 32 + 13 = 45
assert.equal(testB.totalSemesterLectures, 60); // 40 + 20 = 60
assert.equal(testB.isAboveTarget, true); // 75.00% >= 75%
console.log("✓ TEST B PASSED (Simulated attendance = 75.00% at B = 7)");

// ==========================================
// TEST C
// C = 40, A = 32, R = 20, T = 75, B = 8
// Expected simulated attendance = 73.33%
// Status = Below required attendance
// ==========================================
console.log("\n--- TEST C: C = 40, A = 32, R = 20, T = 75, Missed = 8 ---");
const testC = calculateSimulatedScenario(32, 40, 20, 8, 75);
console.log("Simulated Attendance at B = 8:", testC.simulatedPercentageFormatted);
console.log("Status Key:", testC.status.key, `(${testC.status.label})`);
assert.equal(testC.simulatedPercentage.toFixed(2), "73.33");
assert.equal(testC.simulatedPercentageFormatted, "73.33%");
assert.equal(testC.futureAttended, 12);
assert.equal(testC.futureMissed, 8);
assert.equal(testC.simulatedAttended, 44); // 32 + 12 = 44 out of 60
assert.equal(testC.isAboveTarget, false);
assert.equal(testC.status.key, "below_threshold");
console.log("✓ TEST C PASSED (Simulated attendance = 73.33%, Status = Below required attendance)");

// ==========================================
// TEST D
// C = 40, A = 20, R = 20, T = 75
// Expected best-case attendance = 66.67%
// Expected safe bunks = 0
// Indicate that reaching 75% is impossible with the remaining lectures.
// ==========================================
console.log("\n--- TEST D: C = 40, A = 20, R = 20, T = 75 ---");
const testD = calculateSubjectAnalysis({
  subject_name: "Test Subject D",
  lectures_conducted: 40,
  lectures_attended: 20,
  lectures_remaining: 20,
  minimum_attendance: 75,
  input_mode: "counts",
});

console.log("Current Attendance:", testD.currentPercentageFormatted);
assert.equal(testD.currentPercentage, 50);

console.log("Best Case Attendance:", testD.maxProjectedFormatted);
assert.equal(testD.maxProjected.toFixed(2), "66.67");
assert.equal(testD.maxProjectedFormatted, "66.67%");

console.log("Safe Bunks:", testD.safeBunks);
assert.equal(testD.safeBunks, 0);
assert.equal(calculateSafeBunks(20, 40, 20, 75), 0);

console.log("Lectures Needed Consecutive:", testD.lecturesNeeded);
// (75 * 40 - 100 * 20) / (100 - 75) = 1000 / 25 = 40
assert.equal(testD.lecturesNeeded, 40);
assert.equal(calculateLecturesNeeded(20, 40, 20, 75), 40);
assert.equal(getAttendanceStatus(50, 75).key, "below_threshold");

console.log("Is Target Reachable with remaining 20 lectures?:", testD.isRecoverable);
console.log("Is Impossible flag:", testD.isImpossible);
assert.equal(testD.isRecoverable, false);
assert.equal(testD.isImpossible, true);
assert.equal(testD.status.key, "at_risk"); // Mathematically unreachable (Best case 66.67% < 75%)
console.log("✓ TEST D PASSED (Best case = 66.67%, Safe bunks = 0, Clearly flagged as at_risk / unreachable)");

// ==========================================
// TEST E
// C = 0, A = 0, R = 10, T = 75
// Expected:
// No calculation errors (no NaN or Infinity)
// Maximum safe bunks = 2, because attending at least 8 of the 10 lectures reaches 80%.
// ==========================================
console.log("\n--- TEST E: C = 0, A = 0, R = 10, T = 75 ---");
const testE = calculateSubjectAnalysis({
  subject_name: "Test Subject E",
  lectures_conducted: 0,
  lectures_attended: 0,
  lectures_remaining: 10,
  minimum_attendance: 75,
  input_mode: "counts",
});

console.log("Current Attendance:", testE.currentPercentageFormatted);
console.log("Best Case (All Attended):", testE.maxProjectedFormatted);
console.log("Worst Case (All Missed):", testE.minProjectedFormatted);
console.log("Safe Bunks:", testE.safeBunks);

assert.ok(!isNaN(testE.currentPercentage), "Current percentage is NaN!");
assert.ok(!isNaN(testE.maxProjected), "Max projected is NaN!");
assert.ok(!isNaN(testE.minProjected), "Min projected is NaN!");
assert.ok(isFinite(testE.currentPercentage), "Current percentage is Infinity!");
assert.ok(isFinite(testE.maxProjected), "Max projected is Infinity!");
assert.ok(isFinite(testE.minProjected), "Min projected is Infinity!");

assert.equal(testE.currentPercentage, 0);
assert.equal(testE.maxProjected, 100);
assert.equal(testE.minProjected, 0);
assert.equal(testE.safeBunks, 2); // ceil(0.75 * 10) = 8; requiredFuture = 8; safe = 10 - 8 = 2
assert.equal(calculateSafeBunks(0, 0, 10, 75), 2);
assert.equal(testE.status.key, "no_data");

// Verify safe bunks simulation for Test E:
// Miss 2: attend 8/10 = 80.00% >= 75%
const simE_safe = calculateSimulatedScenario(0, 0, 10, 2, 75);
assert.equal(simE_safe.simulatedPercentage, 80);
assert.equal(simE_safe.isAboveTarget, true);

// Miss 3: attend 7/10 = 70.00% < 75%
const simE_unsafe = calculateSimulatedScenario(0, 0, 10, 3, 75);
assert.equal(simE_unsafe.simulatedPercentage, 70);
assert.equal(simE_unsafe.isAboveTarget, false);
console.log("✓ TEST E PASSED (No division-by-zero, Safe bunks = 2, 8/10 = 80% >= 75%)");

// ==========================================
// TEST F
// C = 40, A = 40, R = 20, T = 75
// Formula verification & Edge case analysis:
// Under the integer calculation formula:
// requiredTotalAttended = ceil((T / 100) * (C + R)) = ceil(0.75 * 60) = 45
// requiredFutureAttended = max(0, 45 - 40) = 5
// maximumSafeBunks = 20 - 5 = 15
// Proof:
// Missing 15 lectures leaves 5 attended: (40 + 5) / 60 = 45/60 = 75.00% >= 75% (SAFE)
// Missing 20 lectures leaves 0 attended: (40 + 0) / 60 = 40/60 = 66.67% < 75% (UNSAFE)
// Also test edge cases where ALL remaining lectures can safely be missed (B = R = 20):
// e.g. C = 60, A = 60, R = 20, T = 75 => 60/80 = 75.00% => safe bunks = 20 (= R)
// ==========================================
console.log("\n--- TEST F: C = 40, A = 40, R = 20, T = 75 ---");
const testF = calculateSubjectAnalysis({
  subject_name: "Test Subject F",
  lectures_conducted: 40,
  lectures_attended: 40,
  lectures_remaining: 20,
  minimum_attendance: 75,
  input_mode: "counts",
});

console.log("Current Attendance:", testF.currentPercentageFormatted);
assert.equal(testF.currentPercentage, 100);

console.log("Best Case Attendance:", testF.maxProjectedFormatted);
assert.equal(testF.maxProjected, 100);

console.log("Safe Bunks under Integer Formula:", testF.safeBunks);
// Step 2 formula: requiredTotal = ceil(0.75 * 60) = 45; requiredFuture = 5; safeBunks = 20 - 5 = 15
assert.equal(testF.safeBunks, 15);
assert.equal(calculateSafeBunks(40, 40, 20, 75), 15);

// Verify simulation at safe limit (B = 15): 45/60 = 75.00% >= 75%
const simF_safe = calculateSimulatedScenario(40, 40, 20, 15, 75);
console.log("Simulated Attendance at B = 15:", simF_safe.simulatedPercentageFormatted);
assert.equal(simF_safe.simulatedPercentage.toFixed(2), "75.00");
assert.equal(simF_safe.isAboveTarget, true);

// Verify simulation beyond safe limit (B = 16): 44/60 = 73.33% < 75%
const simF_16 = calculateSimulatedScenario(40, 40, 20, 16, 75);
assert.equal(simF_16.simulatedPercentage.toFixed(2), "73.33");
assert.equal(simF_16.isAboveTarget, false);

// Verify that missing all 20 lectures results in 40/60 = 66.67% < 75%
const simF_20 = calculateSimulatedScenario(40, 40, 20, 20, 75);
console.log("Simulated Attendance at B = 20:", simF_20.simulatedPercentageFormatted, "(Deficit below 75%)");
assert.equal(simF_20.simulatedPercentage.toFixed(2), "66.67");
assert.equal(simF_20.isAboveTarget, false);

// Verify case where student CAN bunk ALL R = 20 remaining lectures (e.g. C = 60, A = 60, R = 20, T = 75):
// 60 / 80 = 75.00% >= 75%, so safe bunks = 20 (= R)
const testF_allBunkable = calculateSafeBunks(60, 60, 20, 75);
console.log("Edge Case: C = 60, A = 60, R = 20, T = 75 -> Safe Bunks:", testF_allBunkable);
assert.equal(testF_allBunkable, 20);

// Verify case where threshold is 60%: C = 40, A = 40, R = 20, T = 60
// 40 / 60 = 66.67% >= 60%, so safe bunks = 20 (= R)
const testF_target60 = calculateSafeBunks(40, 40, 20, 60);
console.log("Edge Case: C = 40, A = 40, R = 20, T = 60 -> Safe Bunks:", testF_target60);
assert.equal(testF_target60, 20);

console.log("✓ TEST F PASSED (Exact threshold verification: 15 safe bunks maintains 75.00%, B = R = 20 tested)");

// ==========================================
// ADDITIONAL EDGE CASE: Zero Total Semester Lectures (C = 0, A = 0, R = 0)
// ==========================================
console.log("\n--- TEST: Zero Total Semester Lectures (C = 0, A = 0, R = 0) ---");
const testZeroTotal = calculateSubjectAnalysis({
  subject_name: "Zero Lectures Subject",
  lectures_conducted: 0,
  lectures_attended: 0,
  lectures_remaining: 0,
  minimum_attendance: 75,
  input_mode: "counts",
});
assert.equal(testZeroTotal.totalSemesterLectures, 0);
assert.equal(testZeroTotal.currentPercentage, 0);
assert.ok(!isNaN(testZeroTotal.maxProjected));
assert.ok(!isNaN(testZeroTotal.minProjected));
assert.equal(testZeroTotal.safeBunks, 0);
assert.equal(calculateSafeBunks(0, 0, 0, 75), 0);
assert.equal(testZeroTotal.status.key, "no_data");
console.log("✓ Zero Total Semester Lectures PASSED (No division by zero or NaN)");

// ==========================================
// ADDITIONAL TEST: Weighted Overall Attendance
// ==========================
console.log("\n--- TEST: Weighted Overall Attendance ---");
const overall = calculateOverallAttendance([
  { lectures_conducted: 40, lectures_attended: 32, lectures_remaining: 20 }, // 80%
  { lectures_conducted: 10, lectures_attended: 5, lectures_remaining: 10 },  // 50%
  { lectures_conducted: 30, lectures_attended: 21, lectures_remaining: 15 }, // 70%
], 75);

// Sum attended: 32 + 5 + 21 = 58
// Sum conducted: 40 + 10 + 30 = 80
// Weighted: 58 / 80 * 100 = 72.5%
console.log("Total Conducted:", overall.totalConducted);
console.log("Total Attended:", overall.totalAttended);
console.log("Weighted Overall Percentage:", overall.overallPercentageFormatted);
assert.equal(overall.totalConducted, 80);
assert.equal(overall.totalAttended, 58);
assert.equal(overall.overallPercentage, 72.5);
assert.equal(overall.overallPercentageFormatted, "72.50%");
console.log("✓ Weighted Overall Attendance PASSED (72.50% vs unweighted 66.67%)");

// ==========================================
// ADDITIONAL TEST: Percentage-Based Input (Method B)
// ==========================================
console.log("\n--- TEST: Percentage-Based Input Mode (Method B) ---");
const exMethodB = calculateSubjectAnalysis({
  subject_name: "Computer Networks",
  lectures_conducted: 40,
  current_percentage: 80,
  lectures_remaining: 20,
  minimum_attendance: 75,
  input_mode: "percentage",
});
assert.equal(exMethodB.isApproximate, true);
assert.equal(exMethodB.currentPercentage, 80);
assert.equal(exMethodB.attended, 32);
assert.equal(exMethodB.safeBunks, 7);
console.log("✓ Method B Percentage Input PASSED (Preserves percentage & safe bunks = 7)");

// ==========================================
// ADDITIONAL TEST: Configurable Threshold Tracking
// ==========================================
console.log("\n--- TEST: Configurable Threshold Tracking ---");
// With T = 80%: requiredTotal = ceil(0.80 * 60) = 48; requiredFuture = 48 - 32 = 16; safe = 20 - 16 = 4
const safeAt80 = calculateSafeBunks(32, 40, 20, 80);
assert.equal(safeAt80, 4);

// With T = 85%: requiredTotal = ceil(0.85 * 60) = 51; requiredFuture = 51 - 32 = 19; safe = 20 - 19 = 1
const safeAt85 = calculateSafeBunks(32, 40, 20, 85);
assert.equal(safeAt85, 1);

// With T = 90%: best case is (32 + 20) / 60 = 86.67% < 90%; impossible to reach, safe = 0
const safeAt90 = calculateSafeBunks(32, 40, 20, 90);
assert.equal(safeAt90, 0);
// ==========================================
// ADDITIONAL TEST: Data Validation (Missing or Inconsistent Data)
// ==========================================
console.log("\n--- TEST: Data Validation (validateSubjectData & calculateSubjectAnalysis) ---");

// Valid subject
const validSub = {
  subject_name: "Operating Systems",
  lectures_conducted: 30,
  lectures_attended: 25,
  lectures_remaining: 15,
  minimum_attendance: 75,
  input_mode: "counts",
};
const valResultValid = validateSubjectData(validSub);
assert.equal(valResultValid.isValid, true);
assert.equal(valResultValid.error, null);

// Inconsistent: A > C
const invalidAttended = {
  subject_name: "Operating Systems",
  lectures_conducted: 20,
  lectures_attended: 25, // Attended > Conducted!
  lectures_remaining: 10,
  minimum_attendance: 75,
  input_mode: "counts",
};
const valResultAgtC = validateSubjectData(invalidAttended);
assert.equal(valResultAgtC.isValid, false);
assert.ok(valResultAgtC.error.includes("cannot exceed conducted lectures"));

const analysisAgtC = calculateSubjectAnalysis(invalidAttended, 75);
assert.equal(analysisAgtC.isValid, false);
assert.equal(analysisAgtC.currentPercentageFormatted, "—");
assert.ok(analysisAgtC.validationError.includes("cannot exceed conducted lectures"));

// Negative counts
const valNegative = validateSubjectData({
  subject_name: "Database Systems",
  lectures_conducted: -5,
  lectures_attended: 2,
  lectures_remaining: 10,
});
assert.equal(valNegative.isValid, false);
assert.ok(valNegative.error.includes("non-negative"));

// Invalid percentage
const valBadPct = validateSubjectData({
  subject_name: "Web Tech",
  lectures_conducted: 20,
  current_percentage: 120, // > 100%!
  lectures_remaining: 10,
  input_mode: "percentage",
});
assert.equal(valBadPct.isValid, false);
assert.ok(valBadPct.error.includes("between 0% and 100%"));

// Missing subject name
const valNoName = validateSubjectData({
  subject_name: "",
  lectures_conducted: 20,
  lectures_attended: 15,
  lectures_remaining: 10,
});
assert.equal(valNoName.isValid, false);
assert.ok(valNoName.error.includes("Subject name is missing"));

console.log("✓ Data Validation Tests PASSED (Catches A > C, negative values, invalid %, missing name)");

// ==========================================
// ADDITIONAL TEST: Zero Remaining Lectures (R = 0, Semester Completed)
// ==========================================
console.log("\n--- TEST: Zero Remaining Lectures (R = 0) ---");
const zeroRemainingSub = {
  subject_name: "Software Engineering",
  lectures_conducted: 40,
  lectures_attended: 32,
  lectures_remaining: 0,
  minimum_attendance: 75,
  input_mode: "counts",
};

const analysisZeroR = calculateSubjectAnalysis(zeroRemainingSub, 75);
assert.equal(analysisZeroR.isValid, true);
assert.equal(analysisZeroR.remaining, 0);
assert.equal(analysisZeroR.currentPercentage, 80);
assert.equal(analysisZeroR.maxProjected, 80);
assert.equal(analysisZeroR.minProjected, 80);
assert.equal(analysisZeroR.safeBunks, 0); // 0 remaining, so 0 safe bunks

// Simulation at 0 misses
const simZeroR = calculateSimulatedScenario(32, 40, 0, 0, 75);
assert.equal(simZeroR.simulatedPercentage, 80);
assert.equal(simZeroR.futureAttended, 0);
assert.equal(simZeroR.futureMissed, 0);
console.log("✓ Zero Remaining Lectures PASSED (Best = Worst = Current = 80%, Safe Bunks = 0)");

// ==========================================
// ADDITIONAL TEST: Multiple Subjects Isolation
// ==========================================
console.log("\n--- TEST: Multiple Subjects Isolation (No combining remaining lectures) ---");
const sub1 = {
  id: "sub-1",
  subject_name: "Subject One",
  lectures_conducted: 30,
  lectures_attended: 27, // 90%
  lectures_remaining: 10,
  minimum_attendance: 75,
};
const sub2 = {
  id: "sub-2",
  subject_name: "Subject Two",
  lectures_conducted: 20,
  lectures_attended: 12, // 60%
  lectures_remaining: 20,
  minimum_attendance: 75,
};

const ana1 = calculateSubjectAnalysis(sub1, 75);
const ana2 = calculateSubjectAnalysis(sub2, 75);

// Subject 1: C=30, A=27, R=10, T=75. total=40. ceil(0.75*40)=30. reqFuture=max(0, 30-27)=3. safe=10-3=7
assert.equal(ana1.remaining, 10);
assert.equal(ana1.safeBunks, 7);

// Subject 2: C=20, A=12, R=20, T=75. total=40. ceil(0.75*40)=30. reqFuture=max(0, 30-12)=18. safe=20-18=2
assert.equal(ana2.remaining, 20);
assert.equal(ana2.safeBunks, 2);

// Make sure remaining lectures and safe bunks are NOT combined across subjects
assert.notEqual(ana1.remaining, ana2.remaining);
assert.equal(ana1.remaining, 10);
assert.equal(ana2.remaining, 20);
console.log("✓ Multiple Subjects Isolation PASSED (Subjects remain strictly independent)");

// ==========================================
// ADDITIONAL TEST: Risk Classification Taxonomy (Deterministic Rules)
// ==========================================
console.log("\n--- TEST: Deterministic Risk Classification Taxonomy ---");

// 1. Safe: current >= target & safeBunks > 0
const statusSafe = getSubjectRiskStatus({
  currentPercentage: 80,
  maxProjected: 86.67,
  safeBunks: 7,
  conducted: 40,
  remaining: 20,
  minimumAttendance: 75,
});
assert.equal(statusSafe.key, "safe");
assert.equal(statusSafe.label, "Safe");

// 2. Warning: current < target, but recoverable (maxProjected >= target)
// e.g. Conducted = 20, Attended = 12 (60%), Remaining = 20, Target = 75%
// Max projected = (12 + 20) / 40 = 80% >= 75%
const statusWarning = getSubjectRiskStatus({
  currentPercentage: 60,
  maxProjected: 80,
  safeBunks: 2,
  conducted: 20,
  remaining: 20,
  minimumAttendance: 75,
});
assert.equal(statusWarning.key, "warning");
assert.equal(statusWarning.label, "Warning");
console.log("✓ Warning status verified for recoverable subject (60% current, 80% max potential)");

// 3. At Risk: target mathematically unreachable (maxProjected < target)
// e.g. Conducted = 40, Attended = 20 (50%), Remaining = 20, Target = 75%
// Max projected = (20 + 20) / 60 = 66.67% < 75%
const statusAtRisk = getSubjectRiskStatus({
  currentPercentage: 50,
  maxProjected: 66.67,
  safeBunks: 0,
  conducted: 40,
  remaining: 20,
  minimumAttendance: 75,
});
assert.equal(statusAtRisk.key, "at_risk");
assert.equal(statusAtRisk.label, "At Risk");
console.log("✓ At Risk status verified for unreachable subject (50% current, 66.67% max potential)");

// 4. No Buffer: current >= target but safeBunks == 0
// e.g. Conducted = 40, Attended = 30 (75%), Remaining = 0, Target = 75%
const statusNoBuffer = getSubjectRiskStatus({
  currentPercentage: 75,
  maxProjected: 75,
  safeBunks: 0,
  conducted: 40,
  remaining: 0,
  minimumAttendance: 75,
});
assert.equal(statusNoBuffer.key, "no_buffer");
assert.equal(statusNoBuffer.label, "No Buffer");
console.log("✓ No Buffer status verified for subject meeting target with 0 safe bunks");

// 5. No Data: Conducted = 0
const statusNoData = getSubjectRiskStatus({
  currentPercentage: 0,
  maxProjected: 100,
  safeBunks: 2,
  conducted: 0,
  remaining: 10,
  minimumAttendance: 75,
});
assert.equal(statusNoData.key, "no_data");
console.log("✓ Risk classification taxonomy fully verified (safe, warning, at_risk, no_buffer, no_data)");

// ==========================================
// ADDITIONAL TEST: What-If Diff From Current & Scenario Summary
// ==========================================
console.log("\n--- TEST: What-If Diff From Current & Scenario Summary ---");
// Conducted = 40, Attended = 32 (80%), Remaining = 20, Target = 75%
// 1. Simulate 0 misses (Attend All): Final % = 86.67% (+6.67% vs current)
const sim0 = calculateSimulatedScenario(32, 40, 20, 0, 75, 80);
assert.equal(sim0.simulatedPercentageFormatted, "86.67%");
assert.equal(sim0.diffFromCurrentFormatted, "+6.67%");
assert.equal(sim0.marginFormatted, "+11.67%");
assert.equal(sim0.isTargetAchievable, true);
assert.ok(sim0.summaryText.includes("You can miss 7 more lectures and still maintain 75% attendance."));

// 2. Simulate 3 misses: Safe bunks remaining = 7 - 3 = 4
const sim3 = calculateSimulatedScenario(32, 40, 20, 3, 75, 80);
assert.ok(sim3.summaryText.includes("You can miss 4 more lectures and still maintain 75% attendance."));

// 3. Simulate 7 misses (Safe Limit): Final % = 75.00% (-5.00% vs current)
const sim7 = calculateSimulatedScenario(32, 40, 20, 7, 75, 80);
assert.equal(sim7.simulatedPercentageFormatted, "75.00%");
assert.equal(sim7.diffFromCurrentFormatted, "-5.00%");
assert.equal(sim7.marginFormatted, "+0.00%");
assert.ok(sim7.summaryText.includes("You have reached your safe-bunk limit (7 misses)"));

// 4. Subject with 0 safe bunks that must attend every lecture: C = 40, A = 25, R = 20, T = 75%
// 45 - 25 = 20 needed, safeBunks = 0
const simMustAttendAll = calculateSimulatedScenario(25, 40, 20, 0, 75, 62.5);
assert.ok(simMustAttendAll.summaryText.includes("You must attend every remaining lecture to reach the required 75% percentage."));

// 5. Simulate 8 misses (Beyond Safe Limit): Final % = 73.33% (-6.67% vs current)
const sim8 = calculateSimulatedScenario(32, 40, 20, 8, 75, 80);
assert.equal(sim8.simulatedPercentageFormatted, "73.33%");
assert.equal(sim8.diffFromCurrentFormatted, "-6.67%");
assert.equal(sim8.marginFormatted, "-1.67%");
assert.equal(sim8.isTargetAchievable, true); // Still mathematically achievable if fewer missed

// 6. Impossible scenario: Conducted = 40, Attended = 20, Remaining = 20, Target = 75%
const simImpossible = calculateSimulatedScenario(20, 40, 20, 0, 75, 50);
assert.equal(simImpossible.isTargetAchievable, false);
assert.ok(simImpossible.summaryText.includes("Even with perfect attendance in the remaining lectures, you cannot reach the required 75% percentage."));
console.log("✓ What-If diff from current and summary texts verified successfully.");

console.log("\n=======================================================");
console.log("ALL TEST CASES (A THROUGH F & EXTENSIONS) PASSED PERFECTLY!");
console.log("=======================================================\n");
