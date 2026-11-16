import { useState, useMemo } from "react";
import {
  X,
  UploadCloud,
  Check,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { getAvailableTimetableSubjects } from "../../services/attendanceStorage";

export default function ImportTimetableModal({
  isOpen,
  onClose,
  existingSubjects = [],
  onImportSubjects,
  onOpenManualCreate,
  defaultMinimum = 75,
}) {
  const timetableSubjects = useMemo(() => {
    if (!isOpen) return [];
    return getAvailableTimetableSubjects();
  }, [isOpen]);

  // Existing normalized set to prevent duplicate imports
  const existingSet = useMemo(() => {
    const set = new Set();
    for (const sub of existingSubjects) {
      if (sub.subject_code) set.add(sub.subject_code.trim().toUpperCase());
      if (sub.subject_name) set.add(sub.subject_name.trim().toLowerCase());
    }
    return set;
  }, [existingSubjects]);

  // Categorize into already imported vs available to import
  const { availableList, alreadyImportedList } = useMemo(() => {
    const available = [];
    const imported = [];

    for (const item of timetableSubjects) {
      const codeKey = (item.code || "").trim().toUpperCase();
      const nameKey = (item.name || "").trim().toLowerCase();

      const isImported =
        (codeKey && existingSet.has(codeKey)) ||
        (nameKey && existingSet.has(nameKey));

      if (isImported) {
        imported.push(item);
      } else {
        available.push(item);
      }
    }

    return { availableList: available, alreadyImportedList: imported };
  }, [timetableSubjects, existingSet]);

  const [selectedCodes, setSelectedCodes] = useState(() => {
    return new Set(availableList.map((s) => s.code || s.name));
  });

  if (!isOpen) return null;

  const handleToggle = (key) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCodes(new Set(availableList.map((s) => s.code || s.name)));
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
  };

  const handleConfirmImport = () => {
    const toImport = availableList.filter((item) =>
      selectedCodes.has(item.code || item.name)
    );

    if (toImport.length === 0) return;

    const newSubjects = toImport.map((item, index) => ({
      id: `sub_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      subject_name: item.name || item.code,
      subject_code: item.code || "",
      lectures_conducted: 0,
      lectures_attended: 0,
      current_percentage: 0,
      lectures_remaining: 20,
      minimum_attendance: defaultMinimum,
      input_mode: "counts",
    }));

    onImportSubjects(newSubjects);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121D] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Import Subjects from Timetable
              </h3>
              <p className="text-xs text-slate-400">
                Sync subject names from your weekly routine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {timetableSubjects.length === 0 ? (
            // No timetable subjects found
            <div className="rounded-xl border border-white/5 bg-[#161622] p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400 border border-violet-500/20">
                <Calendar size={22} />
              </div>
              <h4 className="text-sm font-semibold text-white">
                No Timetable Schedule Found
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                You haven&apos;t extracted or configured a weekly schedule in Timetable Management yet.
                You can create subjects manually below.
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenManualCreate();
                  }}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create Subject Manually</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Product rule note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3.5 text-xs text-violet-200">
                <AlertCircle size={16} className="text-violet-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Imported subjects will start with 0 conducted lectures so no fake numbers are invented.
                  After importing, click <strong>Edit</strong> on each subject to input your current attendance figures.
                </p>
              </div>

              {/* Available Subjects Selection */}
              {availableList.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Available to Import ({availableList.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">&bull;</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {availableList.map((item) => {
                      const key = item.code || item.name;
                      const isChecked = selectedCodes.has(key);

                      return (
                        <label
                          key={key}
                          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                            isChecked
                              ? "border-violet-500/40 bg-violet-600/10"
                              : "border-white/5 bg-[#161622] hover:border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggle(key)}
                              className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500 h-4 w-4"
                            />
                            <div>
                              <div className="text-xs font-semibold text-white">
                                {item.name}
                              </div>
                              {item.code && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {item.code}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Ready to import
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-[#161622] p-4 text-center text-xs text-slate-400">
                  All {timetableSubjects.length} subjects from your schedule are already added to your Attendance Tracker.
                </div>
              )}

              {/* Already Imported List */}
              {alreadyImportedList.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Already in Tracker ({alreadyImportedList.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {alreadyImportedList.map((item) => (
                      <span
                        key={item.code || item.name}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400"
                      >
                        <Check size={11} className="text-emerald-400" />
                        <span>{item.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4 bg-[#0E0E17]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenManualCreate();
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <Plus size={13} />
            <span>Or add manual subject</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            {availableList.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedCodes.size === 0}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-600/20 cursor-pointer"
              >
                <span>Import {selectedCodes.size} Selected</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
