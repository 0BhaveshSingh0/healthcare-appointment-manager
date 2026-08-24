# System Design Write-up

## 1. Double-Booking Prevention & Concurrency
A core requirement of the Healthcare Appointment Manager is preventing double-booking when multiple patients attempt to secure the same slot simultaneously. This is solved at the database layer using **PostgreSQL unique constraints and transactions**, entirely bypassing application-level race conditions.

The `Appointment` table includes a partial unique index on `(doctorId, slotStart)` that enforces uniqueness only for active appointments (ignoring those with a `CANCELLED` status). 

When a user initiates a booking, the backend wraps the insertion inside a Prisma database transaction. If two requests attempt to book the exact same slot concurrently, the database's internal locking mechanisms guarantee that only the first transaction commits successfully. The second transaction immediately fails with a unique constraint violation, which the backend catches and translates into a `409 Conflict` response to the frontend. This approach ensures robust, atomic double-booking prevention without requiring complex external locking systems like Redis.

## 2. Doctor Leave Conflict Cascade
When an administrator marks a doctor on leave for a specific date, the system must handle existing appointments that overlap with that leave. This is managed via an atomic **conflict cascade**.

The `leave-conflict-service` executes a strict Prisma transaction that:
1. Creates the `DoctorLeave` record.
2. Identifies all active appointments for the affected doctor on that exact date.
3. Updates the status of all affected appointments to `CANCELLED`.

Crucially, **no external API calls** (Google Calendar or SMTP) are made *during* this database transaction. This prevents long network delays from holding database locks or causing transaction timeouts. Instead, once the transaction successfully commits, the backend asynchronously enqueues background jobs for each cancelled appointment. These background tasks handle the external side-effects (deleting Google Calendar events and notifying patients via email), guaranteeing database consistency regardless of external network failures.

## 3. Slot-Hold Mechanism
The system utilizes a transactional booking flow that eliminates the need for prolonged slot-holds (e.g., locking a slot for 10 minutes while a user fills out a form). 

Because the architecture requires the user to submit symptoms *after* the appointment is secured, the slot selection itself is an immediate, atomic action. The booking request simply attempts the database insert; if successful, the slot is immediately confirmed. If the subsequent symptom submission step fails (or the user abandons it), the appointment remains valid but without symptoms attached, prompting the doctor to collect them manually during the visit. This simplifies the user experience and maximizes overall slot availability by avoiding stale, abandoned locks.

## 4. Notification & Third-Party Failure Handling
The system heavily relies on external services: Google Gemini (AI summaries), Google Calendar (OAuth events), and Nodemailer (Email). A critical architectural constraint dictates that **failures in these external services must never break or rollback primary user actions** like booking an appointment or submitting visit notes.

To achieve this, the architecture utilizes asynchronous side-effects and background workers:

- **AI Summaries (LLM)**: When a patient submits symptoms or a doctor submits notes, the backend attempts to generate an AI summary. If the Gemini API fails or times out, the backend gracefully catches the error, sets an `llmStatus` of `FAILED` on the record, and completes the HTTP response with a `200 OK`. The user action succeeds, and the UI displays a fallback state indicating the AI summary is pending/unavailable.
- **Email Notifications**: Emails are never sent synchronously during a request. Instead, booking and cancellation events atomically write a pending record to an `EmailLog` table. A background cron worker (`email-retry-worker`) running continuously in the Node.js process polls for pending emails, attempts delivery via Nodemailer, and marks them `SENT`. If SMTP delivery fails, the worker utilizes a retry-and-backoff mechanism.
- **Medication Reminders**: A similar cron-based `reminder-scheduler` polls the `MedicationReminder` table every 5 minutes. It uses atomic database transactions to mark reminders as `SENT` strictly alongside the creation of their corresponding `EmailLog` record, ensuring patients receive accurate, deduplicated reminders based on their prescribed frequency and duration.
