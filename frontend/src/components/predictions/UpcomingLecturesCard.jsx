import { useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  Filter,
  RefreshCw,
  Sliders,
  AlertCircle,
} from "lucide-react";
import { SUBJECT_COLORS } from "../../data/sampleTimetable";

export default function UpcomingLecturesCard({
  predictions,
  isLoading,
  error,
  studentProfile,
  onOpenProfileModal,
  onRefresh,
  totalLecturesCount,
}) {
  const [filterDay, setFilterDay] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [expandedFeatureId, setExpandedFeatureId] = useState(null);

  // Tally counts across all predictions
  const stats = useMemo(() => {
    if (!predictions || predictions.length === 0) {
      return { attendCount: 0, missCount: 0, unavailableCount: 0, total: 0 };
    }
    let attendCount = 0;
    let missCount = 0;
    let unavailableCount = 0;
    predictions.forEach((p) => {
      if (p.status === "unavailable") {
        unavailableCount += 1;
      } else if (p.predicted_outcome === "Likely to Attend") {
        attendCount += 1;
      } else if (p.predicted_outcome === "Likely to Miss") {
        missCount += 1;
      }
    });
    return { attendCount, missCount, unavailableCount, total: predictions.length };
  }, [predictions]);

  // Filter predictions
  const filteredPredictions = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    return predictions.filter((p) => {
      if (filterDay !== "all" && p.day?.toLowerCase() !== filterDay.toLowerCase()) {
        return false;
      }
      if (filterOutcome === "attend" && p.predicted_outcome !== "Likely to Attend") {
        return false;
      }
      if (filterOutcome === "miss" && p.predicted_outcome !== "Likely to Miss") {
        return false;
      }
      if (filterOutcome === "unavailable" && p.status !== "unavailable") {
        return false;
      }
      return true;
    });
  }, [predictions, filterDay, filterOutcome]);

  const toggleExpand = (idx) => {
    setExpandedFeatureId((prev) => (prev === idx ? null : idx));
  };

  // Group days for quick filter pills
  const daysList = ["all", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  return (
    <div className="space-y-6">
      {/* 1. Header & Student Profile Status Banner */}
      <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-pulse"></span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                My Upcoming Lecture Predictions
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Supervised Random Forest inference predicting attendance probability for each scheduled timetable lecture.
              Classified using a <strong>60% attendance probability threshold</strong> (&ge; 60% = Likely to Attend, &lt; 60% = Likely to Miss).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3.5 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
            >
              <User size={14} />
              <span>
                {studentProfile?.student_id
                  ? `Student: ${studentProfile.student_id}`
                  : studentProfile?.commute_time_minutes
                  ? "Custom Profile"
                  : "Configure Profile"}
              </span>
              <Sliders size={12} className="text-violet-400" />
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Predictions"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#161622] p-2 text-xs text-slate-300 hover:bg-white/5 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin text-violet-400" : ""} />
            </button>
          </div>
        </div>

        {/* Profile Context Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#161622] px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Profile Source
              </span>
              <span className="font-semibold text-white">
                {studentProfile?.student_id
                  ? `Cohort ID (${studentProfile.student_id})`
                  : studentProfile?.commute_time_minutes
                  ? "User Profile"
                  : "No Profile (Features Missing)"}
              </span>
            </div>

            {studentProfile && (
              <>
                <div className="border-l border-white/10 pl-4 hidden sm:block">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Commute Time
                  </span>
                  <span className="text-slate-200">
                    {studentProfile.commute_time_minutes ?? "—"} min
                  </span>
                </div>
                <div className="border-l border-white/10 pl-4 hidden sm:block">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Prior Sem Attendance
                  </span>
                  <span className="text-slate-200">
                    {studentProfile.previous_semester_attendance_pct != null
                      ? `${studentProfile.previous_semester_attendance_pct}%`
                      : "—"}
                  </span>
                </div>
                <div className="border-l border-white/10 pl-4 hidden sm:block">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    CGPA Benchmark
                  </span>
                  <span className="text-slate-200">
                    {studentProfile.previous_cgpa_synthetic ?? "—"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!studentProfile ? (
              <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                Inference Unavailable
              </span>
            ) : (
              stats.total > 0 && (
                <>
                  <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    {stats.attendCount} Attend (&ge; 60%)
                  </span>
                  <span className="rounded-md bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
                    {stats.missCount} Miss (&lt; 60%)
                  </span>
                </>
              )
            )}
            <span className="text-[11px] text-slate-400">
              Timetable Slots: <strong className="text-white">{totalLecturesCount}</strong>
            </span>
          </div>
        </div>

        {/* Missing Profile Warning */}
        {!studentProfile && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 block">
                  Model Features Missing — Predictions Unavailable
                </span>
                <p className="mt-0.5 text-slate-300 leading-relaxed">
                  The trained Random Forest model requires student profile features (commute time, prior semester attendance %, and CGPA) alongside your timetable and attendance tracker history.
                  To ensure statistical validity, missing inputs are <strong>never fabricated</strong>.
                </p>
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition cursor-pointer"
                >
                  <Sliders size={13} />
                  <span>Connect Student Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filters & Count Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Day Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {daysList.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilterDay(d)}
              className={`rounded-lg px-3 py-1.5 font-medium transition shrink-0 cursor-pointer ${
                filterDay === d
                  ? "bg-violet-600 text-white shadow"
                  : "bg-[#12121D] border border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {d === "all" ? "All Days" : d}
            </button>
          ))}
        </div>

        {/* Outcome Filter */}
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-400" />
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#161622] px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Outcomes ({stats.total})</option>
            <option value="attend">Likely to Attend ({stats.attendCount})</option>
            <option value="miss">Likely to Miss ({stats.missCount})</option>
            {stats.unavailableCount > 0 && (
              <option value="unavailable">Unavailable Only ({stats.unavailableCount})</option>
            )}
          </select>
        </div>
      </div>

      {/* 3. Error Callout */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-rose-300 block">Prediction Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 4. Upcoming Lecture Cards List */}
      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-[#12121D] p-12 text-center text-slate-400 space-y-3">
          <RefreshCw size={28} className="animate-spin text-violet-400 mx-auto" />
          <p className="text-sm font-medium text-white">Running ML inference pipeline...</p>
          <p className="text-xs text-slate-500">
            Evaluating Random Forest probability models across your timetable schedule.
          </p>
        </div>
      ) : filteredPredictions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#12121D] p-10 text-center text-slate-400 space-y-3">
          <CalendarDays size={32} className="text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-white">No lectures match the active filter</p>
          <p className="text-xs text-slate-500">
            {totalLecturesCount === 0
              ? "Your timetable is currently empty. Please import or add lectures in Timetable Management."
              : "Try switching days or outcome filters to see other scheduled lectures."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPredictions.map((lecture, idx) => {
            const isAvailable = lecture.status === "available";
            const isAttend = lecture.predicted_outcome === "Likely to Attend";
            const isExpanded = expandedFeatureId === idx;
            const attendProb = lecture.attendance_probability ?? 0;
            const missProb = lecture.absence_probability ?? 0;

            const badgeColor =
              SUBJECT_COLORS[lecture.subject_code]?.badge ||
              SUBJECT_COLORS.DEFAULT.badge;

            return (
              <div
                key={lecture.id || idx}
                className="rounded-2xl border border-white/10 bg-[#12121D] p-5 shadow-lg transition hover:border-violet-500/30 space-y-4"
              >
                {/* Lecture Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}>
                        {lecture.subject_code}
                      </span>
                      <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                        {lecture.session_type || "Theory"}
                      </span>
                      {lecture.slot_number && (
                        <span className="text-[11px] text-slate-500">
                          Slot {lecture.slot_number}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight mt-1">
                      {lecture.subject_name || lecture.subject_code}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1 text-indigo-300">
                        <CalendarDays size={13} />
                        <span>
                          {lecture.day}
                          {lecture.date ? `, ${lecture.date}` : ""}
                        </span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock size={13} />
                        <span>{lecture.time_slot || `${lecture.start_time} - ${lecture.end_time}`}</span>
                      </span>
                    </div>
                  </div>

                  {/* Predicted Outcome Badge */}
                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      ML Prediction
                    </span>
                    {isAvailable ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold ${
                          isAttend
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {isAttend ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        <span>{lecture.predicted_outcome}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border bg-amber-500/10 text-amber-300 border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold">
                        <HelpCircle size={14} />
                        <span>Prediction Unavailable</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* FEATURE 3: Visual Probability Meter */}
                {isAvailable ? (
                  <div className="rounded-xl border border-white/5 bg-[#161622] p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Attendance Probability:{" "}
                        <strong className="text-emerald-400 text-sm">{attendProb}%</strong>
                      </span>
                      <span className="text-slate-400 font-medium">
                        Absence Probability:{" "}
                        <strong className="text-rose-400 text-sm">{missProb}%</strong>
                      </span>
                    </div>

                    {/* Dual-tone Progress Bar with 60% Decision Threshold Line */}
                    <div className="relative h-2.5 w-full rounded-full bg-white/5 overflow-hidden flex">
                      <div
                        style={{ width: `${attendProb}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        title={`Attendance: ${attendProb}%`}
                      />
                      <div
                        style={{ width: `${missProb}%` }}
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                        title={`Absence: ${missProb}%`}
                      />
                      {/* 60% Threshold Guideline */}
                      <div
                        style={{ left: "60%" }}
                        className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-[0_0_4px_rgba(255,255,255,0.7)] z-10 pointer-events-none"
                        title="60% Classification Threshold"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                        <span>Likely to Attend (&ge; 60%)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                        <span className="text-violet-300">Threshold: 60%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                        <span>Likely to Miss (&lt; 60%)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Unavailable State explanation */
                  <div className="rounded-xl border border-white/5 bg-[#161622] p-3 text-xs text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                      <Info size={13} />
                      <span>{lecture.reason || "Missing genuine inputs for this lecture."}</span>
                    </div>
                    {lecture.missing_features?.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Missing features: {lecture.missing_features.join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Disclaimer & Collapsible Feature Inspector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-500">
                  <span className="italic">
                    Statistical prediction based on historical attendance patterns — not a guarantee.
                  </span>

                  {isAvailable && lecture.features_used && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(idx)}
                      className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium transition cursor-pointer shrink-0"
                    >
                      <span>{isExpanded ? "Hide Features" : "Inspect Features"}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>

                {/* Collapsible Feature Inspection Drawer */}
                {isExpanded && lecture.features_used && (
                  <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-[11px] space-y-2 animate-in fade-in duration-150">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 block">
                      Exact 17 Features Supplied to Random Forest Pipeline:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-slate-300">
                      {Object.entries(lecture.features_used).map(([key, val]) => (
                        <div key={key} className="rounded bg-white/5 p-1.5 border border-white/5">
                          <span className="text-slate-500 block text-[9px]">{key}</span>
                          <span className="text-white font-semibold truncate block">
                            {typeof val === "number" ? val.toFixed(2) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
