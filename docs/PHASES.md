# PHASES.md — Implementation Phases
### Healthcare Appointment & Follow-up Manager

> Related docs: [PRD](./PRD.md) · [Architecture](./ARCHITECTURE.md) · [Plan](./PLAN.md) · [Design](./DESIGN.md) · [Memory](./MEMORY.md)

Execution order is strictly dependency-based — do not start a later phase whose prerequisites are incomplete.

---

## Phase 0 — Project Setup

**Objective:** Get a runnable skeleton (frontend + backend + DB connection) with no features yet.
**Prerequisites:** None.
**Tasks:**
- 0.1 Initialize backend (Node/Express) and frontend (React) projects per `ARCHITECTURE.md` §9 folder structure.
- 0.2 Configure PostgreSQL + Prisma; create initial empty schema and confirm migration works.
- 0.3 Configure `.env` / `.env.example` with placeholders for DB, JWT secret, email provider, LLM provider, Google OAuth.
- 0.4 Set up centralized error-handling middleware and request logging (per `PLAN.md` §7).
- 0.5 Verify both frontend and backend start successfully and can talk to each other (simple health-check endpoint).
**Files affected:** `backend/src/app.js`, `backend/src/db/`, `frontend/src/App.jsx`, `.env.example`, `README.md` (setup section started).
**Expected output:** App boots; health-check route returns 200; DB connects.
**Testing:** Manual — run backend + frontend, hit health-check.
**Completion criteria:** Both servers run without errors; DB migration applies cleanly.

---

## Phase 1 — Authentication & Roles (FR-001, FR-002)

**Objective:** Patient/doctor/admin can register, log in, and get role-scoped access.
**Prerequisites:** Phase 0.
**Tasks:**
- 1.1 Implement `users` table (Prisma schema) with `role` enum.
- 1.2 Implement `/auth/register`, `/auth/login` with bcrypt hashing and JWT issuance.
- 1.3 Implement auth + role-authorization middleware.
- 1.4 Build frontend Login/Register pages + auth context + `RoleGuard` route wrapper.
**Files affected:** `backend/src/routes/auth.js`, `backend/src/services/auth-service.js`, `backend/src/middleware/auth.js`, `frontend/src/pages/Login.jsx`, `Register.jsx`, `frontend/src/context/AuthContext.jsx`.
**Expected output:** A user can register and log in as patient/doctor/admin and reach a role-appropriate landing page.
**Testing:** Integration test for register/login; manual test of role-based redirect/block.
**Completion criteria:** FR-001, FR-002 acceptance behavior verified; invalid credentials and duplicate email handled.
**Risk level:** Low. Blocking — everything downstream needs auth.

---

## Phase 2 — Admin: Doctor Profile & Leave Management (FR-003, FR-004, FR-005)

**Objective:** Admin can create/manage doctor profiles and mark leave days (notification cascade deferred to Phase 7).
**Prerequisites:** Phase 1.
**Tasks:**
- 2.1 Implement `doctor_profiles`, `doctor_leaves` tables.
- 2.2 Implement `/admin/doctors` (create/update) and `/admin/doctors/:id/leave` (create leave record only, no cascade yet).
- 2.3 Implement slot-template generation logic from working hours + slot duration (pure function, unit-tested).
- 2.4 Build Admin Dashboard + Doctor Management + Leave Management pages.
**Files affected:** `backend/src/services/doctor-service.js`, `backend/src/routes/admin.js`, `frontend/src/pages/AdminDashboard.jsx`, `DoctorManagement.jsx`.
**Expected output:** Admin can create a doctor with specialisation/hours/slot duration and mark a leave day.
**Testing:** Unit test slot-generation function; integration test create/update doctor.
**Completion criteria:** FR-003, FR-004, FR-005 satisfied (leave *notification* cascade is a separate, later phase).
**Risk level:** Low-Medium (slot-generation logic feeds directly into booking correctness).

---

## Phase 3 — Doctor Search & Booking Core, with Concurrency Safety (FR-006–FR-009)

**Objective:** Patient can search, view real available slots, and book — with double-booking prevented under concurrent load.
**Prerequisites:** Phase 2 (doctor + slot data must exist).
**Tasks:**
- 3.1 Implement `appointments` table with the unique `(doctor_id, slot_start)` partial constraint (see `ARCHITECTURE.md` §13).
- 3.2 Implement `GET /doctors?specialisation=`, `GET /doctors/:id/slots` (computed from working hours minus existing bookings minus leave days).
- 3.3 Implement `POST /appointments` as an atomic transaction; return 409 on conflict.
- 3.4 Build Patient Doctor-Search, Slot-Selection, and Booking-Confirmation pages.
- 3.5 Concurrency test: simulate two simultaneous booking requests for the same slot.
**Files affected:** `backend/src/services/booking-service.js`, `backend/src/routes/appointments.js`, `frontend/src/pages/DoctorSearch.jsx`, `SlotSelection.jsx`.
**Expected output:** Patient can book a real slot; a second simultaneous attempt on the same slot is rejected.
**Testing:** Integration + concurrency test (this is the highest-risk task in the project — test explicitly).
**Completion criteria:** FR-006–FR-009 acceptance criteria pass, including the double-booking Acceptance Criteria in `PRD.md` §8.
**Risk level:** High — this is the core "problem-solving" evaluation focus of the assignment.

---

## Phase 4 — Pre-Visit Symptom Form & AI Summary (FR-010–FR-012, FR-024, FR-025 partial)

**Objective:** Patient submits symptoms; LLM returns urgency/chief complaint/questions; doctor can view it.
**Prerequisites:** Phase 3 (needs a booked appointment to attach to).
**Tasks:**
- 4.1 Implement `symptom_forms` table.
- 4.2 Implement LLM service wrapper using the exact prompt specified in the assignment; parse structured output.
- 4.3 Implement `POST /appointments/:id/symptoms`, with try/catch around the LLM call — failure stores `llm_status: FAILED`, never blocks the appointment.
- 4.4 Build Symptom Form page (patient) and AI Summary view (doctor, inside Appointment Detail).
**Files affected:** `backend/src/services/llm-service.js`, `backend/src/services/symptom-service.js`, `backend/src/routes/appointments.js`, `frontend/src/pages/SymptomForm.jsx`, `AppointmentDetail.jsx` (doctor view).
**Expected output:** Doctor sees urgency level, chief complaint, and 3 questions before the visit.
**Testing:** Integration test with a mocked LLM success and a mocked LLM failure (verify FR-024 graceful handling).
**Completion criteria:** PRD §8 Acceptance Criteria for FR-011 and FR-024 pass.
**Risk level:** Medium — depends on correctly parsing LLM output; failure handling is an explicit evaluation criterion.

---

## Phase 5 — Post-Visit Notes & AI Patient Summary (FR-013–FR-015)

**Objective:** Doctor submits notes/prescription; LLM produces a patient-friendly summary.
**Prerequisites:** Phase 4 (reuses the LLM service wrapper) and Phase 3 (needs an appointment).
**Tasks:**
- 5.1 Implement `visit_notes` table.
- 5.2 Implement `POST /appointments/:id/notes` using the second specified prompt; same graceful-failure pattern as Phase 4.
- 5.3 Build Doctor Post-Visit Notes form and Patient Summary view.
**Files affected:** `backend/src/services/visit-notes-service.js`, `frontend/src/pages/PostVisitNotes.jsx` (doctor), `PatientSummary.jsx` (patient).
**Expected output:** Patient can view a plain-language summary with medication schedule and follow-up steps.
**Testing:** Integration test success + LLM-failure path.
**Completion criteria:** FR-013–FR-015 acceptance behavior verified.
**Risk level:** Medium (same class of risk as Phase 4).

---

## Phase 6 — Notifications & Google Calendar Sync (FR-017, FR-018, FR-020–FR-023)

**Objective:** Booking/cancellation triggers email + Calendar sync; failed emails retry.
**Prerequisites:** Phase 3 (booking must exist); Google OAuth requires Phase 1 (user identity).
**Tasks:**
- 6.1 Implement `email_logs`, `calendar_events`, `oauth_tokens` tables.
- 6.2 Implement Notification Service (booking confirmation, cancellation emails) with retry-on-failure background job.
- 6.3 Implement Google OAuth 2.0 flow + Calendar Service (create/update/delete event).
- 6.4 Wire booking creation/cancellation to enqueue email + calendar jobs (async, non-blocking per `ARCHITECTURE.md` §2).
**Files affected:** `backend/src/services/notification-service.js`, `calendar-service.js`, `backend/src/jobs/email-retry-job.js`, `backend/src/routes/auth-google.js`.
**Expected output:** Booking/cancellation produces an email and a Calendar event change for both patient and doctor.
**Testing:** Integration test with a mocked email/Calendar provider; simulate a failed email and confirm retry job picks it up.
**Completion criteria:** FR-017, FR-018, FR-020–FR-023 verified; PRD §8 Calendar acceptance criterion passes.
**Risk level:** Medium-High (external OAuth + two third-party integrations).

---

## Phase 7 — Doctor Leave Conflict Cascade (FR-019)

**Objective:** Marking leave over existing bookings cancels them and notifies affected patients.
**Prerequisites:** Phase 2 (leave marking), Phase 3 (bookings), Phase 6 (notification + calendar services).
**Tasks:**
- 7.1 Extend `/admin/doctors/:id/leave` to run the full cascade transaction described in `ARCHITECTURE.md` §13.
- 7.2 For each affected appointment: mark cancelled, delete calendar event, send notification email.
- 7.3 Build a confirmation UI in Admin Leave Management showing how many bookings will be affected before confirming.
**Files affected:** `backend/src/services/leave-conflict-service.js`, `frontend/src/pages/LeaveManagement.jsx`.
**Expected output:** Marking a leave day over N existing bookings results in N cancellations + N notifications.
**Testing:** Integration test with multiple pre-existing bookings on the target date.
**Completion criteria:** PRD §8 Acceptance Criteria for FR-019 passes.
**Risk level:** Medium (multi-service orchestration; partial-failure handling matters).

---

## Phase 8 — Medication Reminders (FR-016)

**Objective:** Background job sends medication reminder emails per prescription frequency/duration.
**Prerequisites:** Phase 5 (prescription data must exist), Phase 6 (email service).
**Tasks:**
- 8.1 Implement `reminders` table and scheduling logic derived from prescription frequency/duration.
- 8.2 Implement cron-based reminder-check job that finds due reminders and sends them via the Notification Service.
**Files affected:** `backend/src/jobs/reminder-scheduler.js`, `backend/src/services/reminder-service.js`.
**Expected output:** Patient receives reminder emails at the correct intervals for the duration of their prescription.
**Testing:** Unit test the schedule-computation function; integration test with a shortened test interval.
**Completion criteria:** FR-016 verified end-to-end.
**Risk level:** Low-Medium.

---

## Phase 9 — Testing, Documentation & Deployment (Deliverables 2–4)

**Objective:** Satisfy all submission deliverables.
**Prerequisites:** Phases 0–8 complete.
**Tasks:**
- 9.1 Write README: setup guide, `.env.example`, API docs, DB schema, LLM prompts, Google Calendar setup steps.
- 9.2 Write the system design write-up (≤800 words) covering double-booking prevention, leave conflict handling, slot-hold mechanism, notification failure handling — draw directly from `ARCHITECTURE.md` §13 and §11.
- 9.3 Deploy to a free host (Vercel/Render/Railway) for both frontend and backend; confirm the hosted URL works end-to-end.
- 9.4 Run through every user story in `PRD.md` §7 manually as a final acceptance pass.
- 9.5 Clean the repository per submission guidelines (no `node_modules`, `.env`, build artifacts, editor files); confirm branch is `main` and repo is public.
**Files affected:** `README.md`, `docs/system-design-writeup.md`.
**Expected output:** A publicly accessible, working GitHub repo on `main` with a hosted app URL and complete documentation.
**Testing:** Full manual regression pass across all three portals.
**Completion criteria:** Every item in the "Checklist Before Submission" (submission guidelines doc) is satisfied.
**Risk level:** Low, but time-sensitive — do not compress this phase.

---

## Dependency Summary

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
                                   ↑                                     ↑
                        (core booking, highest risk)     (needs Phase 2 leave + Phase 3 bookings
                                                            + Phase 6 notification/calendar)
```

- **Parallelizable:** Frontend pages for a phase can be built alongside that phase's backend work (not a separate later phase).
- **Blocking/high-risk tasks:** Phase 3 (booking concurrency) is the critical path and highest-risk task in the entire project — do not proceed to Phase 4+ until its concurrency test passes.
- **Tasks requiring clarification before finalizing:** Phase 3.3/4.3 (exact symptom-form timing — PRD OQ-3), Phase 2.2/7.1 (whether doctors can self-mark leave — PRD OQ-5).
