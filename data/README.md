# Bunk Predictor — Synthetic Dataset v1

Based on the uploaded Adani University Semester V CSE (AI-ML), Section B timetable.

## Assumptions
- 200 synthetic anonymous students; attendance threshold 80%.
- Assumed semester window: 3 August–20 November 2026. Confirm official dates later.
- Holidays and exam dates are illustrative assumptions, not official university dates.
- Each 50-minute timetable unit is one attendance record.
- Thursday IoTA lab is represented as two separate 50-minute units.
- Parallel B1/B2/B3 lab sessions are assigned per subject using synthetic batch assignments.
- Library, lunch, club activity, and sports are excluded as attendance-bearing subject lectures.
- All student attributes and attendance statuses are synthetic.

## Files
- `students.csv`: synthetic student profiles and generator metadata.
- `attendance.csv`: lecture-level records; `present_label` is the Model A target.
- `timetable.csv`: extracted timetable, including parallel lab groups.
- `subjects.csv`: subject codes, names, faculty codes, threshold, synthetic difficulty.
- `academic_calendar.csv`: assumed teaching days, holidays/events and exam days.
- `lab_batches.csv`: synthetic lab-batch assignment per student.
- `data_dictionary.csv`: selected column descriptions.

## ML cautions
1. Exclude `synthetic_attendance_persona` and `latent_base_attendance_probability` from model features; they are generation metadata and cause leakage.
2. Prefer chronological or student-group-aware evaluation; random row splitting can leak student-specific patterns.
3. This dataset demonstrates the pipeline and does not establish real-world accuracy.
4. Safe-bunk count should be calculated mathematically, not predicted by ML.
5. Verify timetable interpretation and replace assumed academic dates before final submission.
