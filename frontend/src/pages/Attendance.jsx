import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Sliders,
  CheckCircle,
  AlertCircle,
  UploadCloud,
} from "lucide-react";

import AttendanceSummaryCards from "../components/attendance/AttendanceSummaryCards";
import SubjectAttendanceList from "../components/attendance/SubjectAttendanceList";
import SubjectFormModal from "../components/attendance/SubjectFormModal";
import ImportTimetableModal from "../components/attendance/ImportTimetableModal";
import AttendanceSettingsModal from "../components/attendance/AttendanceSettingsModal";
import AttendanceEmptyState from "../components/attendance/AttendanceEmptyState";

import {
  loadAttendanceSubjects,
  saveAttendanceSubjects,
  loadAttendanceSettings,
  saveAttendanceSettings,
  resetAttendanceData,
} from "../services/attendanceStorage";

import { calculateOverallAttendance } from "../utils/attendanceCalculations";

export default function Attendance({ setActivePage }) {
  // 1. Subjects and settings state (versioned localStorage)
  const [subjects, setSubjects] = useState(() => loadAttendanceSubjects());
  const [settings, setSettings] = useState(() => loadAttendanceSettings());

  // 2. Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Sync subjects to storage
  const updateSubjects = useCallback((newSubjects) => {
    setSubjects(newSubjects);
    saveAttendanceSubjects(newSubjects);
  }, []);

  // Calculate weighted overall statistics
  const overallStats = useMemo(() => {
    return calculateOverallAttendance(subjects, settings.minimumAttendance);
  }, [subjects, settings.minimumAttendance]);

  // Handlers
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setIsFormModalOpen(true);
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setIsFormModalOpen(true);
  };

  const handleSaveSubject = (savedSubject) => {
    if (editingSubject && editingSubject.id) {
      // Update existing subject
      const updated = subjects.map((s) =>
        s.id === savedSubject.id ? savedSubject : s
      );
      updateSubjects(updated);
      showToast(`Updated attendance figures for ${savedSubject.subject_name}`);
    } else {
      // Add new subject
      const updated = [...subjects, savedSubject];
      updateSubjects(updated);
      showToast(`Added ${savedSubject.subject_name} to Attendance Tracker`);
    }

    setIsFormModalOpen(false);
    setEditingSubject(null);
  };

  const handleDeleteSubject = (subject) => {
    if (!subject) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${subject.subject_name}" from your Attendance Tracker?`
    );

    if (confirmed) {
      const updated = subjects.filter((s) => s.id !== subject.id);
      updateSubjects(updated);
      showToast(`Removed "${subject.subject_name}"`, "info");
    }
  };

  const handleImportSubjects = (newSubjects) => {
    if (!newSubjects || newSubjects.length === 0) return;
    const updated = [...subjects, ...newSubjects];
    updateSubjects(updated);
    showToast(
      `Imported ${newSubjects.length} ${
        newSubjects.length === 1 ? "subject" : "subjects"
      } from timetable`
    );
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveAttendanceSettings(newSettings);
    showToast(`Target attendance threshold set to ${newSettings.minimumAttendance}%`);
  };

  const handleResetData = () => {
    resetAttendanceData();
    setSubjects([]);
    setSettings(loadAttendanceSettings());
    showToast("All attendance data has been reset", "info");
  };

  const handleGoToTimetable = () => {
    if (typeof setActivePage === "function") {
      setActivePage("timetable");
    }
  };

  return (
    <div className="space-y-7 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#161622] px-4 py-3 text-xs font-medium text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
          {toast.type === "error" ? (
            <AlertCircle size={16} className="text-rose-400" />
          ) : (
            <CheckCircle size={16} className="text-violet-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Attendance Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your current attendance per subject and predict future attendance and safe bunks.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            title="Configure target criteria"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-violet-500/40 hover:bg-white/5 transition cursor-pointer"
          >
            <Sliders size={14} className="text-slate-400" />
            <span>Target ({settings.minimumAttendance}%)</span>
          </button>

          {subjects.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                title="Import subjects from Timetable"
                className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-600/20 transition cursor-pointer"
              >
                <UploadCloud size={14} />
                <span className="hidden sm:inline">Import</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddSubject}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20 cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Subject</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Top Summary Cards (Always visible, shows weighted overall attendance) */}
      <AttendanceSummaryCards
        overallStats={overallStats}
        minimumAttendance={settings.minimumAttendance}
      />

      {/* 3. Main Subject Content */}
      {subjects.length === 0 ? (
        <AttendanceEmptyState
          onAddSubject={handleOpenAddSubject}
          onImportTimetable={() => setIsImportModalOpen(true)}
          onGoToTimetable={handleGoToTimetable}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Subject Attendance & Predictions
              </h2>
              <p className="text-xs text-slate-400">
                Current figures, safe bunk calculations, and projected semester attendance
              </p>
            </div>

            <span className="text-xs text-slate-500">
              {subjects.length} {subjects.length === 1 ? "Subject" : "Subjects"} Enrolled
            </span>
          </div>

          <SubjectAttendanceList
            subjects={subjects}
            defaultMinimum={settings.minimumAttendance}
            onAddSubject={handleOpenAddSubject}
            onImportTimetable={() => setIsImportModalOpen(true)}
            onEditSubject={handleEditSubject}
            onDeleteSubject={handleDeleteSubject}
          />
        </div>
      )}

      {/* Subject Add/Edit Modal */}
      <SubjectFormModal
        key={editingSubject ? editingSubject.id : "new-subject"}
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSubject(null);
        }}
        onSave={handleSaveSubject}
        initialData={editingSubject}
        defaultMinimum={settings.minimumAttendance}
      />

      {/* Timetable Subject Import Modal */}
      <ImportTimetableModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingSubjects={subjects}
        onImportSubjects={handleImportSubjects}
        onOpenManualCreate={handleOpenAddSubject}
        defaultMinimum={settings.minimumAttendance}
      />

      {/* Attendance Settings Modal */}
      <AttendanceSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onResetData={handleResetData}
      />
    </div>
  );
}