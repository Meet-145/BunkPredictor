import { useState } from "react";
import { X, User, CheckCircle2, RotateCcw, Info } from "lucide-react";
import { saveStudentProfile } from "../../services/predictionApi";

const BENCHMARK_STUDENTS = [
  { id: "S001", name: "Student S001 (High Attendance)", commute: 25, prevAtt: 88.0, cgpa: 8.87 },
  { id: "S002", name: "Student S002 (Average Attendance)", commute: 40, prevAtt: 76.5, cgpa: 7.45 },
  { id: "S003", name: "Student S003 (Moderate Risk)", commute: 60, prevAtt: 68.0, cgpa: 7.21 },
  { id: "S004", name: "Student S004 (At Risk)", commute: 75, prevAtt: 58.0, cgpa: 6.50 },
  { id: "S005", name: "Student S005 (Safe Buffer)", commute: 15, prevAtt: 92.0, cgpa: 9.12 },
];

export default function StudentProfileModal({
  isOpen,
  onClose,
  currentProfile,
  onSave,
}) {
  const [mode, setMode] = useState(() => (currentProfile?.student_id ? "benchmark" : "custom"));
  const [selectedStudentId, setSelectedStudentId] = useState(() => currentProfile?.student_id || "S001");
  const [commuteTime, setCommuteTime] = useState(() => currentProfile?.commute_time_minutes ?? 25);
  const [prevAttendance, setPrevAttendance] = useState(() => currentProfile?.previous_semester_attendance_pct ?? 80);
  const [cgpa, setCgpa] = useState(() => currentProfile?.previous_cgpa_synthetic ?? 8.0);

  if (!isOpen) return null;

  const handleBenchmarkSelect = (id) => {
    setSelectedStudentId(id);
    const found = BENCHMARK_STUDENTS.find((s) => s.id === id);
    if (found) {
      setCommuteTime(found.commute);
      setPrevAttendance(found.prevAtt);
      setCgpa(found.cgpa);
    }
  };

  const handleSave = () => {
    let profileData = null;
    if (mode === "benchmark") {
      profileData = {
        student_id: selectedStudentId,
        commute_time_minutes: Number(commuteTime),
        previous_semester_attendance_pct: Number(prevAttendance),
        previous_cgpa_synthetic: Number(cgpa),
      };
    } else {
      profileData = {
        student_id: null,
        commute_time_minutes: Number(commuteTime),
        previous_semester_attendance_pct: Number(prevAttendance),
        previous_cgpa_synthetic: Number(cgpa),
      };
    }

    saveStudentProfile(profileData);
    if (onSave) onSave(profileData);
    onClose();
  };

  const handleClear = () => {
    saveStudentProfile(null);
    if (onSave) onSave(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Student Profile Settings</h3>
              <p className="text-[11px] text-slate-400">Required features for Random Forest ML inference</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-xl bg-[#161622] p-1 border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setMode("benchmark")}
            className={`flex-1 rounded-lg py-2 font-semibold transition cursor-pointer ${
              mode === "benchmark"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Cohort Student ID
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 rounded-lg py-2 font-semibold transition cursor-pointer ${
              mode === "custom"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Custom Profile Numbers
          </button>
        </div>

        {/* Body */}
        {mode === "benchmark" ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Select Verified Benchmark Student (students.csv):
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {BENCHMARK_STUDENTS.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleBenchmarkSelect(st.id)}
                  className={`rounded-xl border p-3 cursor-pointer transition flex items-center justify-between ${
                    selectedStudentId === st.id
                      ? "border-violet-500/50 bg-violet-600/15"
                      : "border-white/5 bg-[#161622] hover:border-white/10"
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">{st.name}</span>
                    <span className="text-[10px] text-slate-400">
                      Commute: {st.commute}m • Prior Att: {st.prevAtt}% • CGPA: {st.cgpa}
                    </span>
                  </div>
                  {selectedStudentId === st.id && (
                    <CheckCircle2 size={16} className="text-violet-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Commute Time (Minutes):</label>
              <input
                type="number"
                min="0"
                max="180"
                value={commuteTime}
                onChange={(e) => setCommuteTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#161622] p-2.5 text-white font-mono focus:border-violet-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Average one-way commute to college</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Previous Semester Attendance (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={prevAttendance}
                onChange={(e) => setPrevAttendance(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#161622] p-2.5 text-white font-mono focus:border-violet-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Attendance percentage from the previous term</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Cumulative CGPA (0.0 - 10.0):</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#161622] p-2.5 text-white font-mono focus:border-violet-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Academic performance indicator</span>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="rounded-xl border border-white/5 bg-[#161622] p-3 text-[11px] text-slate-400 flex items-start gap-2">
          <Info size={14} className="text-violet-400 shrink-0 mt-0.5" />
          <span>
            These features are combined with your timetable and attendance tracker records to perform genuine inference on the trained Random Forest model.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Clear Profile</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/25 cursor-pointer"
            >
              Apply Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
