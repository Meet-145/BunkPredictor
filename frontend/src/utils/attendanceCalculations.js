/**
 * attendanceCalculations.js
 * Deterministic mathematical calculations and attendance predictions for BunkPredictor.
 * Handles count-based and percentage-based inputs, edge cases, zero-lecture guards,
 * safe bunks calculation, and consecutive lectures required to recover attendance.
 */

/**
 * Calculates the maximum safe bunks a student can take out of remaining lectures R
 * while maintaining attendance at or above the required threshold T%.
 * 
 * Mathematical definition:
 * When calculating safe bunks, assume the student attends every remaining lecture
 * except the B lectures they plan to miss.
 * 
 * Final attendance:
 * 100 * (A + R - B) / (C + R)
 * 
 * Find the largest integer B satisfying:
 * 0 <= B <= R
 * 100 * (A + R - B) / (C + R) >= T
 * 
 * Reliable integer calculation:
 * requiredTotalAttended = ceil((T / 100) * (C + R))
 * requiredFutureAttended = max(0, requiredTotalAttended - A)
 * maximumSafeBunks = R - requiredFutureAttended
 * Clamped to [0, R].
 */
export function calculateSafeBunks(A, C, R, T) {
  const conducted = Math.max(0, Number(C) || 0);
  const attended = Math.max(0, Math.min(conducted, Number(A) || 0));
  const remaining = Math.max(0, Number(R) || 0);
  const target = Number(T) || 75;

  const totalFuture = conducted + remaining;
  if (totalFuture === 0 || remaining <= 0) return 0;

  // Maximum possible attendance if student attends all remaining R lectures
  const maxProjected = ((attended + remaining) / totalFuture) * 100;
  // If even attending all remaining lectures cannot reach target%, 0 safe bunks
  if (maxProjected < target - 1e-9) return 0;

  // Minimum total attended lectures across the entire semester to achieve >= target%
  // Using -1e-9 inside Math.ceil to prevent floating-point boundary errors (e.g. 45.00000000000001 -> 45)
  const requiredTotalAttended = Math.ceil((target / 100) * totalFuture - 1e-9);
  const requiredFutureAttended = Math.max(0, requiredTotalAttended - attended);
  const maxSafe = remaining - requiredFutureAttended;

  return Math.max(0, Math.min(remaining, maxSafe));
}

/**
 * Calculates the minimum number of consecutive future lectures a student must attend
 * to reach the required attendance threshold T%.
 * 
 * Formula:
 * (A + X) / (C + X) >= T / 100
 * X >= (T * C - 100 * A) / (100 - T)
 * X = Math.ceil((T * C - 100 * A) / (100 - T))
 */
export function calculateLecturesNeeded(A, C, R, T) {
  const conducted = Math.max(0, Number(C) || 0);
  const attended = Math.max(0, Math.min(conducted, Number(A) || 0));
  const target = Number(T) || 75;

  if (target >= 100) {
    // If threshold is 100%, any missed lecture makes 100% impossible unless conducted == attended
    return conducted === attended ? 0 : Infinity;
  }

  if (conducted === 0) {
    return 0;
  }

  const currentPercent = (attended / conducted) * 100;
  if (currentPercent >= target - 1e-9) {
    return 0;
  }

  const numerator = target * conducted - 100 * attended;
  const denominator = 100 - target;

  if (denominator <= 0) return Infinity;

  const needed = Math.ceil((numerator - 1e-9) / denominator);
  return Math.max(0, needed);
}

/**
 * Determines attendance status and badge configuration.
 * - Safe: attendance >= T + 5%
 * - Near the threshold: T <= attendance < T + 5%
 * - Below the required attendance: attendance < T
 */
export function getAttendanceStatus(percentage, targetThreshold = 75, warningBuffer = 5) {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return {
      key: "no_data",
      label: "No Lectures Yet",
      badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
      color: "slate",
      progressClass: "bg-slate-500",
    };
  }

  const safeThreshold = targetThreshold + warningBuffer;

  if (percentage >= safeThreshold - 1e-9) {
    return {
      key: "safe",
      label: "Safe",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      color: "emerald",
      progressClass: "bg-gradient-to-r from-emerald-500 to-teal-400",
    };
  } else if (percentage >= targetThreshold - 1e-9) {
    return {
      key: "near_threshold",
      label: "Near Threshold",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      color: "amber",
      progressClass: "bg-gradient-to-r from-amber-500 to-yellow-400",
    };
  } else {
    return {
      key: "below_threshold",
      label: "Below Target",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      color: "rose",
      progressClass: "bg-gradient-to-r from-rose-500 to-red-400",
    };
  }
}

/**
 * Determines transparent, deterministic subject risk status:
 * - At Risk: Required attendance is mathematically impossible even with 100% attendance in remaining lectures (maxProjected < T).
 * - Warning: Current attendance is below requirement, but can recover if enough remaining lectures are attended (current < T and maxProjected >= T).
 * - No Buffer: Current attendance meets requirement (current >= T), but 0 safe bunks available (any miss drops below T).
 * - Safe: Current attendance meets requirement (current >= T) and student has safe-bunk capacity (safeBunks > 0).
 */
export function getSubjectRiskStatus({
  currentPercentage,
  maxProjected,
  safeBunks,
  conducted,
  remaining,
  minimumAttendance = 75,
}) {
  if (conducted === 0) {
    return {
      key: "no_data",
      label: remaining > 0 ? "No Attendance Yet" : "No Lectures Yet",
      badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
      color: "slate",
      progressClass: "bg-slate-500",
      description:
        remaining > 0
          ? "No lectures conducted yet."
          : "No lectures recorded or scheduled yet.",
    };
  }

  // 1. At Risk: Mathematically impossible to reach requirement even with 100% attendance in remaining lectures
  if (conducted + remaining > 0 && maxProjected < minimumAttendance - 1e-9) {
    return {
      key: "at_risk",
      label: "At Risk",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      color: "rose",
      progressClass: "bg-gradient-to-r from-rose-500 to-red-400",
      description: "Required attendance is mathematically unreachable with remaining lectures.",
    };
  }

  // 2. Warning: Currently below requirement, but can recover if enough remaining lectures are attended
  if (conducted > 0 && currentPercentage < minimumAttendance - 1e-9) {
    return {
      key: "warning",
      label: "Warning",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      color: "amber",
      progressClass: "bg-gradient-to-r from-amber-500 to-yellow-400",
      description: "Currently below requirement, but can recover if future lectures are attended.",
    };
  }

  // 3. No Buffer: At or above requirement, but 0 safe bunks available (any missed lecture drops below requirement)
  if (safeBunks <= 0) {
    return {
      key: "no_buffer",
      label: "No Buffer",
      badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      color: "orange",
      progressClass: "bg-gradient-to-r from-orange-500 to-amber-400",
      description: "Meets requirement, but has 0 safe bunks left.",
    };
  }

  // 4. Safe: At or above requirement and has safe-bunk capacity
  return {
    key: "safe",
    label: "Safe",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    color: "emerald",
    progressClass: "bg-gradient-to-r from-emerald-500 to-teal-400",
    description: "Meets requirement with safe bunks available.",
  };
}

/**
 * Validates a subject data object to ensure consistency and prevent calculation errors.
 * Returns { isValid: boolean, error: string | null }
 */
export function validateSubjectData(subject) {
  if (!subject || typeof subject !== "object") {
    return { isValid: false, error: "Subject data is missing or corrupted." };
  }

  const name = subject.subject_name ? String(subject.subject_name).trim() : "";
  if (!name) {
    return { isValid: false, error: "Subject name is missing." };
  }

  const conducted = Number(subject.lectures_conducted);
  if (isNaN(conducted) || conducted < 0) {
    return { isValid: false, error: "Conducted lectures must be a non-negative number." };
  }

  const remaining = Number(subject.lectures_remaining);
  if (isNaN(remaining) || remaining < 0) {
    return { isValid: false, error: "Remaining lectures must be a non-negative number." };
  }

  const inputMode = subject.input_mode || "counts";
  if (inputMode === "percentage") {
    const pct = Number(subject.current_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return { isValid: false, error: "Attendance percentage must be between 0% and 100%." };
    }
  } else {
    const attended = Number(subject.lectures_attended);
    if (isNaN(attended) || attended < 0) {
      return { isValid: false, error: "Attended lectures must be a non-negative number." };
    }
    if (attended > conducted) {
      return {
        isValid: false,
        error: `Inconsistent data: Attended lectures (${attended}) cannot exceed conducted lectures (${conducted}).`,
      };
    }
  }

  const min = Number(subject.minimum_attendance);
  if (
    subject.minimum_attendance !== undefined &&
    subject.minimum_attendance !== null &&
    (isNaN(min) || min < 1 || min > 100)
  ) {
    return { isValid: false, error: "Required attendance threshold must be between 1% and 100%." };
  }

  return { isValid: true, error: null };
}

/**
 * Computes deterministic predictions and analysis for a single subject.
 */
export function calculateSubjectAnalysis(subject, defaultMinimum = 75) {
  const validation = validateSubjectData(subject);

  if (!validation.isValid) {
    const conducted = Number(subject?.lectures_conducted);
    const attended = Number(subject?.lectures_attended);
    const remaining = Number(subject?.lectures_remaining);
    const minimum = Number(subject?.minimum_attendance) || defaultMinimum;

    return {
      conducted: !isNaN(conducted) ? conducted : 0,
      attended: !isNaN(attended) ? attended : 0,
      remaining: !isNaN(remaining) ? remaining : 0,
      totalSemesterLectures: 0,
      minimumAttendance: minimum,
      currentPercentage: 0,
      currentPercentageFormatted: "—",
      maxProjected: 0,
      maxProjectedFormatted: "—",
      minProjected: 0,
      minProjectedFormatted: "—",
      safeBunks: 0,
      lecturesNeeded: 0,
      isRecoverable: false,
      isImpossible: true,
      status: {
        key: "invalid",
        label: "Data Review",
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        color: "amber",
        progressClass: "bg-amber-500",
        description: validation.error,
      },
      isApproximate: false,
      isBelowThreshold: true,
      isValid: false,
      validationError: validation.error,
    };
  }

  const conducted = Math.max(0, Number(subject.lectures_conducted) || 0);
  const remaining = Math.max(0, Number(subject.lectures_remaining) || 0);
  const minimum = Number(subject.minimum_attendance) || defaultMinimum;
  const inputMode = subject.input_mode || "counts";

  let attended = 0;
  let currentPercentage = 0;
  let isApproximate = false;

  if (inputMode === "percentage") {
    // Percentage input: preserve the user's entered percentage exactly
    currentPercentage = Math.min(100, Math.max(0, Number(subject.current_percentage) || 0));
    // Calculate approximate attended lectures for prediction calculations
    attended = Math.min(conducted, Math.round((currentPercentage * conducted) / 100));
    isApproximate = true;
  } else {
    // Count input: user entered conducted and attended
    attended = Math.min(conducted, Math.max(0, Number(subject.lectures_attended) || 0));
    currentPercentage = conducted > 0 ? (attended / conducted) * 100 : 0;
    isApproximate = false;
  }

  const totalSemesterLectures = conducted + remaining;

  // Max Projected (if all remaining lectures are attended)
  const maxProjected =
    totalSemesterLectures > 0 ? ((attended + remaining) / totalSemesterLectures) * 100 : 0;

  // Min Projected (if all remaining lectures are missed)
  const minProjected =
    totalSemesterLectures > 0 ? (attended / totalSemesterLectures) * 100 : 0;

  // Safe bunks using exact integer formula
  const safeBunks = calculateSafeBunks(attended, conducted, remaining, minimum);

  // Consecutive lectures needed if below threshold
  const lecturesNeeded = calculateLecturesNeeded(attended, conducted, remaining, minimum);

  // Clearly indicate if reaching target is mathematically impossible with remaining lectures
  const isImpossible = totalSemesterLectures > 0 && maxProjected < minimum - 1e-9;
  const isRecoverable = !isImpossible;

  // Deterministic risk status
  const status = (conducted > 0 || remaining > 0)
    ? getSubjectRiskStatus({
        currentPercentage,
        maxProjected,
        safeBunks,
        conducted,
        remaining,
        minimumAttendance: minimum,
      })
    : getSubjectRiskStatus({
        currentPercentage: 0,
        maxProjected: 0,
        safeBunks: 0,
        conducted: 0,
        remaining: 0,
        minimumAttendance: minimum,
      });

  return {
    conducted,
    attended,
    remaining,
    totalSemesterLectures,
    minimumAttendance: minimum,
    currentPercentage,
    currentPercentageFormatted: conducted > 0 ? `${currentPercentage.toFixed(2)}%` : "0.00%",
    maxProjected,
    maxProjectedFormatted: `${maxProjected.toFixed(2)}%`,
    minProjected,
    minProjectedFormatted: `${minProjected.toFixed(2)}%`,
    safeBunks,
    lecturesNeeded,
    isRecoverable,
    isImpossible,
    status,
    isApproximate,
    isBelowThreshold: conducted > 0 && currentPercentage < minimum - 1e-9,
    isValid: true,
    validationError: null,
  };
}

/**
 * Calculates weighted overall attendance across all subjects.
 * Formula: (sum of lectures attended across subjects / sum of lectures conducted across subjects) * 100
 * Handles zero conducted safely.
 */
export function calculateOverallAttendance(subjects, defaultMinimum = 75) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return {
      totalConducted: 0,
      totalAttended: 0,
      totalRemaining: 0,
      overallPercentage: null,
      overallPercentageFormatted: "—",
      status: getAttendanceStatus(null, defaultMinimum),
      subjectsCount: 0,
      safeCount: 0,
      nearCount: 0,
      belowCount: 0,
    };
  }

  let totalConducted = 0;
  let totalAttended = 0;
  let totalRemaining = 0;
  let safeCount = 0;
  let nearCount = 0;
  let belowCount = 0;

  for (const sub of subjects) {
    const analysis = calculateSubjectAnalysis(sub, defaultMinimum);
    totalConducted += analysis.conducted;
    totalAttended += analysis.attended;
    totalRemaining += analysis.remaining;

    if (analysis.status.key === "safe") {
      safeCount++;
    } else if (
      analysis.status.key === "warning" ||
      analysis.status.key === "near_threshold" ||
      analysis.status.key === "no_buffer"
    ) {
      nearCount++;
    } else if (
      analysis.status.key === "at_risk" ||
      analysis.status.key === "below_threshold"
    ) {
      belowCount++;
    }
  }

  const overallPercentage =
    totalConducted > 0 ? (totalAttended / totalConducted) * 100 : null;

  return {
    totalConducted,
    totalAttended,
    totalRemaining,
    overallPercentage,
    overallPercentageFormatted:
      overallPercentage !== null ? `${overallPercentage.toFixed(2)}%` : "—",
    status: getAttendanceStatus(overallPercentage, defaultMinimum),
    subjectsCount: subjects.length,
    safeCount,
    nearCount,
    belowCount,
  };
}

/**
 * Calculates simulated attendance if the student misses 'missedCount' future lectures out of 'remaining'.
 * 
 * Formula:
 * futureAttended = max(0, remaining - missedCount)
 * simulatedAttended = attended + futureAttended
 * totalSemesterLectures = conducted + remaining
 * simulatedPercentage = (simulatedAttended / totalSemesterLectures) * 100
 */
export function calculateSimulatedScenario(
  attended,
  conducted,
  remaining,
  missedCount,
  minimumAttendance = 75,
  currentPercentage = null
) {
  const total = conducted + remaining;
  const currentPct = currentPercentage !== null
    ? currentPercentage
    : (conducted > 0 ? (attended / conducted) * 100 : 0);

  if (total === 0) {
    return {
      simulatedPercentage: 0,
      simulatedPercentageFormatted: "0.00%",
      status: getAttendanceStatus(null, minimumAttendance),
      futureAttended: 0,
      futureMissed: 0,
      simulatedAttended: 0,
      totalSemesterLectures: 0,
      isAboveTarget: false,
      isTargetAchievable: false,
      margin: 0,
      marginFormatted: "+0.00%",
      diffFromCurrent: 0,
      diffFromCurrentFormatted: "+0.00%",
      summaryText: "No lectures recorded or scheduled.",
    };
  }

  const safeM = Math.max(0, Math.min(remaining, Math.round(Number(missedCount) || 0)));
  const futureAttended = remaining - safeM;
  const simulatedAttended = attended + futureAttended;
  const simulatedPercentage = (simulatedAttended / total) * 100;
  const maxPossible = ((attended + remaining) / total) * 100;
  const isTargetAchievable = maxPossible >= minimumAttendance - 1e-9;
  const safeBunks = calculateSafeBunks(attended, conducted, remaining, minimumAttendance);

  const status = getAttendanceStatus(simulatedPercentage, minimumAttendance);
  const margin = simulatedPercentage - minimumAttendance;
  const diffFromCurrent = conducted > 0 ? simulatedPercentage - currentPct : 0;

  // Plain-English scenario summary
  let summaryText = "";
  if (!isTargetAchievable) {
    summaryText = `Even with perfect attendance in the remaining lectures, you cannot reach the required ${minimumAttendance}% percentage.`;
  } else if (simulatedPercentage < minimumAttendance - 1e-9) {
    const deficit = minimumAttendance - simulatedPercentage;
    summaryText = `Missing ${safeM} ${safeM === 1 ? "lecture" : "lectures"} causes attendance to drop to ${simulatedPercentage.toFixed(2)}%, which is ${deficit.toFixed(2)}% below the ${minimumAttendance}% requirement.`;
  } else {
    // Target met or exceeded in this simulation
    const remainingSafeBunks = Math.max(0, safeBunks - safeM);
    if (remainingSafeBunks > 0) {
      summaryText = `You can miss ${remainingSafeBunks} more ${remainingSafeBunks === 1 ? "lecture" : "lectures"} and still maintain ${minimumAttendance}% attendance.`;
    } else if (safeBunks === 0) {
      summaryText = `You must attend every remaining lecture to reach the required ${minimumAttendance}% percentage.`;
    } else {
      summaryText = `You have reached your safe-bunk limit (${safeBunks} misses). You cannot miss any further lectures without dropping below ${minimumAttendance}%.`;
    }
  }

  return {
    simulatedPercentage,
    simulatedPercentageFormatted: `${simulatedPercentage.toFixed(2)}%`,
    status,
    futureAttended,
    futureMissed: safeM,
    simulatedAttended,
    totalSemesterLectures: total,
    isAboveTarget: simulatedPercentage >= minimumAttendance - 1e-9,
    isTargetAchievable,
    margin,
    marginFormatted: `${margin >= 0 ? "+" : ""}${margin.toFixed(2)}%`,
    diffFromCurrent,
    diffFromCurrentFormatted: `${diffFromCurrent >= 0 ? "+" : ""}${diffFromCurrent.toFixed(2)}%`,
    summaryText,
  };
}

/**
 * Generates an array of attendance scenarios for visual comparison:
 * - Best Case (Miss 0)
 * - Safe Bunk Limit (Miss B)
 * - Custom Simulation (Miss m)
 * - Worst Case (Miss all R)
 */
export function generateScenarioComparison(analysis, simulatedMisses) {
  const {
    attended,
    conducted,
    remaining,
    minimumAttendance,
    safeBunks,
    maxProjected,
    minProjected,
    currentPercentage,
  } = analysis;

  const sim = calculateSimulatedScenario(
    attended,
    conducted,
    remaining,
    simulatedMisses,
    minimumAttendance,
    currentPercentage
  );

  const scenarios = [
    {
      id: "best_case",
      title: "Best Case",
      description: remaining > 0 ? `Attend all ${remaining} remaining lectures` : "All lectures conducted",
      missed: 0,
      attended: remaining,
      percentage: maxProjected,
      percentageFormatted: `${maxProjected.toFixed(2)}%`,
      status: getAttendanceStatus(maxProjected, minimumAttendance),
      badgeText: "Maximum Possible",
    },
    {
      id: "safe_limit",
      title: "Safe Bunk Limit",
      description:
        safeBunks > 0
          ? `Miss up to ${safeBunks} safe lectures`
          : analysis.isImpossible
          ? "Target unreachable"
          : "0 safe bunks available",
      missed: safeBunks,
      attended: remaining - safeBunks,
      percentage:
        conducted + remaining > 0
          ? ((attended + (remaining - safeBunks)) / (conducted + remaining)) * 100
          : 0,
      percentageFormatted:
        conducted + remaining > 0
          ? `${(((attended + (remaining - safeBunks)) / (conducted + remaining)) * 100).toFixed(2)}%`
          : "0.00%",
      status: getAttendanceStatus(
        conducted + remaining > 0
          ? ((attended + (remaining - safeBunks)) / (conducted + remaining)) * 100
          : 0,
        minimumAttendance
      ),
      badgeText: safeBunks > 0 ? "Target Buffer" : analysis.isImpossible ? "At Risk" : "No Buffer",
    },
    {
      id: "simulated",
      title: "Your Simulation",
      description: `Simulating ${sim.futureMissed} future ${sim.futureMissed === 1 ? "miss" : "misses"}`,
      missed: sim.futureMissed,
      attended: sim.futureAttended,
      percentage: sim.simulatedPercentage,
      percentageFormatted: sim.simulatedPercentageFormatted,
      status: sim.status,
      badgeText: "Current Plan",
    },
    {
      id: "worst_case",
      title: "Worst Case",
      description: remaining > 0 ? `Miss all ${remaining} remaining lectures` : "All lectures conducted",
      missed: remaining,
      attended: 0,
      percentage: minProjected,
      percentageFormatted: `${minProjected.toFixed(2)}%`,
      status: getAttendanceStatus(minProjected, minimumAttendance),
      badgeText: "Minimum Floor",
    },
  ];

  return { sim, scenarios };
}

