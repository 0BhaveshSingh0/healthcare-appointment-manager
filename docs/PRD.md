# PRD.md — Product Requirements Document
### Healthcare Appointment & Follow-up Manager

> Related docs: [Architecture](./ARCHITECTURE.md) · [Plan](./PLAN.md) · [Phases](./PHASES.md) · [Design](./DESIGN.md) · [Memory](./MEMORY.md)

---

## 1. Project Overview

- **Project name:** Healthcare Appointment & Follow-up Manager
- **Assignment name:** Unthinkable project-based assignment — "Healthcare Appointment & Follow-up Manager"
- **One-line description:** A three-portal (patient / doctor / admin) clinic platform that lets patients book appointments and share symptoms in advance, gives doctors an AI-generated pre-visit summary, produces an AI-generated patient-friendly post-visit summary, and keeps everyone informed via email and Google Calendar.
- **Problem being solved:** A basic booking form is not enough — patients want to share symptoms ahead of time and get reminders; doctors want a fast pre-visit summary instead of reading raw symptom text; both sides need reliable, timely confirmations.
- **Proposed solution:** A role-based web application with booking, conflict-safe slot management, LLM-generated pre-visit and post-visit summaries, medication reminders, and automated email + Google Calendar sync.

---

## 2. Assignment Scope

**Included (Confirmed, from assignment doc):**
- Patient registration/login, doctor search by specialisation, slot booking
- Admin management of doctor profiles (specialisation, working hours, slot duration, leave days)
- Double-booking prevention / safe concurrent booking
- Doctor leave conflict handling with patient notification
- Pre-visit symptom form → LLM pre-visit summary (urgency, chief complaint, 3 questions)
- Doctor post-visit notes + prescription → LLM patient-friendly summary
- Medication reminders based on prescription frequency
- Email notifications (booking confirmation, reminder, cancellation) to patient and doctor
- Google Calendar event creation/update/deletion via OAuth 2.0
- Role-based authentication (patient / doctor / admin)
- Graceful handling of LLM failures

**Explicitly NOT included / out of scope (not mentioned in assignment):**
- Payments / billing
- Video consultation
- Insurance handling
- Native mobile apps
- Multi-clinic / multi-tenant support
- Chat between patient and doctor (only structured symptom form + notes)

**Scope discipline:** Per assignment rules, only the allocated assignment is to be built — no additional features beyond what is listed above and what is reasonably necessary to satisfy the "Technical Expectations" and "Evaluation Focus" sections.

---

## 3. Target Users

### 3.1 Patient
- **Goals:** Find a doctor, book a convenient slot, describe symptoms ahead of time, get reminders, understand what happened after the visit.
- **Problems:** Forgetting appointments, not knowing what to tell the doctor, not understanding clinical notes, missing medication doses.
- **Actions:** Register/login, search doctors by specialisation, view available slots, book/cancel/reschedule, submit symptom form, view pre/post-visit summaries, receive email + calendar invites, receive medication reminders.
- **Information needed:** Doctor availability, appointment status, symptom form status, post-visit summary, medication schedule.

### 3.2 Doctor
- **Goals:** See a fast, accurate summary before each visit; record notes and prescriptions efficiently; be informed of schedule changes.
- **Problems:** Reading long raw symptom text, being double-booked, not knowing about last-minute leave conflicts.
- **Actions:** View schedule, view AI pre-visit summary per booking, submit post-visit notes + prescription, mark leave (via admin or self, per confirmation), receive email/calendar updates.
- **Information needed:** Daily schedule, patient symptom summaries, urgency levels, booking changes.

### 3.3 Admin
- **Goals:** Keep doctor profiles and schedules accurate and up to date.
- **Problems:** Manually communicating leave-driven cancellations to every affected patient.
- **Actions:** Create/edit/delete doctor profiles, set specialisation/working hours/slot duration, mark leave days, trigger/verify patient notifications for leave conflicts.
- **Information needed:** List of doctors, their schedules, upcoming bookings per doctor, leave conflicts.

---

## 4. Core Features

### F1 — Authentication & Role-Based Access
- **Purpose:** Separate, secure portals for patient/doctor/admin.
- **Interaction:** Register/login forms; session/JWT-based auth.
- **Inputs:** Email, password, role-specific profile fields.
- **Processing:** Credential validation, password hashing, role assignment, token issuance.
- **Outputs:** Authenticated session, role-scoped UI/API access.
- **Dependencies:** None (foundational).
- **Edge cases:** Duplicate email registration, invalid credentials, expired/invalid tokens, role mismatch on protected routes.

### F2 — Admin: Doctor Profile Management
- **Purpose:** Admin defines doctors and their availability rules.
- **Interaction:** Admin form to create/edit doctor (specialisation, working hours, slot duration, leave days).
- **Inputs:** Doctor details, working hours, slot duration, leave dates.
- **Processing:** Persist doctor profile; derive bookable slots from working hours + slot duration; exclude leave days.
- **Outputs:** Doctor record, generated slot template.
- **Dependencies:** F1 (admin auth).
- **Edge cases:** Overlapping working hours edits after bookings exist, slot duration change affecting already-booked slots, invalid time ranges.

### F3 — Doctor Search & Slot Booking (Patient)
- **Purpose:** Patient finds a doctor and books an available slot.
- **Interaction:** Search by specialisation → view doctor list → view available slots → select slot → confirm.
- **Inputs:** Specialisation filter, chosen doctor, chosen date/time slot.
- **Processing:** Query available (non-booked, non-leave) slots; lock/hold slot during booking; create appointment atomically.
- **Outputs:** Confirmed appointment record.
- **Dependencies:** F1, F2.
- **Edge cases:** Two patients selecting the same slot simultaneously (double-booking), slot becomes unavailable mid-booking, booking on a doctor's leave day.

### F4 — Pre-Visit Symptom Form + AI Summary
- **Purpose:** Give the doctor a fast, structured view of the patient's condition before the visit.
- **Interaction:** Patient fills symptom form after booking, before the appointment is finalised/confirmed.
- **Inputs:** Free-text symptoms (and any structured fields collected).
- **Processing:** Send symptoms to LLM using the specified prompt; parse urgency level (Low/Medium/High), chief complaint, and 3 suggested questions; store result.
- **Outputs:** Stored pre-visit AI summary, visible to doctor before/at the visit.
- **Dependencies:** F3 (must be attached to a booking).
- **Edge cases:** LLM API failure/timeout, malformed LLM output, empty/very short symptom text, patient not submitting the form before the visit.

### F5 — Post-Visit Notes + AI Patient Summary
- **Purpose:** Turn clinical notes into a patient-friendly explanation.
- **Interaction:** Doctor submits notes + prescription after the visit.
- **Inputs:** Clinical notes (free text), prescription (medication name, dosage, frequency, duration).
- **Processing:** Send notes to LLM using the specified prompt; generate patient-friendly summary with medication schedule and follow-up steps; store result.
- **Outputs:** Stored post-visit AI summary, visible to patient.
- **Dependencies:** F3 (appointment must exist and have occurred).
- **Edge cases:** LLM failure, missing/ambiguous prescription data, doctor submits notes without a prescription.

### F6 — Medication Reminders
- **Purpose:** Remind patients to take medication per prescription frequency.
- **Interaction:** Automated background job; patient receives email reminders.
- **Inputs:** Prescription frequency/duration from F5.
- **Processing:** Background scheduler computes reminder times; sends email at each interval; retries on failure.
- **Outputs:** Reminder emails.
- **Dependencies:** F5.
- **Edge cases:** Email delivery failure (needs retry), prescription duration ending, patient with multiple active prescriptions.

### F7 — Doctor Leave Management & Conflict Notification
- **Purpose:** Keep patients informed when a doctor becomes unavailable.
- **Interaction:** Admin (or doctor, TBC) marks a leave day.
- **Inputs:** Doctor ID, leave date(s).
- **Processing:** Check for existing bookings on that date; for each affected booking, trigger cancellation/reschedule flow and notify the patient (email + calendar update).
- **Outputs:** Updated bookings, notification emails, updated/deleted calendar events.
- **Dependencies:** F2, F3, F8.
- **Edge cases:** Leave marked with many affected bookings (bulk notification), notification failures, leave marked for a past date, partial-day leave (TBC).

### F8 — Email Notifications
- **Purpose:** Keep patient and doctor informed at every state change.
- **Interaction:** System-triggered (no direct user interaction).
- **Inputs:** Event type (booking confirmed, reminder, cancellation), recipient, appointment data.
- **Processing:** Compose and send email via email service provider; retry on failure (background job).
- **Outputs:** Delivered email (or logged failure after retries exhausted).
- **Dependencies:** F3, F6, F7.
- **Edge cases:** Provider outage, invalid email address, rate limiting.

### F9 — Google Calendar Sync
- **Purpose:** Give patient and doctor a calendar entry for each appointment.
- **Interaction:** Automatic on booking/reschedule/cancellation; requires one-time OAuth 2.0 consent per user.
- **Inputs:** Appointment date/time, participants.
- **Processing:** Create event on booking; update event on reschedule; delete event on cancellation.
- **Outputs:** Google Calendar event (create/update/delete).
- **Dependencies:** F3, F1 (OAuth tied to user account).
- **Edge cases:** User has not granted Calendar access, OAuth token expired/revoked, Calendar API failure.

---

## 5. Functional Requirements

```text
FR-001  System shall support registration/login for patient, doctor, and admin roles.
FR-002  System shall restrict each portal's features to its respective role.
FR-003  Admin shall be able to create, edit, and deactivate doctor profiles.
FR-004  Admin shall define a doctor's specialisation, working hours, and slot duration.
FR-005  Admin shall be able to mark leave days for a doctor.
FR-006  Patient shall be able to search doctors by specialisation.
FR-007  Patient shall be able to view a doctor's available (bookable) slots only.
FR-008  System shall prevent two bookings from being confirmed for the same doctor/slot (double-booking).
FR-009  System shall handle simultaneous booking attempts for the same slot safely (only one succeeds).
FR-010  Patient shall submit a symptom form associated with a booked appointment.
FR-011  System shall send the symptom text to an LLM and store the returned urgency level, chief complaint, and 3 suggested questions.
FR-012  Doctor shall be able to view the pre-visit AI summary for an upcoming appointment.
FR-013  Doctor shall submit post-visit notes and a prescription for a completed appointment.
FR-014  System shall send the clinical notes to an LLM and store the returned patient-friendly summary.
FR-015  Patient shall be able to view the post-visit summary and medication schedule.
FR-016  System shall schedule medication reminder emails based on prescription frequency and duration.
FR-017  System shall send booking confirmation emails to patient and doctor.
FR-018  System shall send cancellation emails to patient and doctor when a booking is cancelled.
FR-019  When a doctor is marked on leave for a date with existing bookings, system shall notify all affected patients.
FR-020  System shall create a Google Calendar event for patient and doctor upon booking confirmation.
FR-021  System shall update the Google Calendar event upon reschedule.
FR-022  System shall delete the Google Calendar event upon cancellation.
FR-023  System shall retry failed email sends via a background job.
FR-024  System shall continue normal operation (not crash/block booking) if the LLM call fails, and shall record the failure.
FR-025  System shall store all LLM outputs (pre-visit and post-visit summaries) in the database.
```

---

## 6. Non-Functional Requirements

- **Performance:** Slot lookup and booking confirmation should respond within a few seconds under normal load; LLM calls must not block the booking transaction itself (booking succeeds independently of symptom-form AI processing where feasible).
- **Security:** Passwords hashed (never stored plain text); role-based authorization enforced server-side on every endpoint; OAuth tokens for Google Calendar stored securely and never exposed to the frontend; input validation on all forms.
- **Scalability:** Booking concurrency control (see FR-009) must scale to multiple simultaneous users per doctor without data corruption.
- **Reliability:** Email and LLM failures must not corrupt appointment state; background jobs must be resumable/retryable.
- **Maintainability:** Clear separation of concerns (API/business logic/data layer); documented API and DB schema (per deliverables).
- **Accessibility:** Forms must be usable with keyboard navigation and have labeled inputs (baseline accessibility — see [Design](./DESIGN.md)).
- **Responsiveness:** UI usable on desktop and mobile screen widths.
- **Error handling:** User-facing errors must be clear and actionable; system errors must be logged.
- **Data validation:** All user input (symptoms, prescriptions, working hours, leave dates) validated before persistence.

---

## 7. User Stories

```text
As a patient, I want to search doctors by specialisation, so that I can find the right doctor for my condition.

As a patient, I want to book an available slot, so that I can schedule a visit without calling the clinic.

As a patient, I want to describe my symptoms before the visit, so that the doctor is prepared.

As a patient, I want to receive a patient-friendly summary after my visit, so that I understand my diagnosis and next steps.

As a patient, I want medication reminders, so that I don't miss a dose.

As a patient, I want to be notified if my doctor cancels due to leave, so that I can rebook.

As a doctor, I want an AI-generated pre-visit summary with urgency level, so that I can prioritise and prepare quickly.

As a doctor, I want to submit notes and a prescription after a visit, so that the patient receives a clear summary automatically.

As an admin, I want to manage doctor profiles and leave days, so that the schedule stays accurate.

As an admin, I want affected patients to be automatically notified when a doctor goes on leave, so that I don't have to contact them manually.
```

---

## 8. Acceptance Criteria

```text
FR-008 / FR-009 — Double-booking prevention
Given a doctor has one open slot at 10:00 AM,
When two patients attempt to book that slot at the same time,
Then exactly one booking succeeds and the other receives a "slot no longer available" response.

FR-011 — Pre-visit AI summary
Given a patient has submitted a symptom form for a booked appointment,
When the system processes it,
Then an urgency level (Low/Medium/High), a chief complaint, and exactly 3 suggested questions are stored and viewable by the assigned doctor.

FR-019 — Leave conflict notification
Given a doctor has 3 existing bookings on a date,
When admin marks that date as leave,
Then all 3 affected patients receive a notification email and their appointment status is updated.

FR-020/021/022 — Calendar sync
Given a patient books, reschedules, then cancels an appointment,
When each action completes,
Then a Google Calendar event is created, then updated, then deleted respectively for both patient and doctor.

FR-024 — LLM failure handling
Given the LLM service is unavailable,
When a patient submits a symptom form,
Then the booking/appointment remains valid, the failure is logged, and the user sees a graceful message (not a crash).
```

---

## 9. User Flow

**Patient — happy path:**
1. Register/login → 2. Search doctor by specialisation → 3. View available slots → 4. Select & confirm slot (booking created) → 5. Fill symptom form → 6. AI pre-visit summary generated → 7. Receive booking confirmation email + calendar invite → 8. Attend visit → 9. Doctor submits notes/prescription → 10. AI post-visit summary generated → 11. Patient views summary + medication schedule → 12. Patient receives medication reminder emails.

**Doctor — happy path:**
1. Login → 2. View upcoming appointments → 3. Open an appointment → view AI pre-visit summary → 4. Conduct visit → 5. Submit post-visit notes + prescription → 6. System generates and stores patient summary.

**Admin — happy path:**
1. Login → 2. Create doctor profile (specialisation, hours, slot duration) → 3. Manage leave days → 4. On marking leave over existing bookings, system auto-notifies affected patients.

---

## 10. Constraints

- Only the assigned project/scope may be implemented (no scope creep), per company instruction.
- **Submission format conflict (see Section 12 / Open Questions):** the assignment PDF lists "Zip file with complete source code" as a deliverable, but the Assignment Submission Usage Guidelines and the accompanying instructions explicitly require a **GitHub repository link only**, stating ZIP/Drive/PDF submissions "will not be accepted." The GitHub-only rule is treated as authoritative since it is the more recent/explicit instruction.
- Repository must be public, on branch `main`, without `node_modules`, `.env`, build artifacts, or editor-specific files.
- Dependencies must be kept minimal — "no extra modules... use only what is strictly required."
- Deliverables required: hosted application URL (free hosting), README (setup, `.env.example`, API docs, DB schema, LLM prompts, Google Calendar setup), and an 800-word-max system design write-up.
- The two LLM prompts (pre-visit, post-visit) are explicitly specified in the assignment and must be used as given (not redesigned).

---

## 11. Assumptions

*(Inferred — reasonable conclusions, not explicitly stated)*

- A relational database is appropriate given the strongly relational data (doctors, patients, appointments, leave days, prescriptions).
- "Register/login" implies email + password authentication with hashed passwords and token-based (e.g., JWT) sessions.
- Admin accounts are seeded/created outside of public self-registration (not stated, but standard practice for admin roles).
- "Slot" means a fixed-duration time block derived from a doctor's working hours and configured slot duration.
- The symptom form is submitted after booking and before the visit (assignment says "before confirming" — see Open Question OQ-3 on exact timing).
- Free-tier hosting (Vercel/Render/Railway) and free-tier email/LLM providers are acceptable for this assignment.

---

## 12. Open Questions

```text
OQ-1  Submission format conflict: assignment doc says "Zip file," while submission guidelines and
      explicit instructions say GitHub-only, ZIP not accepted. RESOLUTION APPLIED: GitHub-only
      is treated as authoritative for actual submission; confirm with the assigning company if in doubt.

OQ-2  Which LLM provider should be used? RESOLUTION APPLIED: Google Gemini using the official @google/genai Node.js SDK and the gemini-2.5-flash model.

OQ-3  Exact timing of the symptom form: assignment says patient "fills a symptom form before
      confirming" (implying before booking is finalized) but also frames it as pre-visit prep.
      NEEDS CONFIRMATION on whether the form is part of the booking flow itself or a separate
      step after booking, before the visit date.

OQ-4  No specific frontend/backend framework is mandated by the assignment. A stack is
      recommended in Architecture.md, but this is INFERRED, not confirmed.

OQ-5  Is doctor self-registration allowed, or are all doctor accounts created by admin only?
      Assignment implies admin manages doctor profiles — TBD whether doctors can log in
      independently or are fully managed by admin.

OQ-6  What exactly constitutes the "slot hold mechanism" mentioned in Deliverable #4 — no
      further detail is given in the assignment; a reasonable design is proposed in
      Architecture.md but is NOT explicitly confirmed by the source document.

OQ-7  Partial-day doctor leave — assignment mentions "leave days" (whole days) only; partial-day
      leave is out of scope unless confirmed otherwise.
```
