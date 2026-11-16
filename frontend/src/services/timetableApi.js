/**
 * timetableApi.js - Centralized API Service for BunkPredictor Timetable Backend
 */

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : "http://localhost:8000"
  ).replace(/\/+$/, "");

/**
 * Sends a PDF or image file to POST /api/timetable/extract
 * @param {File} file
 * @returns {Promise<{success: boolean, filename: string, entries: Array, warnings: Array, extraction_method: string}>}
 */
export async function extractTimetableFromFile(file) {
  if (!file) {
    throw new Error("No file selected for extraction.");
  }

  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/timetable/extract`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}. Ensure the FastAPI server is running with 'uvicorn main:app --reload --port 8000'.`
    );
  }

  if (!response.ok) {
    let errorMessage = `Extraction failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorMessage = errorJson.detail;
      }
    } catch {
      // Use fallback error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Checks backend health
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    return { status: "unreachable" };
  }
  return { status: "error" };
}
