import {
  CalendarDays,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

export default function AttendanceSummaryCards({ overallStats, minimumAttendance }) {
  const {
    totalConducted,
    totalAttended,
    totalRemaining,
    overallPercentageFormatted,
    status,
    subjectsCount,
  } = overallStats;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Overall Attendance */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12121D] p-5 transition hover:border-violet-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overall Attendance
            </p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">
              {overallPercentageFormatted}
            </h3>
          </div>
          <div
            className={`rounded-xl p-3 ${
              status.key === "safe"
                ? "bg-emerald-500/10 text-emerald-400"
                : status.key === "near_threshold"
                ? "bg-amber-500/10 text-amber-400"
                : status.key === "below_threshold"
                ? "bg-rose-500/10 text-rose-400"
                : "bg-violet-500/10 text-violet-300"
            }`}
          >
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Target: &ge; {minimumAttendance}%</span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] border ${status.badgeClass}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* 2. Total Lectures Conducted */}
      <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 transition hover:border-violet-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Lectures Conducted
            </p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">
              {totalConducted}
            </h3>
          </div>
          <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
            <CalendarDays size={22} />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Across {subjectsCount} {subjectsCount === 1 ? "subject" : "enrolled subjects"}
        </p>
      </div>

      {/* 3. Lectures Attended */}
      <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 transition hover:border-violet-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lectures Attended
            </p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-emerald-400">
              {totalAttended}
            </h3>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          {totalConducted > 0
            ? `${((totalAttended / totalConducted) * 100).toFixed(1)}% of conducted lectures`
            : "No classes conducted yet"}
        </p>
      </div>

      {/* 4. Remaining Lectures */}
      <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 transition hover:border-violet-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Remaining Lectures
            </p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight text-indigo-300">
              {totalRemaining}
            </h3>
          </div>
          <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
            <Clock size={22} />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Expected classes rest of semester
        </p>
      </div>
    </div>
  );
}
