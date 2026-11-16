import { useState, useMemo } from "react";
import {
  X,
  BookOpen,
  Calculator,
  Percent,
  Sliders,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { calculateSubjectAnalysis } from "../../utils/attendanceCalculations";

export default function SubjectFormModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  defaultMinimum = 75,
}) {
  const [subjectName, setSubjectName] = useState(() => initialData?.subject_name || "");
  const [subjectCode, setSubjectCode] = useState(() => initialData?.subject_code || "");
  const [inputMode, setInputMode] = useState(() => initialData?.input_mode || "counts");
  const [conducted, setConducted] = useState(() =>
    initialData ? String(initialData.lectures_conducted) : ""
  );
  const [attended, setAttended] = useState(() =>
    initialData ? String(initialData.lectures_attended) : ""
  );
  const [percentage, setPercentage] = useState(() =>
    initialData ? String(initialData.current_percentage) : ""
  );
  const [remaining, setRemaining] = useState(() =>
    initialData ? String(initialData.lectures_remaining) : "15"
  );
  const [minimumAttendance, setMinimumAttendance] = useState(() =>
    initialData?.minimum_attendance ? String(initialData.minimum_attendance) : String(defaultMinimum)
  );

  // Toggle input mode while preserving relevant values
  const handleToggleInputMode = (newMode) => {
    if (newMode === inputMode) return;
    const condNum = parseInt(conducted, 10) || 0;

    if (newMode === "percentage") {
      // Switching from Counts to Percentage
      const attNum = parseInt(attended, 10) || 0;
      const calcPct = condNum > 0 ? ((attNum / condNum) * 100).toFixed(2) : "0";
      setPercentage(calcPct);
    } else {
      // Switching from Percentage to Counts
      const pctNum = parseFloat(percentage) || 0;
      const calcAtt = condNum > 0 ? Math.round((pctNum * condNum) / 100) : 0;
      setAttended(String(calcAtt));
    }

    setInputMode(newMode);
  };

  // Real-time validation
  const validationError = useMemo(() => {
    if (!subjectName.trim()) {
      return "Subject name is required.";
    }

    const c = Number(conducted);
    if (isNaN(c) || c < 0 || !Number.isInteger(c)) {
      return "Lectures conducted must be a non-negative integer (0 or greater).";
    }

    const r = Number(remaining);
    if (isNaN(r) || r < 0 || !Number.isInteger(r)) {
      return "Remaining lectures must be a non-negative integer (0 or greater).";
    }

    const min = Number(minimumAttendance);
    if (isNaN(min) || min < 1 || min > 100) {
      return "Required minimum attendance must be between 1% and 100%.";
    }

    if (inputMode === "counts") {
      const a = Number(attended);
      if (isNaN(a) || a < 0 || !Number.isInteger(a)) {
        return "Lectures attended must be a non-negative integer (0 or greater).";
      }
      if (a > c) {
        return `Lectures attended (${a}) cannot exceed lectures conducted (${c}).`;
      }
    } else {
      const p = Number(percentage);
      if (isNaN(p) || p < 0 || p > 100) {
        return "Attendance percentage must be between 0% and 100%.";
      }
    }

    return null;
  }, [subjectName, conducted, remaining, minimumAttendance, inputMode, attended, percentage]);

  // Live preview analysis
  const previewAnalysis = useMemo(() => {
    const c = Math.max(0, parseInt(conducted, 10) || 0);
    const r = Math.max(0, parseInt(remaining, 10) || 0);
    const min = Math.min(100, Math.max(1, parseInt(minimumAttendance, 10) || defaultMinimum));

    if (inputMode === "percentage") {
      const p = Math.min(100, Math.max(0, parseFloat(percentage) || 0));
      return calculateSubjectAnalysis(
        {
          subject_name: subjectName,
          subject_code: subjectCode,
          lectures_conducted: c,
          current_percentage: p,
          lectures_remaining: r,
          minimum_attendance: min,
          input_mode: "percentage",
        },
        defaultMinimum
      );
    } else {
      const a = Math.min(c, Math.max(0, parseInt(attended, 10) || 0));
      return calculateSubjectAnalysis(
        {
          subject_name: subjectName,
          subject_code: subjectCode,
          lectures_conducted: c,
          lectures_attended: a,
          lectures_remaining: r,
          minimum_attendance: min,
          input_mode: "counts",
        },
        defaultMinimum
      );
    }
  }, [
    subjectName,
    subjectCode,
    conducted,
    remaining,
    minimumAttendance,
    inputMode,
    attended,
    percentage,
    defaultMinimum,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validationError) return;

    const c = Math.max(0, parseInt(conducted, 10) || 0);
    const r = Math.max(0, parseInt(remaining, 10) || 0);
    const min = Math.min(100, Math.max(1, parseInt(minimumAttendance, 10) || defaultMinimum));

    let finalAttended = 0;
    let finalPercentage = 0;

    if (inputMode === "percentage") {
      finalPercentage = Math.min(100, Math.max(0, parseFloat(percentage) || 0));
      finalAttended = Math.min(c, Math.round((finalPercentage * c) / 100));
    } else {
      finalAttended = Math.min(c, Math.max(0, parseInt(attended, 10) || 0));
      finalPercentage = c > 0 ? (finalAttended / c) * 100 : 0;
    }

    const payload = {
      id: initialData?.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      subject_name: subjectName.trim(),
      subject_code: subjectCode.trim().toUpperCase(),
      lectures_conducted: c,
      lectures_attended: finalAttended,
      current_percentage: finalPercentage,
      lectures_remaining: r,
      minimum_attendance: min,
      input_mode: inputMode,
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#12121D] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {initialData ? "Edit Subject Attendance" : "Add Subject"}
              </h3>
              <p className="text-xs text-slate-400">
                Enter current lectures to predict future attendance and safe bunks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-rose-300">
                  Please check your input
                </span>
                <span>{validationError}</span>
              </div>
            </div>
          )}

          {/* Subject Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Subject Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Machine Learning Essentials"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Code <span className="text-slate-500 text-[10px]">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. MLE"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 uppercase"
              />
            </div>
          </div>

          {/* Input Method Selector Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                Input Method
              </label>
              <span className="text-[11px] text-slate-400">
                Choose how you want to provide current attendance
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#161622] border border-white/5">
              <button
                type="button"
                onClick={() => handleToggleInputMode("counts")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition cursor-pointer ${
                  inputMode === "counts"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Calculator size={14} />
                <span>Method A: Lecture Counts</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleInputMode("percentage")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition cursor-pointer ${
                  inputMode === "percentage"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Percent size={14} />
                <span>Method B: Percentage</span>
              </button>
            </div>
          </div>

          {/* Method A: Counts Inputs */}
          {inputMode === "counts" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Total Lectures Conducted <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 40"
                  value={conducted}
                  onChange={(e) => setConducted(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  required
                />
                <span className="text-[10px] text-slate-500">
                  Classes held so far this semester
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Lectures Attended <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 32"
                  value={attended}
                  onChange={(e) => setAttended(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  required
                />
                <span className="text-[10px] text-slate-500">
                  Classes you personally attended
                </span>
              </div>
            </div>
          ) : (
            /* Method B: Percentage Inputs */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Current Attendance Percentage <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 80.00"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 pr-8 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                    %
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Your current recorded portal percentage
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Total Lectures Conducted <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 40"
                  value={conducted}
                  onChange={(e) => setConducted(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  required
                />
                <span className="text-[10px] text-slate-500">
                  Used to estimate attended lecture count
                </span>
              </div>
            </div>
          )}

          {/* Remaining Lectures & Required Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Remaining Expected Lectures <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 20"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
              />
              <span className="text-[10px] text-slate-500">
                Remaining scheduled classes in semester
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Minimum Required Attendance (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={minimumAttendance}
                  onChange={(e) => setMinimumAttendance(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#161622] px-3.5 py-2.5 pr-8 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                  %
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                Institutional target (default {defaultMinimum}%)
              </span>
            </div>
          </div>

          {/* Real-Time Prediction Live Preview */}
          <div className="rounded-xl border border-white/10 bg-[#161622] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders size={13} className="text-violet-400" />
                Live Attendance Prediction Preview
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${previewAnalysis.status.badgeClass}`}
              >
                {previewAnalysis.status.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs">
              <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">
                  Current %
                </span>
                <span className="font-bold text-white text-sm">
                  {previewAnalysis.currentPercentageFormatted}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ({previewAnalysis.attended}/{previewAnalysis.conducted})
                </span>
              </div>

              <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">
                  If All Attended
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {previewAnalysis.maxProjectedFormatted}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Best case
                </span>
              </div>

              <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">
                  If All Missed
                </span>
                <span className="font-bold text-rose-400 text-sm">
                  {previewAnalysis.minProjectedFormatted}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Worst case
                </span>
              </div>

              <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">
                  Safe Bunks
                </span>
                <span className="font-bold text-violet-300 text-sm">
                  {previewAnalysis.safeBunks}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Maintain &ge; {previewAnalysis.minimumAttendance}%
                </span>
              </div>
            </div>

            {previewAnalysis.isBelowThreshold && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-200">
                {previewAnalysis.isRecoverable ? (
                  <span>
                    Must attend at least{" "}
                    <strong className="text-rose-100 font-bold">
                      {previewAnalysis.lecturesNeeded}
                    </strong>{" "}
                    consecutive future lectures to reach {previewAnalysis.minimumAttendance}%.
                  </span>
                ) : (
                  <span>
                    ⚠️ Reaching {previewAnalysis.minimumAttendance}% is mathematically impossible
                    with only {previewAnalysis.remaining} remaining lectures (needs{" "}
                    {previewAnalysis.lecturesNeeded} lectures).
                  </span>
                )}
              </div>
            )}

            {previewAnalysis.isApproximate && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 italic">
                <HelpCircle size={10} />
                Predictions based on approximately {previewAnalysis.attended} attended lectures.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(validationError)}
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              {initialData ? "Update Subject" : "Save Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
