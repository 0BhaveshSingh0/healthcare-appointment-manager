# ARCHITECTURE.md — Technical Architecture
### Healthcare Appointment & Follow-up Manager

> Related docs: [PRD](./PRD.md) · [Plan](./PLAN.md) · [Phases](./PHASES.md) · [Design](./DESIGN.md) · [Memory](./MEMORY.md)

---

## 1. Architecture Overview

```text
User (Patient / Doctor / Admin)
        ↓
Frontend (Role-aware SPA)
        ↓ (REST API, JWT auth)
Backend API (Express/Node.js)
        ↓
Business Logic Layer (booking engine, leave-conflict handler,
                       LLM service, notification service)
        ↓
        ├── Database (PostgreSQL) — appointments, users, doctors, prescriptions, summaries
        ├── LLM Provider API (pre-visit / post-visit summaries)
        ├── Email Provider API (SendGrid/Mailgun/Nodemailer)
        └── Google Calendar API (OAuth 2.0)
        ↓
Background Job Runner (medication reminders, email retries)
```

This is a standard 3-tier web architecture with two async side-effect integrations (LLM, email/calendar) kept out of the critical booking path where possible, per NFR "LLM/email failures must not break booking."

---

## 2. Application Flow

1. Frontend authenticates via `/auth` endpoints → receives JWT → attaches to all subsequent requests.
2. Patient books a slot → API performs an atomic slot-reservation transaction (see §7 Concurrency) → appointment row created with status `CONFIRMED`.
3. On successful booking, API enqueues async jobs: send confirmation email, create Calendar event. Failures in these jobs do **not** roll back the booking.
4. Patient submits symptom form → API calls LLM service → on success, stores structured summary; on failure, stores `status: FAILED` and logs it, booking remains intact (FR-024).
5. Doctor submits post-visit notes/prescription → API calls LLM service for patient summary → stores result → schedules medication reminder jobs based on prescription frequency/duration.
6. Admin marks doctor leave → API finds all bookings on that date for that doctor → for each: cancels/flags appointment, deletes Calendar event, sends notification email (FR-019).
7. Background job runner periodically: sends due medication reminders, retries failed emails (bounded retry count with backoff).

---

## 3. Major Components

| Component | Responsibility | Inputs | Outputs | Depends on |
|---|---|---|---|---|
| Auth Service | Register/login, JWT issuance, role checks | credentials | JWT, user session | DB |
| Doctor Service | CRUD doctor profiles, working hours, leave | admin input | doctor records, slot templates | DB |
| Booking Service | Slot lookup, atomic booking, cancel/reschedule | patient selection | appointment record | DB, Doctor Service |
| Symptom/LLM Service | Send prompts to LLM, parse/store output | symptom text / clinical notes | structured summary | LLM Provider |
| Notification Service | Compose/send emails, retries | event + recipient | sent email / retry job | Email Provider |
| Calendar Service | Create/update/delete Calendar events | appointment data + OAuth token | Calendar event | Google Calendar API |
| Reminder Scheduler | Compute and dispatch medication reminders | prescription data | reminder emails | Notification Service |
| Leave Conflict Handler | React to leave marking, cascade updates | doctor ID + date | updated bookings, notifications | Booking, Notification, Calendar |

---

## 4. Technology Stack

*(Recommended — INFERRED, since the assignment does not mandate a stack. See PRD Open Question OQ-4.)*

| Technology | Version | Why | Where used |
|---|---|---|---|
| Node.js | LTS (20.x) | Assignment references Nodemailer/SendGrid-style stack; large ecosystem, fast to build REST APIs | Backend runtime |
| Express.js | 4.x | Minimal, well-understood REST framework — avoids over-engineering | Backend API layer |
| React | 18.x | Standard, well-supported SPA library for role-based dashboards | Frontend |
| PostgreSQL | 15.x | Data is strongly relational (users, doctors, appointments, prescriptions, leaves) | Primary database |
| Prisma (or plain `pg`) | latest | Type-safe queries, migrations, and — importantly — supports transactions/row locking needed for double-booking prevention | ORM / DB access |
| JWT (jsonwebtoken) | latest | Stateless role-based auth across 3 portals | Auth |
| node-cron / BullMQ | latest | Scheduling medication reminders and email retries | Background jobs |
| SendGrid or Nodemailer | latest | Email delivery (assignment explicitly allows either) | Notifications |
| Google Calendar API + googleapis | latest | Required by assignment for calendar sync | Calendar integration |
| LLM Provider SDK (OpenAI/Anthropic — TBD) | latest | Pre-visit and post-visit summaries | AI summaries |

**Not recommended (avoid over-engineering):** microservices split, GraphQL, Redis-based caching, Kubernetes, message queues beyond a simple job runner — none are justified by assignment scope.

---

## 5. Frontend Architecture

- **Pages:** Login/Register, Patient Dashboard, Doctor Search, Doctor Profile/Slots, Booking Confirmation, Symptom Form, Doctor Dashboard, Appointment Detail (doctor view w/ AI summary), Post-Visit Notes Form, Patient Summary View, Admin Dashboard, Doctor Management, Leave Management.
- **Components:** Reusable `Button`, `Input`, `Card`, `Table`, `Modal`, `Alert/Toast`, `LoadingSpinner`, `EmptyState`, `RoleGuard` (route wrapper).
- **State management:** Local component state + a lightweight global store (e.g., React Context) for auth/user session; server data fetched per-page (no heavy client cache library needed at this scope).
- **API communication:** Central `apiClient` wrapper (fetch/axios) that attaches JWT and handles common error shapes.
- **Routing:** Role-based route guards (patient/doctor/admin route groups); unauthenticated users redirected to login.
- **Form handling:** Controlled components with client-side validation mirroring backend validation rules.
- **Error handling:** Toast/alert on API errors; inline field errors on validation failures; fallback UI for failed data loads.

---

## 6. Backend Architecture

- **Routes:** `/auth`, `/doctors`, `/doctors/:id/slots`, `/appointments`, `/appointments/:id/symptoms`, `/appointments/:id/notes`, `/admin/doctors`, `/admin/leave`.
- **Controllers:** Thin — parse/validate request, call service, return response.
- **Services:** Business logic per component in §3 (Auth, Doctor, Booking, Symptom/LLM, Notification, Calendar, Reminder, LeaveConflict).
- **Middleware:** JWT auth verification, role authorization, request validation (e.g., Zod/Joi schemas), centralized error handler, request logger.
- **Validation:** Schema validation on every write endpoint (booking, symptom form, notes/prescription, doctor profile, leave).
- **Authentication:** JWT bearer tokens; password hashing with bcrypt.
- **Error handling:** Centralized error middleware mapping known errors (validation, conflict, not found, auth) to appropriate HTTP status codes; unknown errors logged and returned as generic 500.

---

## 7. Database Architecture

**Entities:**

- `users` (id, name, email, password_hash, role[patient|doctor|admin], created_at)
- `doctor_profiles` (id, user_id FK, specialisation, working_hours_json, slot_duration_minutes, created_at)
- `doctor_leaves` (id, doctor_id FK, leave_date, reason, created_at)
- `appointments` (id, patient_id FK, doctor_id FK, slot_start, slot_end, status[HELD|CONFIRMED|CANCELLED|COMPLETED], created_at)
  - Unique constraint on `(doctor_id, slot_start)` where status != CANCELLED — this is the core double-booking guard (see §13 Concurrency below).
- `symptom_forms` (id, appointment_id FK unique, raw_symptoms_text, ai_urgency, ai_chief_complaint, ai_questions_json, llm_status[SUCCESS|FAILED], created_at)
- `visit_notes` (id, appointment_id FK unique, clinical_notes, prescription_json, ai_patient_summary, llm_status, created_at)
- `reminders` (id, visit_notes_id FK, scheduled_at, sent_at, status[PENDING|SENT|FAILED])
- `email_logs` (id, appointment_id FK nullable, recipient, type[CONFIRMATION|REMINDER|CANCELLATION], status, retry_count, last_attempt_at)
- `calendar_events` (id, appointment_id FK, user_id FK, google_event_id, status)
- `oauth_tokens` (id, user_id FK, provider[google], access_token, refresh_token, expires_at)

**Relationships:**
- `users` 1—1 `doctor_profiles` (for doctor-role users)
- `doctor_profiles` 1—many `doctor_leaves`
- `doctor_profiles` 1—many `appointments`
- `users`(patient) 1—many `appointments`
- `appointments` 1—1 `symptom_forms`
- `appointments` 1—1 `visit_notes`
- `visit_notes` 1—many `reminders`
- `appointments` 1—many `email_logs`, `calendar_events`

**Indexes:** `(doctor_id, slot_start)` unique partial index on active appointments; index on `users.email`; index on `doctor_leaves(doctor_id, leave_date)`.

**Core CRUD:** standard create/read/update/(soft-)delete on all entities; appointments use status transitions rather than hard deletes.

---

## 8. API Design

```text
POST   /auth/register            Register user (patient/doctor/admin per flow)
POST   /auth/login               Login, returns JWT
                                  Auth: none | Errors: 400 invalid input, 401 bad credentials

GET    /doctors?specialisation=  Search doctors
                                  Auth: patient | Errors: 400

GET    /doctors/:id/slots        Get available slots for a doctor
                                  Auth: patient | Errors: 404 doctor not found

POST   /appointments             Book a slot (atomic)
       Request: { doctorId, slotStart }
       Response: appointment object
                                  Auth: patient | Errors: 409 slot already booked, 422 slot on leave day

POST   /appointments/:id/symptoms   Submit symptom form, triggers LLM
                                  Auth: patient (owner) | Errors: 404, 502 LLM failure (handled gracefully, stored as FAILED)

GET    /appointments/:id            Get appointment detail (incl. AI summary)
                                  Auth: patient(owner) | doctor(assigned) | Errors: 403, 404

POST   /appointments/:id/notes      Submit post-visit notes + prescription, triggers LLM
                                  Auth: doctor(assigned) | Errors: 404, 502 (handled gracefully)

POST   /appointments/:id/cancel     Cancel appointment
                                  Auth: patient(owner) | doctor | admin | Errors: 404, 409

POST   /admin/doctors                Create doctor profile
                                  Auth: admin | Errors: 400, 409 duplicate

PUT    /admin/doctors/:id            Update doctor profile (hours, slot duration, specialisation)
                                  Auth: admin | Errors: 404, 400

POST   /admin/doctors/:id/leave      Mark leave day(s) — cascades to conflict notifications
                                  Auth: admin | Errors: 404, 400

GET    /auth/google/callback         OAuth 2.0 callback for Calendar access
                                  Auth: authenticated user | Errors: 400 invalid state/code
```

*(Endpoints are illustrative and may be refined during implementation — no unnecessary endpoints beyond what features F1–F9 require.)*

---

## 9. Project Folder Structure

```text
project/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/          # booking, doctor, symptom/llm, notification, calendar, reminder
│   │   ├── middleware/        # auth, validation, error-handler
│   │   ├── jobs/               # reminder scheduler, email retry worker
│   │   ├── db/                 # prisma schema / migrations, client
│   │   ├── utils/
│   │   └── app.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/            # auth/session
│   │   ├── api/                 # apiClient
│   │   └── App.jsx
│   └── package.json
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   ├── PHASES.md
│   ├── DESIGN.md
│   ├── MEMORY.md
│   └── system-design-writeup.md   # ≤800 words, per assignment deliverable 4
└── README.md
```

---

## 10. Security Architecture

- Passwords hashed with bcrypt; never logged or returned in API responses.
- JWT signed with a server-side secret (from `.env`, never committed).
- Role-based authorization enforced on every protected route (not just hidden in UI).
- OAuth tokens (Google) stored encrypted at rest / at minimum kept server-side only, never sent to frontend.
- Input validation/sanitization on all write endpoints to prevent injection.
- `.env` and secrets excluded from the repository per submission guidelines.

---

## 11. Error Handling Architecture

- **Validation errors:** 400 with field-level messages, caught by request-schema middleware.
- **API errors (internal):** centralized error handler → consistent JSON error shape → appropriate status code.
- **Network errors (frontend):** retry-safe GETs may auto-retry once; user-facing toast on failure.
- **Authentication errors:** 401 (not logged in) vs 403 (wrong role/owner) distinguished.
- **Database errors:** caught at service layer, mapped to 409 (conflict, e.g., double-booking) or 500 (unexpected), never leak raw DB errors to client.
- **LLM/email/calendar integration errors:** never surfaced as a hard failure of the primary user action (booking, note submission); logged, stored with a `FAILED` status, and retried where applicable (email) or surfaced as "summary pending" (LLM).

---

## 12. Scalability and Maintainability

- Service-layer separation allows swapping the LLM provider, email provider, or DB access layer without touching controllers/routes.
- Background jobs isolated from the request/response cycle so slow integrations (LLM, email, Calendar) never block API responsiveness.
- Slot-generation logic derived from `working_hours` + `slot_duration` (not hardcoded), so schedule changes don't require code changes.
- Documented API and DB schema (per README deliverable) keep the system understandable as it grows.

---

## 13. Concurrency / Double-Booking Design (supports PRD FR-008, FR-009 and Deliverable #4 write-up)

**Slot hold mechanism (proposed — see PRD Open Question OQ-6):**
1. When a patient selects a slot, the backend attempts to insert an `appointments` row with status `HELD` inside a DB transaction, relying on the unique constraint `(doctor_id, slot_start)` (excluding cancelled rows) to guarantee only one HELD/CONFIRMED row can exist per slot.
2. If the insert violates the unique constraint, the API immediately returns 409 "slot no longer available" — this is what makes simultaneous booking attempts safe (FR-009).
3. On successful insert, the row transitions to `CONFIRMED` once the booking transaction commits (in practice this can be a single atomic transaction rather than two steps, kept simple per "avoid over-engineering").
4. A short-lived hold (e.g., a few minutes) is only necessary if a multi-step booking flow (slot select → symptom form → confirm) is required by OQ-3; if booking is a single-step action, no timed hold is needed and the transaction above is sufficient. **This should be finalized once OQ-3 is confirmed.**

**Leave conflict cascade:** marking a leave day runs inside a transaction that (a) inserts the leave record, (b) queries all active appointments for that doctor/date, (c) marks them `CANCELLED`, (d) enqueues one notification job + one calendar-delete job per affected appointment — so partial failures in step (d) never leave the appointment data inconsistent.
