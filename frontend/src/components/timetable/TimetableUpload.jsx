import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

export default function TimetableUpload({
  file,
  previewUrl,
  onFileSelect,
  onFileRemove,
  onLoadSample,
  onExtract,
  isExtracting,
  extractionWarnings = [],
  extractionError = null,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef(null);

  const validateAndHandleFile = (selectedFile) => {
    setErrorMessage("");

    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMessage(
        "Unsupported file type. Please upload a PDF or an image (PNG, JPG, JPEG)."
      );
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(
          1
        )} MB). Maximum allowed size is 10 MB.`
      );
      return;
    }

    onFileSelect(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isPdf = file?.type === "application/pdf";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12121D] p-5 sm:p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <UploadCloud size={20} className="text-violet-400" />
            Timetable Import & Extraction
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Upload your college timetable in PDF or Image format (PNG, JPG) to extract schedule entries using PyMuPDF & OCR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {file && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              {isCollapsed ? (
                <>
                  <span>Show Upload Details</span>
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <span>Compact View</span>
                  <ChevronUp size={14} />
                </>
              )}
            </button>
          )}

          <button
            onClick={onLoadSample}
            className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/20 hover:text-white transition"
          >
            <Sparkles size={14} />
            Use Sample Timetable
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-5 space-y-4">
          {/* Upload Dropzone */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                isDragging
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-white/10 hover:border-violet-500/40 hover:bg-white/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400 group-hover:scale-105 group-hover:bg-violet-600/20 transition">
                <UploadCloud size={24} />
              </div>

              <p className="mt-3 text-sm font-medium text-white">
                Drop your timetable file here, or{" "}
                <span className="text-violet-400 underline underline-offset-2">
                  browse files
                </span>
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                Supports PDF, PNG, JPG, or JPEG (up to 10 MB)
              </p>
            </div>
          ) : (
            /* Uploaded File Bar & Actions */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                    {isPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {file.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span>{isPdf ? "PDF Document" : "Image File"}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={12} /> Ready for extraction
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    Replace
                  </button>

                  <button
                    onClick={onFileRemove}
                    disabled={isExtracting}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>

                  <button
                    onClick={onExtract}
                    disabled={isExtracting}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition shadow-md shadow-violet-600/20"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Extract Timetable</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Container */}
              {previewUrl && (
                <div className="rounded-xl border border-white/10 bg-[#09090F] p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <EyeIcon size={14} />
                      Document Preview
                    </span>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                    >
                      Open in new tab <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-lg bg-black/40 flex justify-center">
                    {isPdf ? (
                      <object
                        data={previewUrl}
                        type="application/pdf"
                        className="h-[380px] w-full rounded border border-white/5"
                      >
                        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                          <FileText size={36} className="text-violet-400 mb-2" />
                          <p className="text-sm font-medium text-white">{file.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            PDF preview directly supported. You can also view it in a new window.
                          </p>
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                          >
                            Open PDF <ExternalLink size={13} />
                          </a>
                        </div>
                      </object>
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Uploaded Timetable Preview"
                        className="max-h-[380px] w-auto max-w-full rounded object-contain"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client-side File Validation Error */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
              <AlertTriangle size={16} className="shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Backend Error Banner */}
          {extractionError && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <p className="font-semibold text-red-200">
                    Timetable Extraction Error
                  </p>
                  <p className="text-red-300 leading-relaxed">
                    {extractionError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Extraction Warnings Banner */}
          {extractionWarnings && extractionWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <Info size={18} className="shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <p className="font-semibold text-amber-200">
                    Extraction Completed with Warnings ({extractionWarnings.length})
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    {extractionWarnings.map((warn, wIdx) => (
                      <li key={wIdx}>{warn}</li>
                    ))}
                  </ul>
                  <p className="text-slate-400 pt-1">
                    Slots flagged with <span className="text-amber-300 font-medium">"Needs Review"</span> should be checked or edited using the table below.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EyeIcon({ size = 16, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
