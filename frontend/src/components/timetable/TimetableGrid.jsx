import { forwardRef } from "react";
import {
  Clock,
  MapPin,
  User,
  Layers,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { DAYS_OF_WEEK, SUBJECT_COLORS } from "../../data/sampleTimetable";

const TimetableGrid = forwardRef(function TimetableGrid(
  {
    entries,
    onEditEntry,
    onDeleteEntry,
    onLoadSample,
    onAddEntry,
    isSampleActive,
  },
  ref
) {
  // Group entries by day and sort by start time
  const entriesByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = entries
      .filter((e) => e.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const hasAnyEntries = entries.length > 0;

  return (
    <div className="space-y-4">
      {/* Scrollable Container for Weekly Calendar */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0D0D16] p-4 sm:p-6 shadow-xl">
        {/* Printable/Exportable Root referenced by html-to-image */}
        <div ref={ref} className="min-w-[880px] bg-[#0D0D16] p-2 rounded-xl">
          {/* Header row in exportable container */}
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white font-bold text-xs">
                  BP
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Weekly Class Timetable
                </h3>
                {isSampleActive && (
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 border border-violet-500/20">
                    Sample Schedule (Mon–Fri)
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Official Semester Lecture & Lab Routine • BunkPredictor
              </p>
            </div>

            <div className="text-right text-xs text-slate-400">
              <span className="font-medium text-white">{entries.length}</span> Total Sessions
            </div>
          </div>

          {/* If no entries exist: Empty state */}
          {!hasAnyEntries ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400 mb-4">
                <Calendar size={28} />
              </div>
              <h4 className="text-base font-semibold text-white">
                No Timetable Entries Yet
              </h4>
              <p className="mt-1.5 max-w-sm text-xs text-slate-400">
                Your weekly timetable is currently empty. You can load our pre-filled
                engineering schedule or start adding your lectures manually.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={onLoadSample}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20"
                >
                  <Sparkles size={14} />
                  Load Sample Timetable
                </button>
                <button
                  onClick={onAddEntry}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
                >
                  <Plus size={14} />
                  Add First Lecture
                </button>
              </div>
            </div>
          ) : (
            /* Day Columns Grid */
            <div className="grid grid-cols-5 gap-3.5">
              {DAYS_OF_WEEK.map((day) => {
                const dayEntries = entriesByDay[day] || [];

                return (
                  <div
                    key={day}
                    className="flex flex-col rounded-xl border border-white/5 bg-white/[0.015] p-3"
                  >
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                      <span className="font-semibold text-sm text-white">
                        {day}
                      </span>
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                        {dayEntries.length} {dayEntries.length === 1 ? "slot" : "slots"}
                      </span>
                    </div>

                    {/* Lecture Cards List */}
                    <div className="flex-1 space-y-3">
                      {dayEntries.length === 0 ? (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/10 p-4 text-center">
                          <p className="text-xs text-slate-500">
                            No classes scheduled
                          </p>
                        </div>
                      ) : (
                        dayEntries.map((entry) => {
                          const style =
                            SUBJECT_COLORS[entry.subjectCode] ||
                            SUBJECT_COLORS.DEFAULT;
                          const isNeedsReview = Boolean(
                            entry.needsReview || entry.needs_review
                          );

                          return (
                            <div
                              key={entry.id}
                              className={`group relative rounded-xl border p-3.5 transition-all duration-200 shadow-sm ${
                                isNeedsReview
                                  ? "border-amber-500/50 bg-amber-950/20 hover:border-amber-400 ring-1 ring-amber-500/30"
                                  : style.card
                              }`}
                            >
                              {/* Subject Badge & Actions */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-lg px-2 py-0.5 text-xs font-bold tracking-wide ${style.badge}`}
                                  >
                                    {entry.subjectCode}
                                  </span>

                                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                                    {entry.sessionType}
                                  </span>

                                  {isNeedsReview && (
                                    <span
                                      title="This slot had lower extraction confidence and needs review"
                                      className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/40"
                                    >
                                      <AlertTriangle size={10} />
                                      Review
                                    </span>
                                  )}
                                </div>

                                {/* Edit / Delete Actions */}
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => onEditEntry(entry)}
                                    title="Edit lecture"
                                    className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => onDeleteEntry(entry.id)}
                                    title="Delete lecture"
                                    className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Subject Title */}
                              <h5 className="mt-2 text-xs font-semibold text-white leading-snug line-clamp-2">
                                {entry.subjectName}
                              </h5>

                              {/* Timing */}
                              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-300">
                                <Clock size={12} className="text-violet-400 shrink-0" />
                                <span className="font-medium">
                                  {entry.startTime} – {entry.endTime}
                                </span>
                              </div>

                              {/* Meta Details: Room, Faculty, Batch */}
                              <div className="mt-2 space-y-1 border-t border-white/5 pt-2 text-[10px] text-slate-400">
                                {entry.room && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <MapPin size={11} className="shrink-0 text-slate-500" />
                                    <span className="truncate">{entry.room}</span>
                                  </div>
                                )}

                                {entry.faculty && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <User size={11} className="shrink-0 text-slate-500" />
                                    <span className="truncate">{entry.faculty}</span>
                                  </div>
                                )}

                                {entry.batch && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Layers size={11} className="shrink-0 text-slate-500" />
                                    <span className="text-violet-300 font-medium truncate">
                                      {entry.batch}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default TimetableGrid;
