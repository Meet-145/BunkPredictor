# BunkPredictor — Timetable Extraction Backend

FastAPI-powered timetable extraction service for BunkPredictor. It parses college lecture and lab schedules from PDF documents and images (PNG, JPG, JPEG) using **PyMuPDF** (text-layer extraction) and **Tesseract OCR via pytesseract** (for scanned documents and image files).

---

## Features

- **Fast & Lightweight**: Built with FastAPI and Uvicorn.
- **Hybrid Extraction**:
  - Direct digital text extraction from PDFs using PyMuPDF.
  - OCR fallback for scanned PDF pages and images using Tesseract.
- **Normalization**: Automatically maps and formats days of the week, 24-hour time ranges (`HH:MM`), subject codes/names, session types (Theory, Lab, Practical/Programming), faculty, rooms, and lab batches.
- **Reliability & Warnings**: Flags ambiguous or incomplete entries with `needs_review: true` and descriptive warning messages without inventing missing lectures.
- **Graceful Tesseract Error Handling**: Returns actionable error guidance if OCR is needed but Tesseract is not installed on the system.
- **CORS Configured**: Pre-configured for Vite development servers running on `http://localhost:5173` or `http://localhost:5174`.

---

## Project Structure

```
backend/
├── main.py              # FastAPI server entry point and endpoint routing
├── parser.py            # Extraction logic (PyMuPDF, OCR, regex parsing, normalization)
├── test_parser.py       # Pytest unit and endpoint test suite
├── requirements.txt     # Python package dependencies
├── README.md            # Backend documentation
└── .venv/               # Virtual environment
```

---

## Installation & Setup

### 1. Create and Activate Virtual Environment

```bash
cd backend

# On Windows
python -m venv .venv
.\.venv\Scripts\activate

# On Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Tesseract OCR Setup (Windows)

OCR is required when uploading images (PNG, JPG) or scanned/flattened PDFs.

1. Download the Tesseract installer for Windows:
   - Official UB-Mannheim binary: [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
2. Run the installer (default installation path: `C:\Program Files\Tesseract-OCR`).
3. Add `C:\Program Files\Tesseract-OCR` to your system `PATH`:
   - Search for **"Edit the system environment variables"** in the Windows Start menu.
   - Click **Environment Variables...**
   - Under **System variables**, select `Path` and click **Edit...**
   - Click **New** and add: `C:\Program Files\Tesseract-OCR`
   - Click **OK** to save.
4. Verify by opening a new terminal and running:
   ```bash
   tesseract --version
   ```
*(Note: If Tesseract is not installed, the backend will still parse digital text PDFs perfectly, and will return a helpful, clear message if an image or scanned document is submitted.)*

---

## Running the Server

Start the development server with hot-reload enabled:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at:
- **Base URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## API Endpoints

### 1. Health Check
- **`GET /health`**
- Response:
  ```json
  {
    "status": "healthy",
    "tesseract_available": true,
    "tesseract_info": "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
  }
  ```

### 2. Extract Timetable
- **`POST /api/timetable/extract`**
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (PDF, PNG, JPG, or JPEG)
- **Sample Success Response**:
  ```json
  {
    "success": true,
    "filename": "timetable.pdf",
    "entries": [
      {
        "day": "Monday",
        "start_time": "12:10",
        "end_time": "13:00",
        "subject_name": "Machine Learning Essentials",
        "subject_code": "MLE",
        "session_type": "Theory",
        "faculty": "Dr. A. Kapoor",
        "room": "Room 402",
        "lab_batch": "",
        "needs_review": false
      }
    ],
    "warnings": [],
    "extraction_method": "pdf_text"
  }
  ```

---

## Running Tests

Run the test suite using pytest:

```bash
pytest -v
```
