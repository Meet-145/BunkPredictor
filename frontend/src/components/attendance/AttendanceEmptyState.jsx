import { Plus, UploadCloud, Calendar, ArrowRight } from "lucide-react";

export default function AttendanceEmptyState({
  onAddSubject,
  onImportTimetable,
  onGoToTimetable,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#12121D] p-8 sm:p-12 text-center shadow-xl">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400 mb-5 border border-violet-500/20 shadow-inner">
        <Calendar size={32} />
      </div>

      <h2 className="text-xl font-bold text-white tracking-tight">
        No Subjects in Attendance Tracker
      </h2>

      <p className="mt-2.5 max-w-lg text-sm text-slate-400 leading-relaxed">
        BunkPredictor tracks attendance and calculates future safe bunks per subject based on your current figures and remaining lectures.
        Add your subjects manually or import them directly from your timetable schedule.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onAddSubject}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/25 cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Subject Manually</span>
        </button>

        <button
          type="button"
          onClick={onImportTimetable}
          className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/10 px-5 py-2.5 text-sm font-semibold text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
        >
          <UploadCloud size={16} />
          <span>Import from Timetable</span>
        </button>
      </div>

      <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <span>Need to set up or extract a new routine first?</span>
        <button
          type="button"
          onClick={onGoToTimetable}
          className="text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>Open Timetable Management</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
