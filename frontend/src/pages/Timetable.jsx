import { useState, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
import {
  CalendarDays,
  Table as TableIcon,
  Download,
  Plus,
  Sparkles,
  RotateCcw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import TimetableUpload from "../components/timetable/TimetableUpload";
import TimetableGrid from "../components/timetable/TimetableGrid";
import TimetableTable from "../components/timetable/TimetableTable";
import TimetableEntryModal from "../components/timetable/TimetableEntryModal";
import {
  SAMPLE_TIMETABLE_ENTRIES,
} from "../data/sampleTimetable";
import { extractTimetableFromFile } from "../services/timetableApi";

const STORAGE_KEY = "bunkpredictor_timetable_entries";

export default function Timetable() {
  // Load initial entries from localStorage, fallback to sample entries
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore JSON parse error
    }
    return SAMPLE_TIMETABLE_ENTRIES;
  });

  const [isSampleActive, setIsSampleActive] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });

  // View mode: 'calendar' or 'table'
  const [viewMode, setViewMode] = useState("calendar");

  // File upload & preview state
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Export state & Toast notification
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState(null);

  // Backend Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractionWarnings, setExtractionWarnings] = useState([]);

  const timetableRef = useRef(null);

  // Save entries to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn("Could not save timetable to localStorage:", e);
    }
  }, [entries]);

  // Clean up Object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // File selection
  const handleFileSelect = (selectedFile) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(selectedFile);
    setExtractionError(null);
    setExtractionWarnings([]);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    showToast(`Loaded ${selectedFile.name} for preview`);
  };

  // File removal
  const handleFileRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setExtractionError(null);
    setExtractionWarnings([]);
    showToast("File removed", "info");
  };

  // Trigger backend extraction
  const handleExtract = async () => {
    if (!file) {
      showToast("Please upload a PDF or image timetable first", "error");
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractionWarnings([]);

    try {
      const result = await extractTimetableFromFile(file);

      if (result.success && Array.isArray(result.entries)) {
        if (result.entries.length === 0) {
          const fallbackWarning =
            "No timetable slots could be detected in this file. Please verify the document format or add slots manually.";
          setExtractionWarnings(
            result.warnings?.length ? result.warnings : [fallbackWarning]
          );
          showToast("No schedule entries detected in the uploaded file", "error");
        } else {
          const normalizedEntries = result.entries.map((item, idx) => ({
            id: `ext-${Date.now()}-${idx}`,
            day: item.day || "Monday",
            startTime: item.start_time || item.startTime || "09:00",
            endTime: item.end_time || item.endTime || "10:00",
            subjectName: item.subject_name || item.subjectName || "Subject",
            subjectCode: item.subject_code || item.subjectCode || "SUB",
            sessionType: item.session_type || item.sessionType || "Theory",
            faculty: item.faculty || "",
            room: item.room || "",
            batch: item.lab_batch || item.batch || "",
            needsReview: Boolean(item.needs_review || item.needsReview),
          }));

          setEntries(normalizedEntries);
          setIsSampleActive(false);
          setExtractionWarnings(result.warnings || []);

          const reviewCount = normalizedEntries.filter((e) => e.needsReview).length;
          if (reviewCount > 0) {
            showToast(
              `Extracted ${normalizedEntries.length} slots (${reviewCount} flagged for review)`,
              "info"
            );
          } else {
            showToast(
              `Successfully extracted ${normalizedEntries.length} timetable entries!`
            );
          }
        }
      } else {
        throw new Error("Invalid response format received from extraction backend.");
      }
    } catch (err) {
      console.error("Timetable extraction error:", err);
      setExtractionError(err.message || "Failed to extract timetable.");
      showToast(err.message || "Extraction failed", "error");
    } finally {
      setIsExtracting(false);
    }
  };

  // Load sample timetable
  const handleLoadSample = () => {
    setEntries(SAMPLE_TIMETABLE_ENTRIES);
    setIsSampleActive(true);
    setExtractionError(null);
    setExtractionWarnings([]);
    showToast("Pre-filled sample timetable loaded (7 subjects, Mon–Fri)");
  };

  // Clear timetable
  const handleClearTimetable = () => {
    if (window.confirm("Are you sure you want to clear all timetable entries?")) {
      setEntries([]);
      setIsSampleActive(false);
      showToast("All timetable entries cleared", "info");
    }
  };

  // Add new entry
  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  // Edit existing entry
  const handleOpenEditModal = (entry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  // Save entry (both add and edit)
  const handleSaveEntry = (entryData) => {
    if (editingEntry) {
      // Update
      setEntries((prev) =>
        prev.map((item) => (item.id === entryData.id ? entryData : item))
      );
      showToast(`Updated "${entryData.subjectCode}" slot`);
    } else {
      // Add
      setEntries((prev) => [...prev, entryData]);
      showToast(`Added "${entryData.subjectCode}" to ${entryData.day}`);
    }
    setIsSampleActive(false);
    setIsModalOpen(false);
  };

  // Delete entry
  const handleDeleteEntry = (entryId) => {
    const entry = entries.find((e) => e.id === entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    setIsSampleActive(false);
    showToast(`Removed ${entry ? entry.subjectCode : "lecture"} entry`, "info");
  };

  // Export timetable as PNG
  const handleExportPNG = async () => {
    if (!timetableRef.current) return;
    setIsExporting(true);

    try {
      // If currently in table view, temporarily notify user or capture table
      const dataUrl = await toPng(timetableRef.current, {
        cacheBust: true,
        pixelRatio: 2, // High-resolution output
        backgroundColor: "#0D0D16",
      });

      const link = document.createElement("a");
      link.download = `bunkpredictor-timetable-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();

      showToast("Timetable image exported successfully!");
    } catch (err) {
      console.error("Failed to export timetable PNG:", err);
      showToast("Export failed. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate high-level stats
  const uniqueSubjectsCount = new Set(entries.map((e) => e.subjectCode)).size;
  const totalLabSessions = entries.filter((e) => e.sessionType !== "Theory").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#161622] px-4 py-3 text-xs font-medium text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
          {toast.type === "error" ? (
            <AlertCircle size={16} className="text-red-400" />
          ) : (
            <CheckCircle size={16} className="text-violet-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Timetable Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload routine files, customize lecture timings, and generate your weekly timetable.
          </p>
        </div>

        {/* Top Summary Metrics */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">
              Subjects
            </span>
            <span className="text-sm font-bold text-white">
              {uniqueSubjectsCount}
            </span>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">
              Weekly Slots
            </span>
            <span className="text-sm font-bold text-violet-300">
              {entries.length}
            </span>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">
              Labs/Practicals
            </span>
            <span className="text-sm font-bold text-indigo-300">
              {totalLabSessions}
            </span>
          </div>
        </div>
      </div>

      {/* Timetable Upload & Extraction Area */}
      <TimetableUpload
        file={file}
        previewUrl={previewUrl}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        onLoadSample={handleLoadSample}
        onExtract={handleExtract}
        isExtracting={isExtracting}
        extractionError={extractionError}
        extractionWarnings={extractionWarnings}
      />

      {/* Timetable Schedule Controls & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border border-white/10 bg-[#12121D] p-1">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "calendar"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CalendarDays size={14} />
              Weekly Calendar
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TableIcon size={14} />
              Editable List View
            </button>
          </div>

          {/* Sample badge */}
          {isSampleActive && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300">
              <Sparkles size={12} />
              Sample timetable active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reset / Clear */}
          {entries.length > 0 && (
            <button
              onClick={handleClearTimetable}
              title="Clear all timetable slots"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            disabled={isExporting || entries.length === 0}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12121D] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-violet-500/40 hover:bg-white/5 disabled:opacity-50 transition"
          >
            <Download size={14} className={isExporting ? "animate-bounce" : ""} />
            <span>{isExporting ? "Generating PNG..." : "Export as PNG"}</span>
          </button>

          {/* Add Lecture */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/20"
          >
            <Plus size={15} />
            <span>Add Lecture</span>
          </button>
        </div>
      </div>

      {/* Main View: Calendar or Table */}
      {viewMode === "calendar" ? (
        <TimetableGrid
          ref={timetableRef}
          entries={entries}
          onEditEntry={handleOpenEditModal}
          onDeleteEntry={handleDeleteEntry}
          onLoadSample={handleLoadSample}
          onAddEntry={handleOpenAddModal}
          isSampleActive={isSampleActive}
        />
      ) : (
        <TimetableTable
          entries={entries}
          onEditEntry={handleOpenEditModal}
          onDeleteEntry={handleDeleteEntry}
          onAddEntry={handleOpenAddModal}
          onLoadSample={handleLoadSample}
        />
      )}

      {/* Add / Edit Entry Modal */}
      <TimetableEntryModal
        key={editingEntry ? editingEntry.id : (isModalOpen ? "modal-open" : "modal-closed")}
        isOpen={isModalOpen}
        initialData={editingEntry}
        onSave={handleSaveEntry}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}