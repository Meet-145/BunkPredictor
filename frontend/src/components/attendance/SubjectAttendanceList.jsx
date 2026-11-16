import { useState, useMemo } from "react";
import {
  LayoutGrid,
  Table as TableIcon,
  Search,
  ArrowUpDown,
  Plus,
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  TrendingDown,
  Edit3,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react";
import SubjectAttendanceCard from "./SubjectAttendanceCard";
import { calculateSubjectAnalysis } from "../../utils/attendanceCalculations";

export default function SubjectAttendanceList({
  subjects = [],
  defaultMinimum = 75,
  onAddSubject,
  onImportTimetable,
  onEditSubject,
  onDeleteSubject,
}) {
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'safe' | 'near_threshold' | 'below_threshold'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("percentage_asc"); // 'percentage_asc' | 'percentage_desc' | 'name_asc' | 'conducted_desc'

  // Precompute subject analysis
  const analyzedSubjects = useMemo(() => {
    return subjects.map((sub) => ({
      subject: sub,
      analysis: calculateSubjectAnalysis(sub, defaultMinimum),
    }));
  }, [subjects, defaultMinimum]);

  // Filter and sort
  const filteredSubjects = useMemo(() => {
    return analyzedSubjects
      .filter(({ subject, analysis }) => {
        // Status filter
        if (statusFilter !== "all" && analysis.status.key !== statusFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = (subject.subject_name || "").toLowerCase();
          const code = (subject.subject_code || "").toLowerCase();
          if (!name.includes(q) && !code.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "percentage_asc") {
          return a.analysis.currentPercentage - b.analysis.currentPercentage;
        } else if (sortBy === "percentage_desc") {
          return b.analysis.currentPercentage - a.analysis.currentPercentage;
        } else if (sortBy === "name_asc") {
          return (a.subject.subject_name || "").localeCompare(b.subject.subject_name || "");
        } else if (sortBy === "conducted_desc") {
          return b.analysis.conducted - a.analysis.conducted;
        }
        return 0;
      });
  }, [analyzedSubjects, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#12121D] p-3.5 shadow-md">
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search subjects by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#161622] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none transition"
          />
        </div>

        {/* Right: Filters, Sort & Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#161622] px-3 py-2 text-xs text-slate-300 focus:border-violet-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses ({analyzedSubjects.length})</option>
            <option value="safe">Safe Only</option>
            <option value="near_threshold">Near Threshold</option>
            <option value="below_threshold">Below Target</option>
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#161622] px-2.5 py-1">
            <ArrowUpDown size={13} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="percentage_asc">Lowest Attendance</option>
              <option value="percentage_desc">Highest Attendance</option>
              <option value="name_asc">Subject Name (A-Z)</option>
              <option value="conducted_desc">Most Conducted</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-white/10 bg-[#161622] p-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title="Card View"
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === "cards"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TableIcon size={15} />
            </button>
          </div>

          {/* Primary Action Buttons */}
          <button
            type="button"
            onClick={onImportTimetable}
            title="Import Subjects from Timetable"
            className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3 py-2 font-medium text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
          >
            <UploadCloud size={14} />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            type="button"
            onClick={onAddSubject}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* Subject List / Grid / Table Display */}
      {filteredSubjects.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#12121D] p-8 text-center text-slate-400">
          <p className="text-sm">
            No subjects match your current search and filter criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View */
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredSubjects.map(({ subject }) => (
            <SubjectAttendanceCard
              key={subject.id}
              subject={subject}
              defaultMinimum={defaultMinimum}
              onEdit={onEditSubject}
              onDelete={onDeleteSubject}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#12121D] shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-3 text-center">Conducted</th>
                <th className="py-3.5 px-3 text-center">Attended</th>
                <th className="py-3.5 px-3 text-center">Remaining</th>
                <th className="py-3.5 px-3 text-right">Current %</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-3">Safe Bunks / Recovery</th>
                <th className="py-3.5 px-3 text-center">Projected Range</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {filteredSubjects.map(({ subject, analysis }) => {
                const {
                  conducted,
                  attended,
                  remaining,
                  currentPercentageFormatted,
                  maxProjectedFormatted,
                  minProjectedFormatted,
                  safeBunks,
                  lecturesNeeded,
                  isRecoverable,
                  status,
                  isBelowThreshold,
                  isApproximate,
                } = analysis;

                return (
                  <tr
                    key={subject.id}
                    className="transition hover:bg-white/[0.02]"
                  >
                    {/* Subject Name & Code */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">
                        {subject.subject_name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {subject.subject_code && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {subject.subject_code}
                          </span>
                        )}
                        {isApproximate && (
                          <span
                            title="Entered as percentage; attended count estimated"
                            className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] bg-sky-500/10 text-sky-300 border border-sky-500/20"
                          >
                            <Info size={9} />
                            <span>% mode</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Conducted */}
                    <td className="py-3.5 px-3 text-center font-medium text-slate-300">
                      {conducted}
                    </td>

                    {/* Attended */}
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-400">
                      {attended}
                    </td>

                    {/* Remaining */}
                    <td className="py-3.5 px-3 text-center font-medium text-indigo-300">
                      {remaining}
                    </td>

                    {/* Current % */}
                    <td className="py-3.5 px-3 text-right">
                      <span className="text-sm font-extrabold text-white">
                        {currentPercentageFormatted}
                      </span>
                      <div className="text-[10px] text-slate-500">
                        Req: {analysis.minimumAttendance}%
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.badgeClass}`}
                      >
                        {status.key === "safe" && <ShieldCheck size={11} />}
                        {status.key === "near_threshold" && <AlertTriangle size={11} />}
                        {status.key === "below_threshold" && <TrendingDown size={11} />}
                        <span>{status.label}</span>
                      </span>
                    </td>

                    {/* Safe Bunks / Recovery */}
                    <td className="py-3.5 px-3">
                      {isBelowThreshold ? (
                        <div className="text-[11px] text-rose-300">
                          {isRecoverable ? (
                            <span>
                              Must attend <strong>{lecturesNeeded}</strong> more lectures
                            </span>
                          ) : (
                            <span className="text-rose-400 font-medium">
                              Cannot reach {analysis.minimumAttendance}% (requires {lecturesNeeded})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <Sparkles size={12} />
                          <span>
                            {safeBunks > 0 ? `${safeBunks} Safe Bunks` : "0 Safe Bunks"}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Projected Range */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="text-[11px]">
                        <span className="text-emerald-400 font-semibold" title="If all remaining attended">
                          {maxProjectedFormatted}
                        </span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-semibold" title="If all remaining missed">
                          {minProjectedFormatted}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditSubject(subject)}
                          title="Edit Subject"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSubject(subject)}
                          title="Delete Subject"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
