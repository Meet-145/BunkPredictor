import { useState, useEffect } from "react";
import { X, Calendar, Clock, BookOpen, User, MapPin, Layers, AlertCircle } from "lucide-react";
import { DAYS_OF_WEEK, SESSION_TYPES, SUBJECT_OPTIONS } from "../../data/sampleTimetable";

export default function TimetableEntryModal({
  isOpen,
  initialData,
  onSave,
  onClose,
}) {
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        id: initialData.id,
        day: initialData.day || "Monday",
        startTime: initialData.startTime || "09:00",
        endTime: initialData.endTime || "10:00",
        subjectName: initialData.subjectName || "",
        subjectCode: initialData.subjectCode || "",
        sessionType: initialData.sessionType || "Theory",
        faculty: initialData.faculty || "",
        room: initialData.room || "",
        batch: initialData.batch || "",
      };
    }
    return {
      day: "Monday",
      startTime: "09:00",
      endTime: "10:00",
      subjectName: "",
      subjectCode: "",
      sessionType: "Theory",
      faculty: "",
      room: "",
      batch: "",
    };
  });

  const [errors, setErrors] = useState({});

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};

    if (!formData.subjectName.trim()) {
      newErrors.subjectName = "Subject name is required.";
    }
    if (!formData.subjectCode.trim()) {
      newErrors.subjectCode = "Subject code is required.";
    }
    if (!formData.day) {
      newErrors.day = "Day of the week is required.";
    }
    if (!formData.startTime) {
      newErrors.startTime = "Start time is required.";
    }
    if (!formData.endTime) {
      newErrors.endTime = "End time is required.";
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = "End time must be later than start time.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      ...formData,
      id: formData.id || `entry-${Date.now()}`,
    });
  };

  const handleSubjectSelect = (sub) => {
    setFormData((prev) => ({
      ...prev,
      subjectName: sub.name,
      subjectCode: sub.code,
    }));
    // clear error if present
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.subjectName;
      delete copy.subjectCode;
      return copy;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#12121D] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">
              {initialData ? "Edit Timetable Entry" : "Add Lecture Slot"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {initialData
                ? "Update lecture details, timings, or location."
                : "Enter lecture timing and subject details for your weekly schedule."}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick select presets */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Quick fill standard subjects:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_OPTIONS.map((sub) => (
              <button
                key={sub.code}
                type="button"
                onClick={() => handleSubjectSelect(sub)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  formData.subjectCode === sub.code
                    ? "bg-violet-600 text-white"
                    : "border border-white/10 bg-white/[0.02] text-slate-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-200"
                }`}
              >
                {sub.code}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subject Code */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <BookOpen size={13} className="text-violet-400" />
                Subject Code *
              </label>
              <input
                type="text"
                placeholder="e.g. IoTA, MLE"
                value={formData.subjectCode}
                onChange={(e) =>
                  setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })
                }
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
              {errors.subjectCode && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {errors.subjectCode}
                </p>
              )}
            </div>

            {/* Subject Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                placeholder="e.g. IoT & Automation"
                value={formData.subjectName}
                onChange={(e) =>
                  setFormData({ ...formData, subjectName: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
              {errors.subjectName && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {errors.subjectName}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Day of Week */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-violet-400" />
                Day of Week *
              </label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day} value={day} className="bg-[#12121D] text-white">
                    {day}
                  </option>
                ))}
              </select>
              {errors.day && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {errors.day}
                </p>
              )}
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-violet-400" />
                Start Time *
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
              {errors.startTime && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {errors.startTime}
                </p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-violet-400" />
                End Time *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
              {errors.endTime && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle size={11} /> {errors.endTime}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Session Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers size={13} className="text-violet-400" />
                Session Type
              </label>
              <select
                value={formData.sessionType}
                onChange={(e) =>
                  setFormData({ ...formData, sessionType: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              >
                {SESSION_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-[#12121D] text-white">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-violet-400" />
                Faculty
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Kapoor"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            {/* Room / Location */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-violet-400" />
                Room / Location
              </label>
              <input
                type="text"
                placeholder="e.g. Room 402, AI Lab"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>
          </div>

          {/* Lab Batch */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Lab Batch (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Batch B1, Batch B2 (leave empty if for whole class)"
              value={formData.batch}
              onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20"
            >
              {initialData ? "Save Changes" : "Add Lecture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
