# MEMORY.md — Project Memory
### Healthcare Appointment & Follow-up Manager

> Related docs: [PRD](./PRD.md) · [Architecture](./ARCHITECTURE.md) · [Plan](./PLAN.md) · [Phases](./PHASES.md) · [Design](./DESIGN.md)

> **Critical Memory Rule:** This file must be updated after any meaningful unit of work — when a feature/task is completed, when a bug is found, when architecture changes, or when a decision is made. See `PLAN.md` §6 and §10 (Definition of Done, item 4).

---

(Not Started → **Planning** → In Development → Testing → Completed)

---

## 2. Current Phase

```text
Phase 9 — Testing, Documentation & Deployment
```

See [PHASES.md](./PHASES.md) for full phase breakdown and dependency order.

---

## 3. Current Task

```text
Next task: Execute Phase 9 Deployment.
Status: PLANNING
```

---

## 4. Completed Work

```text
[2026-08-23]
- **Phase 8: Medication Reminders (FR-016) completed.**
  - `MedicationReminder` database model and Prisma migration implemented.
  - Frequency and duration parsing implemented, supporting both single and multiple medications per prescription.
  - Reminder scheduling strictly uses `Asia/Kolkata` time semantics while storing absolute UTC timestamps in the database.
  - Reminder scheduler worker implemented to run every 5 minutes.
  - Reminder processing atomically creates an `EmailLog` and marks the `MedicationReminder` as SENT in a single transaction.
  - Reused the existing Phase 6 email retry architecture without creating a second retry mechanism.
  - SMTP is explicitly NOT configured yet, meaning actual external Gmail delivery remains deferred.
  - `test-phase8.js` implemented using safe ephemeral test data and exact cleanup routines.
  - Phase 3–7 regression tests all successfully passed after Phase 8 implementation.
  - Google Calendar and Phase 7 leave-conflict logic remain perfectly intact and unmodified.

[2026-08-23]
- **Phase 9: Testing, Documentation & Deployment Readiness completed.**
  - Phase 9 deployment preparation completed safely without modifying production data or running migrations.
  - Vercel is the planned frontend host.
  - Render or Railway is the planned persistent backend host.
  - Supabase is the planned production PostgreSQL database.
  - Real SMTP delivery and production Google OAuth configurations remain pending until final deployment.
  - Frontend API and backend CORS configured via environment variables for future production URLs, while preserving local localhost functionality.
  - `README.md` and `system-design-writeup.md` finalized.
  - Deployment NOT yet completed.

[2026-08-23]
- **Phase 8: Medication Reminders (FR-016) completed.**
  - Admin leave impact preview endpoint implemented.
  - Admin UI warns how many existing appointments will be affected before confirming leave.
  - When leave is confirmed, affected future SCHEDULED appointments are changed to CANCELLED within a database transaction.
  - Existing COMPLETED/CANCELLED appointments are safely ignored.
  - Cancellation notifications and Google Calendar cancellation actions are delegated to existing Phase 6 asynchronous workers to protect transaction integrity.
  - Phase 7 test script (test-phase7.js) completely rewritten to use only ephemeral test users/data and safe isolated cleanup.
  - Phase 3–6 regression tests passed perfectly.

[2026-08-23]
- **Phase 6: Notifications & Google Calendar Sync completed.**
  - Google OAuth / Google Calendar connection implemented.
  - OAuth tokens stored in the database.
  - Patient Calendar connection persists across backend restarts and new logins.
  - Patient booking strictly requires a Google Calendar connection (Backend enforces via HTTP 403; Frontend automatically refreshes status and shows connection state).
  - Google Calendar appointment synchronization, rescheduling, and cancellation integration verified.
  - Email notification architecture via Nodemailer implemented using `EmailLog` records and an asynchronous email retry worker (up to 3 retries).

[2026-08-22]
- **Phase 5: Post-Visit Notes & AI Patient Summary completed.**
  - `VisitNote` model integrated with 1:1 relation to `Appointment`.
  - Doctors submit clinical notes and optional prescriptions (stored as `prescriptionJson`).
  - System generates a patient-friendly summary using Gemini (`gemini-3.6-flash`).
  - Only the assigned doctor can submit notes, and only after `appointment.slotEnd` has passed.

[2026-08-22]
- **Phase 4: Pre-Visit Symptom Form & AI Summary completed.**
  - Patient symptom submission and duplicate protection implemented.
  - Gemini AI summary and AI-generated questions for doctors implemented.
  - AI failure gracefully degrades without breaking appointment flow.

[2026-08-22]
- **Phase 3: Doctor Search & Booking Core finalization completed.**
  - Doctor search, slot generation, and appointment booking implemented.
  - PostgreSQL/Prisma concurrency protection and double-booking prevention implemented (partial unique index).
  - Patient concurrency/advisory locking implemented.
  - Same-specialisation, overlapping appointment rules, and doctor rescheduling implemented.

[2026-08-22]
- **Phase 2: Admin Doctor Profile & Leave Management completed.**
  - Doctor profiles and 7-day working hours implemented.
  - Doctor leave management implemented and slot generation respects them.

[2026-08-22]
- **Phase 1: Authentication & Roles completed.**
  - PATIENT, DOCTOR, ADMIN roles implemented with JWT authentication.

[2026-08-21]
- Phase 0: Project Setup completed.
  - Node/Express backend, Vite/React frontend, PostgreSQL via Docker.
  - Documentation structure generated.
```

---

## 5. Files Created

```text
docs/PRD.md
docs/ARCHITECTURE.md
docs/PLAN.md
docs/PHASES.md
docs/DESIGN.md
docs/MEMORY.md
docker-compose.yml
backend/package.json
backend/.env
backend/.env.example
backend/prisma/schema.prisma
backend/prisma.config.ts
backend/src/app.js
backend/src/middleware/logger.js
backend/src/middleware/error-handler.js
frontend/package.json
frontend/src/App.jsx
backend/src/db/prisma.js
backend/src/routes/auth.js
backend/src/services/auth-service.js
backend/src/middleware/auth.js
frontend/src/api/apiClient.js
frontend/src/context/AuthContext.jsx
frontend/src/components/RoleGuard.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/Register.jsx
backend/src/services/reminder-service.js
backend/src/jobs/reminder-scheduler.js
backend/test-phase8.js
```

---

## 6. Files Currently Being Modified

```text
None (Phase 8 completed)
```

---

## 7. Pending Tasks

```text
[x] Phase 0 — Project Setup
[x] Phase 1 — Authentication & Roles
[x] Phase 2 — Admin: Doctor Profile & Leave Management
[x] Phase 3 — Doctor Search & Booking Core
[x] Phase 4 — Pre-Visit Symptom Form & AI Summary
[x] Phase 5 — Post-Visit Notes & AI Patient Summary
[x] Phase 6 — Notifications & Google Calendar Sync
[x] Phase 7 — Doctor Leave Conflict Cascade
[x] Phase 8 — Medication Reminders
[ ] Phase 9 — Testing, Documentation & Deployment
```

---

## 8. Known Issues

```text
- Email Delivery Verification: SMTP variables (SMTP_HOST, SMTP_PORT, etc.) are currently NOT configured in the local .env. While the architecture (EmailLog + retry worker) is tested and functioning, real email delivery to external addresses is untested and deferred until deployment configuration.
```

---

## 9. Decisions Made

```text
Decision: Medication reminders currently begin on the next Asia/Kolkata calendar day after the prescription is created, rather than generating a reminder for the current day.
Reason: This was implemented as an explicit assumption/decision to avoid retroactive or immediate reminder spam when a prescription is created late in the afternoon/evening. It aligns with general medical scheduling norms.
Logged in: MEMORY.md §9.

Decision: Use `Asia/Kolkata` (GMT+05:30) as the primary timezone for Google Calendar synchronization and Medication Reminder generation.
Reason: Ensures consistent local time for users. The database continues to store absolute UTC timestamps, and conversions are handled explicitly in backend logic.
Logged in: MEMORY.md §9.

Decision: Postpone production Google OAuth configuration until final deployment (Phase 9).
Reason: The current setup successfully uses a testing OAuth app with a predefined test Gmail account. Final deployment requires valid deployed URLs, at which point the app will be published so the examiner can use their own Google account without being manually added.
Logged in: MEMORY.md §9.

Decision: Strict safe testing policy for all integration tests.
Reason: Destructive commands (`prisma migrate reset`, `TRUNCATE`, unfiltered `deleteMany`) and modifications to permanent users/tokens/appointments are strictly forbidden to protect the database. Tests must use isolated, ephemeral data (e.g. `patient_phase8_<timestamp>@test.com`) and clean up exclusively their own tracked UUIDs.
Logged in: MEMORY.md §9.

Decision: Treat "GitHub repository link only" as authoritative over the assignment PDF's "Zip file with complete source code" deliverable.
Reason: The submission guidelines and explicit instructions are more recent/specific and state ZIP/Drive/PDF submissions "will not be accepted."
Logged in: PRD.md §10 Constraints, §12 OQ-1.

Decision: Use PostgreSQL + Prisma instead of a NoSQL store.
Reason: Data is strongly relational and Prisma's transaction/unique-constraint support is required for double-booking prevention.
Logged in: ARCHITECTURE.md §4, §7, §13.

Decision: Double-booking prevention via a DB-level unique constraint on (doctor_id, slot_start) inside an atomic transaction, rather than application-level locking alone.
Reason: Guarantees correctness even under concurrent requests across multiple server instances.
Logged in: ARCHITECTURE.md §7, §13.

Decision: LLM/email/Calendar integration failures are isolated at the service boundary and never block or roll back the primary user action (booking, note submission).
Reason: Explicit assignment requirement (FR-024).
Logged in: ARCHITECTURE.md §2, §11; PRD.md §8 Acceptance Criteria.

Decision: Phase 5 post-visit summary logic explicitly relies on `appointment.slotEnd < current time` in UTC.
Reason: Prevents doctors from submitting notes prematurely before an appointment finishes.
Logged in: MEMORY.md §9.
```

---

## 10. Dependencies Added

```text
Dependencies as installed during Phases 0-8 (Express, Prisma, React, Nodemailer, @google/genai, node-cron, etc.).
```

---

## 11. API / Database Changes

```text
Schema has evolved through Phase 8 (User, DoctorProfile, Appointment, DoctorLeave, SymptomForm, VisitNote, EmailLog, CalendarEvent, OAuthToken, MedicationReminder).
The latest change introduced `MedicationReminder` and an optional relation on `EmailLog` to link medication details securely for notification processing.
```

---

## 12. Important Context for Next AI

```text
1. This is a graded, scope-limited assignment. Do NOT add features beyond PRD.md §4/§5.
2. Read PRD.md, ARCHITECTURE.md, PLAN.md, PHASES.md, DESIGN.md, and this file (MEMORY.md) before writing or modifying any code.
3. Follow phase order strictly (PHASES.md).
4. Submission format: GitHub repository link only.
5. The two LLM prompts (pre-visit and post-visit) are specified exactly in the assignment and must be used as-is.
6. Whenever a phase/task is completed, update this file's §1 (status), §2 (phase), §3 (task), §4 (completed work log), and §9 (decisions, if any were made) — per the Critical Memory Rule.
7. ALL newly implemented logic must absolutely preserve existing Phase 3 (Concurrency), Phase 4 (Symptoms), Phase 5 (Notes), Phase 6 (OAuth/Calendar), Phase 7 (Leave Cascade), and Phase 8 (Reminders) behavior.
8. ALL tests must follow the safe testing policy defined in §9 (Decisions Made).
```

---

## 13. Last Updated

```text
Last Updated: 2026-08-23
```
