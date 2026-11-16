import {
  Edit3,
  Trash2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Percent,
  Info,
} from "lucide-react";
import { calculateSubjectAnalysis } from "../../utils/attendanceCalculations";

export default function SubjectAttendanceCard({
  subject,
  defaultMinimum = 75,
  onEdit,
  onDelete,
}) {
  const analysis = calculateSubjectAnalysis(subject, defaultMinimum);

  const {
    conducted,
    attended,
    remaining,
    minimumAttendance,
    currentPercentage,
    currentPercentageFormatted,
    maxProjectedFormatted,
    minProjectedFormatted,
    safeBunks,
    lecturesNeeded,
    isRecoverable,
    status,
    isApproximate,
    isBelowThreshold,
  } = analysis;

  const subjectName = subject.subject_name || "Untitled Subject";
  const subjectCode = subject.subject_code || "";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#12121D] p-5 shadow-lg transition hover:border-violet-500/30">
      <div>
        {/* Header: Name, Code & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white tracking-tight" title={subjectName}>
                {subjectName}
              </h3>
              {subjectCode && (
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300">
                  {subjectCode}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.badgeClass}`}
              >
                {status.key === "safe" && <ShieldCheck size={12} />}
                {status.key === "near_threshold" && <AlertTriangle size={12} />}
                {status.key === "below_threshold" && <TrendingDown size={12} />}
                <span>{status.label}</span>
              </span>

              {isApproximate && (
                <span
                  title="Entered as percentage; attended count estimated"
                  className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300"
                >
                  <Percent size={10} />
                  <span>% Mode</span>
                </span>
              )}
            </div>
          </div>

          {/* Action buttons: Edit & Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(subject)}
              title="Edit Subject & Attendance"
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(subject)}
              title="Delete Subject"
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Current Attendance Display */}
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Current Attendance
            </span>
            <div className="text-3xl font-extrabold tracking-tight text-white">
              {currentPercentageFormatted}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Required
            </span>
            <div className="text-base font-semibold text-violet-300">
              {minimumAttendance}%
            </div>
          </div>
        </div>

        {/* Progress Bar with Threshold Marker */}
        <div className="mt-2.5">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${status.progressClass}`}
              style={{ width: `${Math.min(100, Math.max(0, currentPercentage))}%` }}
            />
            {/* Target Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
              style={{ left: `${minimumAttendance}%` }}
              title={`Required Target: ${minimumAttendance}%`}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>0%</span>
            <span>Target: {minimumAttendance}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Counts Breakdown Chips */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-[#0D0D14] p-2.5 text-center">
          <div>
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">
              Conducted
            </span>
            <span className="mt-0.5 block text-sm font-bold text-white">
              {conducted}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">
              Attended
            </span>
            <span className="mt-0.5 block text-sm font-bold text-emerald-400">
              {attended}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">
              Remaining
            </span>
            <span className="mt-0.5 block text-sm font-bold text-indigo-300">
              {remaining}
            </span>
          </div>
        </div>

        {/* Prediction Section */}
        <div className="mt-4 space-y-2.5 rounded-xl border border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-transparent p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-violet-300">
              <Sparkles size={13} className="text-violet-400" />
              Future Predictions
            </span>
            <span className="text-[10px] text-slate-500">
              ({remaining} left)
            </span>
          </div>

          {/* Safe Bunks or Recovery Notice */}
          <div className="rounded-lg border border-white/5 bg-[#12121D] p-2.5">
            {isBelowThreshold ? (
              // Below Threshold - show consecutive lectures needed to recover
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-rose-300">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                  <span>
                    {isRecoverable
                      ? `Must attend next ${lecturesNeeded} consecutive ${
                          lecturesNeeded === 1 ? "lecture" : "lectures"
                        } to reach ${minimumAttendance}%`
                      : `Cannot reach ${minimumAttendance}% with ${remaining} lectures remaining`}
                  </span>
                </div>
                {!isRecoverable && (
                  <p className="text-[11px] text-slate-400">
                    Maximum possible attendance is {maxProjectedFormatted}. Mathematically requires{" "}
                    {lecturesNeeded} consecutive attended lectures.
                  </p>
                )}
              </div>
            ) : (
              // On Track or Above - show Safe Bunks
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Max Safe Bunks Remaining:</span>
                <span
                  className={`font-bold ${
                    safeBunks > 0 ? "text-emerald-400 text-sm" : "text-amber-400"
                  }`}
                >
                  {safeBunks > 0
                    ? `${safeBunks} ${safeBunks === 1 ? "lecture" : "lectures"}`
                    : "0 safe bunks"}
                </span>
              </div>
            )}
          </div>

          {/* Projections Range: All Attended vs All Missed */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
              <div className="flex items-center gap-1 text-emerald-400 font-medium">
                <TrendingUp size={12} />
                <span>If all attended</span>
              </div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {maxProjectedFormatted}
              </div>
            </div>

            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2">
              <div className="flex items-center gap-1 text-rose-400 font-medium">
                <TrendingDown size={12} />
                <span>If all missed</span>
              </div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {minProjectedFormatted}
              </div>
            </div>
          </div>

          {isApproximate && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1 italic">
              <Info size={10} className="shrink-0" />
              Projections rely on an approximate attended count (~{attended}) derived from {currentPercentageFormatted}.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {conducted + remaining} Total Semester Lectures
        </span>
        <button
          type="button"
          onClick={() => onEdit(subject)}
          className="text-violet-400 hover:text-violet-300 font-medium hover:underline cursor-pointer"
        >
          Update figures &rarr;
        </button>
      </div>
    </div>
  );
}
