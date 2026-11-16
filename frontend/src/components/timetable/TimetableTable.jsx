import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { DAYS_OF_WEEK, SUBJECT_COLORS } from "../../data/sampleTimetable";

export default function TimetableTable({
  entries,
  onEditEntry,
  onDeleteEntry,
  onAddEntry,
  onLoadSample,
}) {
  const [selectedDay, setSelectedDay] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const matchesDay = selectedDay === "ALL" || entry.day === selectedDay;
        const matchesSearch =
          searchQuery.trim() === "" ||
          entry.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (entry.faculty &&
            entry.faculty.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (entry.room &&
            entry.room.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesDay && matchesSearch;
      })
      .sort((a, b) => {
        // Sort by day order then start time
        const dayOrder = {
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
        };
        const diff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
        if (diff !== 0) return diff;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [entries, selectedDay, searchQuery]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D0D16] p-5 sm:p-6 shadow-xl space-y-5">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Day Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDay("ALL")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              selectedDay === "ALL"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "border border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5"
            }`}
          >
            All Days ({entries.length})
          </button>
          {DAYS_OF_WEEK.map((day) => {
            const count = entries.filter((e) => e.day === day).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  selectedDay === day
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                    : "border border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5"
                }`}
              >
                {day} ({count})
              </button>
            );
          })}
        </div>

        {/* Search input & Add button */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Search subject, code, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#09090F] pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          <button
            onClick={onAddEntry}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-md shadow-violet-600/20 shrink-0"
          >
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#12121D]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400">
              <th className="py-3 px-4 font-semibold">Day</th>
              <th className="py-3 px-4 font-semibold">Timing</th>
              <th className="py-3 px-4 font-semibold">Subject</th>
              <th className="py-3 px-4 font-semibold">Type</th>
              <th className="py-3 px-4 font-semibold">Faculty</th>
              <th className="py-3 px-4 font-semibold">Room / Location</th>
              <th className="py-3 px-4 font-semibold">Batch</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Filter size={24} className="text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-white">
                      No matching timetable entries found
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try clearing filters or add a new entry to get started.
                    </p>
                    {entries.length === 0 && (
                      <button
                        onClick={onLoadSample}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300"
                      >
                        <Sparkles size={13} /> Load Sample Timetable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const style =
                  SUBJECT_COLORS[entry.subjectCode] || SUBJECT_COLORS.DEFAULT;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Day */}
                    <td className="py-3.5 px-4 font-medium text-white">
                      {entry.day}
                    </td>

                    {/* Timing */}
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock size={12} className="text-violet-400" />
                        {entry.startTime} – {entry.endTime}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-bold text-[11px] ${style.badge}`}
                        >
                          {entry.subjectCode}
                        </span>
                        <span className="font-medium text-white">
                          {entry.subjectName}
                        </span>
                        {Boolean(entry.needsReview || entry.needs_review) && (
                          <span
                            title="This extracted slot has uncertain fields and needs review"
                            className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30"
                          >
                            <AlertTriangle size={10} />
                            Review
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Session Type */}
                    <td className="py-3.5 px-4">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                        {entry.sessionType}
                      </span>
                    </td>

                    {/* Faculty */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {entry.faculty || "—"}
                    </td>

                    {/* Room */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {entry.room || "—"}
                    </td>

                    {/* Batch */}
                    <td className="py-3.5 px-4">
                      {entry.batch ? (
                        <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                          {entry.batch}
                        </span>
                      ) : (
                        <span className="text-slate-600">All</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEditEntry(entry)}
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteEntry(entry.id)}
                          title="Delete"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
