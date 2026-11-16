import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BrainCircuit,
  Sliders,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  RotateCcw,
  Search,
} from "lucide-react";

import {
  loadAttendanceSubjects,
  loadAttendanceSettings,
  STORAGE_KEY_SUBJECTS,
  STORAGE_KEY_SETTINGS,
  EVENT_SUBJECTS_UPDATED,
  EVENT_SETTINGS_UPDATED,
  EVENT_DATA_RESET,
} from "../services/attendanceStorage";

import {
  calculateSubjectAnalysis,
  generateScenarioComparison,
} from "../utils/attendanceCalculations";

import {
  loadStudentProfile,
  loadTimetableForPredictions,
  predictUpcomingLectures,
  getModelInfo,
  DEFAULT_STUDENT_PROFILE,
} from "../services/predictionApi";

import UpcomingLecturesCard from "../components/predictions/UpcomingLecturesCard";
import StudentProfileModal from "../components/predictions/StudentProfileModal";

export default function Predictions({ setActivePage }) {
  // Active Center View: 'simulator' (Forecast & Safe Bunks), 'upcoming' (Upcoming Lecture Predictions)
  const [activeTab, setActiveTab] = useState("simulator");

  // Load data from versioned localStorage (Single Source of Truth)
  const [subjects, setSubjects] = useState(() => loadAttendanceSubjects());
  const [settings, setSettings] = useState(() => loadAttendanceSettings());

  // Selected subject ID (defaults to first subject, or null if no subjects exist)
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => {
    const subs = loadAttendanceSubjects();
    return subs.length > 0 ? subs[0].id : null;
  });

  // Number of future lectures the user plans to miss
  const [simulatedMisses, setSimulatedMisses] = useState(0);

  // Toggle for ML Model Diagnostic Report
  const [showMlReport, setShowMlReport] = useState(false);

  // Table search, status filter, and sorting state
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState("all");
  const [tableSortBy, setTableSortBy] = useState("lowest_attendance");

  // ==========================================
  // ML PREDICTION STATE (FEATURES 1, 2, 3)
  // ==========================================
  const [timetableLectures, setTimetableLectures] = useState(() => loadTimetableForPredictions());
  // Default to benchmark S001 profile so user gets immediate valid predictions, while allowing edits
  const [studentProfile, setStudentProfile] = useState(() => loadStudentProfile() || DEFAULT_STUDENT_PROFILE);
  const [upcomingPredictions, setUpcomingPredictions] = useState([]);
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(false);
  const [upcomingError, setUpcomingError] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);

  // Live Updates: Listen for storage events (cross-tab), custom storage events (same-tab), and focus
  useEffect(() => {
    const refreshData = () => {
      const refreshedSubjects = loadAttendanceSubjects();
      const refreshedSettings = loadAttendanceSettings();
      const refreshedTimetable = loadTimetableForPredictions();
      const refreshedProfile = loadStudentProfile();

      setSubjects(refreshedSubjects);
      setSettings(refreshedSettings);
      setTimetableLectures(refreshedTimetable);
      if (refreshedProfile) {
        setStudentProfile(refreshedProfile);
      }

      setSelectedSubjectId((prevId) => {
        if (!refreshedSubjects || refreshedSubjects.length === 0) return null;
        const exists = refreshedSubjects.some((s) => s.id === prevId);
        return exists ? prevId : refreshedSubjects[0].id;
      });
    };

    const handleStorageEvent = (e) => {
      if (
        !e.key ||
        e.key === STORAGE_KEY_SUBJECTS ||
        e.key === STORAGE_KEY_SETTINGS
      ) {
        refreshData();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener(EVENT_SUBJECTS_UPDATED, refreshData);
    window.addEventListener(EVENT_SETTINGS_UPDATED, refreshData);
    window.addEventListener(EVENT_DATA_RESET, refreshData);
    window.addEventListener("focus", refreshData);

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener(EVENT_SUBJECTS_UPDATED, refreshData);
      window.removeEventListener(EVENT_SETTINGS_UPDATED, refreshData);
      window.removeEventListener(EVENT_DATA_RESET, refreshData);
      window.removeEventListener("focus", refreshData);
    };
  }, []);

  // Fetch ML Model Info on mount
  useEffect(() => {
    let isMounted = true;
    getModelInfo().then((info) => {
      if (isMounted) setModelInfo(info);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch upcoming lecture predictions
  const fetchPredictions = useCallback(() => {
    if (!timetableLectures || timetableLectures.length === 0) {
      setUpcomingPredictions([]);
      return;
    }

    setIsLoadingUpcoming(true);
    setUpcomingError(null);

    predictUpcomingLectures({
      lectures: timetableLectures,
      attendanceRecords: subjects,
      studentProfile: studentProfile,
    })
      .then((res) => {
        if (res && Array.isArray(res.predictions)) {
          setUpcomingPredictions(res.predictions);
        } else {
          setUpcomingPredictions([]);
        }
      })
      .catch((err) => {
        console.warn("Prediction fetch error:", err);
        setUpcomingError(err.message || "Failed to connect to ML prediction service.");
      })
      .finally(() => {
        setIsLoadingUpcoming(false);
      });
  }, [timetableLectures, subjects, studentProfile]);

  useEffect(() => {
    let ignore = false;
    predictUpcomingLectures({
      lectures: timetableLectures,
      attendanceRecords: subjects,
      studentProfile: studentProfile,
    })
      .then((res) => {
        if (!ignore && res && Array.isArray(res.predictions)) {
          setUpcomingPredictions(res.predictions);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setUpcomingError(err.message || "Failed to connect to ML prediction service.");
        }
      });
    return () => {
      ignore = true;
    };
  }, [timetableLectures, subjects, studentProfile]);

  // Active subject object (null if no subjects exist)
  const activeSubject = useMemo(() => {
    if (!subjects || subjects.length === 0) return null;
    const found = subjects.find((s) => s.id === selectedSubjectId);
    return found || subjects[0] || null;
  }, [selectedSubjectId, subjects]);

  // Subject deterministic analysis using actual values
  const analysis = useMemo(() => {
    if (!activeSubject) return null;
    return calculateSubjectAnalysis(activeSubject, settings.minimumAttendance);
  }, [activeSubject, settings.minimumAttendance]);

  // Clamp simulation misses to valid range [0, remaining]
  const maxRemaining = analysis?.isValid ? Math.max(0, analysis.remaining) : 0;
  const effectiveSimulatedMisses = Math.min(simulatedMisses, maxRemaining);

  // Handle switching subjects cleanly
  const handleSelectSubject = (id) => {
    setSelectedSubjectId(id);
    setSimulatedMisses(0);
  };

  // Simulation & scenario comparisons
  const scenarioData = useMemo(() => {
    if (!analysis || !analysis.isValid) return null;
    return generateScenarioComparison(analysis, effectiveSimulatedMisses);
  }, [analysis, effectiveSimulatedMisses]);

  const sim = scenarioData?.sim;
  const scenarios = scenarioData?.scenarios || [];

  // Pre-calculate deterministic analysis for all enrolled subjects
  const analyzedSubjects = useMemo(() => {
    return subjects.map((sub) => {
      const subAnalysis = calculateSubjectAnalysis(sub, settings.minimumAttendance);
      return {
        subject: sub,
        analysis: subAnalysis,
      };
    });
  }, [subjects, settings.minimumAttendance]);

  // Filter and sort for the comparison table
  const filteredAndSortedSubjects = useMemo(() => {
    let result = [...analyzedSubjects];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      result = result.filter(
        ({ subject }) =>
          (subject.subject_name && subject.subject_name.toLowerCase().includes(q)) ||
          (subject.subject_code && subject.subject_code.toLowerCase().includes(q))
      );
    }

    if (tableStatusFilter !== "all") {
      result = result.filter(({ analysis: a }) => a.status?.key === tableStatusFilter);
    }

    result.sort((a, b) => {
      if (tableSortBy === "lowest_attendance") {
        const valA = a.analysis.isValid ? a.analysis.currentPercentage : 999;
        const valB = b.analysis.isValid ? b.analysis.currentPercentage : 999;
        return valA - valB;
      }
      if (tableSortBy === "highest_attendance") {
        const valA = a.analysis.isValid ? a.analysis.currentPercentage : -1;
        const valB = b.analysis.isValid ? b.analysis.currentPercentage : -1;
        return valB - valA;
      }
      if (tableSortBy === "safe_bunks_asc") {
        const valA = a.analysis.isValid ? a.analysis.safeBunks : 999;
        const valB = b.analysis.isValid ? b.analysis.safeBunks : 999;
        return valA - valB;
      }
      if (tableSortBy === "remaining_desc") {
        return (b.analysis.remaining || 0) - (a.analysis.remaining || 0);
      }
      if (tableSortBy === "name_asc") {
        return (a.subject.subject_name || "").localeCompare(b.subject.subject_name || "");
      }
      return 0;
    });

    return result;
  }, [analyzedSubjects, tableSearch, tableStatusFilter, tableSortBy]);

  return (
    <div className="space-y-7 pb-14 text-slate-100">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
              <BrainCircuit size={22} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Prediction Center
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Attendance forecasting, safe-bunk simulations, and individual upcoming lecture ML predictions.
          </p>
        </div>

        {/* Global Controls & Status Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2 text-xs text-slate-300">
            <ShieldCheck size={14} className="text-violet-400" />
            <span>Target: &ge; {settings.minimumAttendance}%</span>
          </div>

          <button
            type="button"
            onClick={() => setShowMlReport((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3.5 py-2 text-xs font-medium text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
          >
            <Cpu size={14} />
            <span>Model Details</span>
            {showMlReport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 2. Top-Level Section Navigation Tabs */}
      <div className="flex rounded-2xl bg-[#12121D] p-1.5 border border-white/10 shadow-lg text-xs font-semibold gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 transition cursor-pointer ${
            activeTab === "simulator"
              ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sliders size={15} />
          <span>Subject Forecast &amp; Safe Bunks</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 transition cursor-pointer ${
            activeTab === "upcoming"
              ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles size={15} />
          <span>My Upcoming Lecture Predictions</span>
          {upcomingPredictions.length > 0 && (
            <span className="rounded-full bg-violet-400/20 border border-violet-400/30 px-2 py-0.5 text-[10px] text-violet-200">
              {upcomingPredictions.length}
            </span>
          )}
        </button>
      </div>

      {/* 3. SECTION 1: UPCOMING LECTURE PREDICTIONS (FEATURES 1 & 3) */}
      {activeTab === "upcoming" && (
        <UpcomingLecturesCard
          predictions={upcomingPredictions}
          isLoading={isLoadingUpcoming}
          error={upcomingError}
          studentProfile={studentProfile}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onRefresh={fetchPredictions}
          totalLecturesCount={timetableLectures.length}
        />
      )}

      {/* 4. SECTION 2: SUBJECT FORECAST & SAFE BUNKS (EXISTING ENGINE) */}
      {activeTab === "simulator" && (
        <>
          {subjects.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#12121D] p-8 sm:p-12 text-center shadow-xl space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
                <BrainCircuit size={32} />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  No Attendance Data Found
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Prediction Center calculates safe bunks and attendance projections using your actual subjects and attendance records.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  To begin, please add your subjects and enter your attendance details in the Attendance Tracker.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setActivePage && setActivePage("attendance")}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/25 cursor-pointer"
                >
                  <span>Open Attendance Tracker</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Subject Selector Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#12121D] p-3.5 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Select Subject:
                  </span>
                  <select
                    value={activeSubject ? activeSubject.id : ""}
                    onChange={(e) => handleSelectSubject(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#161622] px-3.5 py-1.5 text-xs font-semibold text-white focus:border-violet-500 focus:outline-none cursor-pointer"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.subject_name} {sub.subject_code ? `(${sub.subject_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {subjects.map((sub) => {
                    const isSelected = activeSubject && sub.id === activeSubject.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectSubject(sub.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition shrink-0 cursor-pointer ${
                          isSelected
                            ? "bg-violet-600 text-white shadow"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        {sub.subject_code || sub.subject_name.slice(0, 10)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Prediction & Simulation Engine */}
              {activeSubject && analysis && (
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Left Column: Interactive Simulator (7 Cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-xl space-y-6">
                      {/* Subject Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Target Subject
                          </span>
                          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                            {activeSubject.subject_name}
                          </h2>
                          {activeSubject.subject_code && (
                            <span className="inline-block mt-1 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                              {activeSubject.subject_code}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Current Status
                          </span>
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${analysis.status.badgeClass}`}
                            >
                              {analysis.status.key === "safe" && <ShieldCheck size={13} />}
                              {analysis.status.key === "no_buffer" && <AlertTriangle size={13} />}
                              {analysis.status.key === "warning" && <AlertTriangle size={13} />}
                              {analysis.status.key === "at_risk" && <TrendingDown size={13} />}
                              {analysis.status.key === "no_data" && <Info size={13} />}
                              <span>{analysis.status.label}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Validation Error Callout if Data is Inconsistent */}
                      {!analysis.isValid ? (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold text-white">
                                Inconsistent Attendance Data
                              </h3>
                              <p className="text-xs text-amber-200 leading-relaxed">
                                {analysis.validationError}
                              </p>
                              <p className="text-xs text-slate-400 pt-1 leading-relaxed">
                                Simulation controls are disabled to prevent invalid calculations. Your saved data remains unchanged. Please update this subject in Attendance Tracker.
                              </p>
                            </div>
                          </div>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setActivePage && setActivePage("attendance")}
                              className="flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer"
                            >
                              <span>Fix in Attendance Tracker</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Current Figures Metric Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="rounded-xl border border-white/5 bg-[#161622] p-3">
                              <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                Current %
                              </span>
                              <span className="mt-1 block text-xl font-extrabold text-white">
                                {analysis.currentPercentageFormatted}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {analysis.conducted > 0
                                  ? `${analysis.attended} of ${analysis.conducted}${analysis.isApproximate ? " (approx)" : ""}`
                                  : "0 lectures"}
                              </span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-[#161622] p-3">
                              <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                Remaining
                              </span>
                              <span className="mt-1 block text-xl font-bold text-indigo-300">
                                {analysis.remaining}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Lectures left
                              </span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-[#161622] p-3">
                              <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                Required
                              </span>
                              <span className="mt-1 block text-xl font-bold text-violet-300">
                                {analysis.minimumAttendance}%
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Criteria floor
                              </span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-[#161622] p-3">
                              <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                Safe Bunks
                              </span>
                              <span
                                className={`mt-1 block text-xl font-bold ${
                                  analysis.safeBunks > 0 ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                {analysis.safeBunks}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {analysis.safeBunks > 0 ? "Safe to miss" : "No buffer"}
                              </span>
                            </div>
                          </div>

                          {/* Zero Remaining Lectures Alert (Semester Completed) */}
                          {analysis.remaining === 0 && analysis.conducted > 0 && (
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 text-xs text-indigo-200 flex items-start gap-2.5">
                              <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-indigo-300 block">
                                  Semester Completed (0 Remaining Lectures)
                                </span>
                                <span className="text-[11px] text-slate-300 mt-0.5 block leading-relaxed">
                                  All lectures for this subject have already been conducted. Best-case and worst-case attendance are both fixed at {analysis.currentPercentageFormatted}, and safe bunks are 0.
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Interactive Slider Section */}
                          <div className="space-y-4 rounded-2xl border border-white/5 bg-[#161622] p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-violet-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                  Simulate Future Absences (Bunks)
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {effectiveSimulatedMisses > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSimulatedMisses(0)}
                                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Reset</span>
                                  </button>
                                )}
                                <span className="rounded-lg bg-violet-600/20 border border-violet-500/30 px-2.5 py-1 text-xs font-extrabold text-violet-300 font-mono">
                                  {effectiveSimulatedMisses} / {maxRemaining} Missed
                                </span>
                              </div>
                            </div>

                            {/* Range Input Slider */}
                            <div className="space-y-2 pt-1">
                              <input
                                type="range"
                                min="0"
                                max={maxRemaining}
                                step="1"
                                value={effectiveSimulatedMisses}
                                disabled={maxRemaining === 0}
                                onChange={(e) => setSimulatedMisses(Number(e.target.value))}
                                className="w-full h-2 rounded-lg bg-slate-800 accent-violet-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              />

                              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                <span>0 (Attend All Remaining)</span>
                                {analysis.safeBunks > 0 && analysis.safeBunks <= maxRemaining && (
                                  <span className="text-emerald-400 font-semibold">
                                    ▲ Safe Limit: {analysis.safeBunks}
                                  </span>
                                )}
                                <span>{maxRemaining} (Miss All Remaining)</span>
                              </div>
                            </div>

                            {/* Simulated Result Callout */}
                            {sim && (
                              <div
                                className={`rounded-xl border p-4 space-y-3 transition ${
                                  sim.isAboveTarget
                                    ? "border-emerald-500/30 bg-emerald-950/15"
                                    : "border-rose-500/30 bg-rose-950/15"
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                      Simulated Projected Attendance
                                    </span>
                                    <div className="flex items-baseline gap-2 mt-0.5">
                                      <span
                                        className={`text-2xl font-extrabold ${
                                          sim.isAboveTarget ? "text-emerald-400" : "text-rose-400"
                                        }`}
                                      >
                                        {sim.simulatedPercentageFormatted}
                                      </span>
                                      <span
                                        className={`text-xs font-semibold ${
                                          sim.diffFromCurrent >= 0 ? "text-emerald-400" : "text-rose-400"
                                        }`}
                                      >
                                        ({sim.diffFromCurrentFormatted} vs current)
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 block mt-0.5">
                                      {sim.simulatedAttended} of {sim.totalSemesterLectures} semester lectures attended
                                    </span>
                                  </div>

                                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                                      Status
                                    </span>
                                    <span
                                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${sim.status.badgeClass}`}
                                    >
                                      {sim.status.label}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      Margin: {sim.marginFormatted}
                                    </span>
                                  </div>
                                </div>

                                {/* Dynamic Advice Summary Text */}
                                <div className="border-t border-white/5 pt-2.5 text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                                  {sim.isAboveTarget ? (
                                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                                  )}
                                  <span>{sim.summaryText}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Projections & Scenarios (5 Cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Semester Projections Summary Card */}
                    <div className="rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-xl space-y-5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-violet-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          Semester Projections &amp; Bounds
                        </h3>
                      </div>

                      {analysis.isValid ? (
                        <div className="space-y-4 text-xs">
                          {/* Best Case (0 Misses) */}
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                Best Case (Attend All Remaining)
                              </span>
                              <span className="text-lg font-bold text-emerald-400">
                                {analysis.maxProjectedFormatted}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {analysis.conducted + analysis.remaining > 0
                                  ? `${analysis.attended + analysis.remaining} of ${analysis.conducted + analysis.remaining} lectures`
                                  : "0 lectures"}
                              </span>
                            </div>
                            <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-1 text-[11px] font-semibold">
                              Max Possible
                            </span>
                          </div>

                          {/* Worst Case (Miss All Remaining) */}
                          <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                Worst Case (Miss All Remaining)
                              </span>
                              <span className="text-lg font-bold text-rose-400">
                                {analysis.minProjectedFormatted}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {analysis.conducted + analysis.remaining > 0
                                  ? `${analysis.attended} of ${analysis.conducted + analysis.remaining} lectures`
                                  : "0 lectures"}
                              </span>
                            </div>
                            <span className="rounded bg-rose-500/20 text-rose-300 px-2 py-1 text-[11px] font-semibold">
                              Floor Level
                            </span>
                          </div>

                          {/* Recovery Deficit Indicator */}
                          {analysis.lecturesNeeded > 0 && (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-3.5 space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-amber-300 block">
                                Recovery Deficit
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                You must attend{" "}
                                <strong className="text-amber-300">{analysis.lecturesNeeded}</strong>{" "}
                                consecutive lectures to reach {analysis.minimumAttendance}%.
                                {!analysis.isRecoverable && (
                                  <span className="text-rose-400 block mt-1 font-semibold">
                                    Mathematically unreachable: Only {analysis.remaining} lectures remain.
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Projections cannot be computed for inconsistent data.
                        </p>
                      )}
                    </div>

                    {/* Pre-calculated Scenario Breakdown Cards */}
                    {scenarios.length > 0 && (
                      <div className="rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <Layers size={18} className="text-violet-400" />
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            What-If Scenario Breakdown
                          </h3>
                        </div>

                        <div className="space-y-2.5">
                          {scenarios.map((sc, i) => (
                            <div
                              key={i}
                              className={`rounded-xl border p-3 text-xs transition flex items-center justify-between ${
                                sc.isActive
                                  ? "border-violet-500/60 bg-violet-600/15 shadow"
                                  : "border-white/5 bg-[#161622] hover:border-white/10"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <span className="font-semibold text-white block">
                                  {sc.title}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {sc.description}
                                </span>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`text-sm font-bold ${
                                    sc.isAboveTarget ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                >
                                  {sc.percentageFormatted}
                                </span>
                                <span
                                  className={`block text-[10px] font-semibold ${
                                    sc.isAboveTarget ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                >
                                  {sc.status.label}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Subject Comparison & Risk Table */}
              <div className="rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Subject Attendance Risk &amp; Safe-Bunk Comparison
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deterministic comparison of all your enrolled subjects with safe-bunk buffer calculations.
                    </p>
                  </div>

                  {/* Search, Filter, Sort Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search subject..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#161622] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={tableStatusFilter}
                        onChange={(e) => setTableStatusFilter(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#161622] px-2.5 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none cursor-pointer"
                      >
                        <option value="all">All Risk Levels</option>
                        <option value="safe">Safe Only</option>
                        <option value="no_buffer">No Buffer</option>
                        <option value="warning">Warning</option>
                        <option value="at_risk">At Risk</option>
                      </select>

                      <select
                        value={tableSortBy}
                        onChange={(e) => setTableSortBy(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#161622] px-2.5 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none cursor-pointer"
                      >
                        <option value="lowest_attendance">Lowest Attendance First</option>
                        <option value="safe_bunks_asc">Fewest Safe Bunks First</option>
                        <option value="highest_attendance">Highest Attendance First</option>
                        <option value="remaining_desc">Most Remaining Lectures</option>
                        <option value="name_asc">Subject Name (A-Z)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase text-slate-400">
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-3 text-center">Conducted / Attended</th>
                        <th className="py-3 px-3 text-center">Remaining</th>
                        <th className="py-3 px-3 text-right">Current %</th>
                        <th className="py-3 px-3 text-center">Required %</th>
                        <th className="py-3 px-3 text-center">Risk Status</th>
                        <th className="py-3 px-3 text-center">Max Safe Bunks</th>
                        <th className="py-3 px-3 text-center">Best Case</th>
                        <th className="py-3 px-3 text-center">Worst Case</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {filteredAndSortedSubjects.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="py-8 text-center text-slate-400">
                            No subjects match the current search or status filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedSubjects.map(({ subject: sub, analysis: subAnalysis }) => {
                          const isSelected = activeSubject && sub.id === activeSubject.id;

                          return (
                            <tr
                              key={sub.id}
                              className={`transition ${
                                isSelected ? "bg-violet-600/10 font-semibold" : "hover:bg-white/[0.02]"
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="text-white font-semibold">{sub.subject_name}</div>
                                {sub.subject_code && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {sub.subject_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {subAnalysis.isValid ? (
                                  <>
                                    <span className="text-emerald-400">{subAnalysis.attended}</span>
                                    <span className="text-slate-500"> / </span>
                                    <span>{subAnalysis.conducted}</span>
                                  </>
                                ) : (
                                  <span className="text-amber-400 text-[11px]">
                                    {sub.lectures_attended} / {sub.lectures_conducted}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-indigo-300">
                                {sub.lectures_remaining}
                              </td>
                              <td className="py-3 px-3 text-right text-white font-bold">
                                {subAnalysis.isValid ? subAnalysis.currentPercentageFormatted : "—"}
                              </td>
                              <td className="py-3 px-3 text-center text-violet-300 font-medium">
                                {subAnalysis.minimumAttendance}%
                              </td>
                              <td className="py-3 px-3 text-center">
                                {subAnalysis.isValid ? (
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${subAnalysis.status.badgeClass}`}
                                  >
                                    {subAnalysis.status.label}
                                  </span>
                                ) : (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                                    Data Review
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {subAnalysis.isValid ? (
                                  <span
                                    className={`font-bold ${
                                      subAnalysis.safeBunks > 0 ? "text-emerald-400" : "text-amber-400"
                                    }`}
                                  >
                                    {subAnalysis.safeBunks}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-emerald-400 font-semibold">
                                {subAnalysis.isValid ? subAnalysis.maxProjectedFormatted : "—"}
                              </td>
                              <td className="py-3 px-3 text-center text-rose-400 font-semibold">
                                {subAnalysis.isValid ? subAnalysis.minProjectedFormatted : "—"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSelectSubject(sub.id)}
                                  className="text-violet-400 hover:text-violet-300 font-medium hover:underline cursor-pointer"
                                >
                                  {isSelected ? "Selected" : "Simulate \u2192"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 6. Machine Learning Model Inspection Report (Collapsible) */}
      {showMlReport && (
        <div className="rounded-2xl border border-violet-500/30 bg-[#12121D] p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-600/20 p-2.5 text-violet-400 border border-violet-500/30">
                <Cpu size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Trained ML Model Architecture &amp; Integration Details
                </h3>
                <p className="text-xs text-slate-400">
                  models/attendance_model.pkl (Random Forest Pipeline) • models/attendance_feature_columns.pkl
                </p>
              </div>
            </div>

            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Model Online: Loaded &amp; Active
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Artifact Specifications */}
            <div className="rounded-xl border border-white/5 bg-[#161622] p-4 space-y-2.5 text-xs">
              <span className="text-[10px] uppercase font-semibold text-violet-400 tracking-wider block">
                1. Model Pipeline Architecture
              </span>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Algorithm:</span>
                <span className="font-mono text-white">{modelInfo?.model_name || "RandomForestClassifier (200 trees)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Preprocessing:</span>
                <span className="font-mono text-white">ColumnTransformer (Median + OneHot)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Feature Count:</span>
                <span className="font-mono text-white">{modelInfo?.feature_count || 17} engineered features</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Probability Support:</span>
                <span className="font-semibold text-emerald-400">predict_proba() Supported</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Decision Threshold:</span>
                <span className="font-semibold text-violet-300">&ge; 60% Attendance Probability</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Target Variable:</span>
                <span className="font-semibold text-violet-300">present_label (0 = Absent, 1 = Present)</span>
              </div>
            </div>

            {/* Feature Categories */}
            <div className="rounded-xl border border-white/5 bg-[#161622] p-4 space-y-2.5 text-xs">
              <span className="text-[10px] uppercase font-semibold text-violet-400 tracking-wider block">
                2. Exact Feature Breakdown (17 Features)
              </span>
              <div className="space-y-1 text-slate-300 leading-relaxed text-[11px]">
                <div>
                  <strong className="text-indigo-300">Timetable (12):</strong> day, time_slot, subject_code, session_type, slot_number, month, week_of_semester, is_friday, is_late_lecture, is_early_lecture, is_lab, is_practical.
                </div>
                <div>
                  <strong className="text-indigo-300">Attendance History (2):</strong> prior_attendance_rate, prior_subject_attendance_rate.
                </div>
                <div>
                  <strong className="text-indigo-300">Student Profile (3):</strong> commute_time_minutes, previous_semester_attendance_pct, previous_cgpa_synthetic.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Configuration Modal */}
      <StudentProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={studentProfile}
        onSave={(newProfile) => {
          setStudentProfile(newProfile);
          void fetchPredictions();
        }}
      />
    </div>
  );
}
