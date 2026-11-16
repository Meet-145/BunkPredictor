import { useState } from "react";
import {
  X,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldCheck,
} from "lucide-react";
import { DEFAULT_SETTINGS } from "../../services/attendanceStorage";

export default function AttendanceSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetData,
}) {
  const [minimumAttendance, setMinimumAttendance] = useState(
    settings?.minimumAttendance ?? DEFAULT_SETTINGS.minimumAttendance
  );
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const minVal = Math.min(100, Math.max(1, parseInt(minimumAttendance, 10) || 75));
    onSaveSettings({
      minimumAttendance: minVal,
    });
    onClose();
  };

  const handleResetConfirm = () => {
    onResetData();
    setIsConfirmingReset(false);
    onClose();
  };

  const safeThreshold = Math.min(100, Number(minimumAttendance) + 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121D] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Attendance Settings
              </h3>
              <p className="text-xs text-slate-400">
                Configure required criteria & data preferences
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Minimum Threshold Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-violet-400" />
                <span>Minimum Required Attendance</span>
              </label>
              <div className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={minimumAttendance}
                  onChange={(e) => setMinimumAttendance(e.target.value)}
                  className="w-10 bg-transparent text-right text-xs font-bold text-violet-300 focus:outline-none"
                />
                <span className="text-xs font-bold text-violet-300">%</span>
              </div>
            </div>

            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={minimumAttendance}
              onChange={(e) => setMinimumAttendance(e.target.value)}
              className="w-full accent-violet-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>50%</span>
              <button
                type="button"
                onClick={() => setMinimumAttendance(75)}
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                Set Default (75%)
              </button>
              <span>95%</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Used across all subjects to calculate safe bunks, recovery requirements, and attendance statuses.
            </p>
          </div>

          {/* Status Rules Breakdown Preview */}
          <div className="rounded-xl border border-white/5 bg-[#161622] p-4 space-y-2.5 text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
              Active Status Thresholds:
            </span>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Safe:</span>
              </span>
              <span className="font-semibold text-emerald-400">
                &ge; {safeThreshold}%
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>Near Threshold:</span>
              </span>
              <span className="font-semibold text-amber-400">
                {minimumAttendance}% – {safeThreshold - 0.01}%
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>Below Required:</span>
              </span>
              <span className="font-semibold text-rose-400">
                &lt; {minimumAttendance}%
              </span>
            </div>
          </div>

          {/* Danger Zone: Reset Data */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <span className="text-[10px] uppercase font-semibold text-rose-400 tracking-wider block">
              Reset Tracker Data
            </span>
            {!isConfirmingReset ? (
              <button
                type="button"
                onClick={() => setIsConfirmingReset(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Reset All Attendance Data</span>
              </button>
            ) : (
              <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-rose-300">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p>
                    Are you sure? This will remove all added subjects and restore default settings.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetConfirm}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
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
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              <Check size={14} />
              <span>Apply Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
