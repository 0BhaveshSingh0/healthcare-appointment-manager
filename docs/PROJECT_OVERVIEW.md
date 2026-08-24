# Healthcare Appointment & Follow-up Manager — Project Overview

## 1. Problem Statement
Basic healthcare booking applications often fall short of meeting clinical needs. Basic booking alone is insufficient because it treats all appointments equally without understanding the patient's condition. Patients need to provide their symptoms prior to visits so doctors are prepared. Doctors need an AI-generated pre-visit summary to quickly assess urgency and chief complaints. After the visit, doctors need a streamlined way to provide post-visit notes and prescriptions, while patients need those clinical notes translated into a patient-friendly post-visit summary. 

Additionally, both patients and doctors require timely notifications (email and Google Calendar) to prevent missed appointments. Administrative staff must manage doctor profiles, working hours, variable slot durations, and doctor leaves efficiently. Fundamentally, the system must definitively prevent double-booking and safely handle simultaneous booking attempts under high concurrency.

## 2. Project Objectives
- Develop a robust booking engine that prevents double-booking using database-level constraints.
- Integrate AI to summarize pre-visit symptoms and post-visit clinical notes.
- Automate Google Calendar synchronization for both doctors and patients.
- Automate medication reminders derived from doctor prescriptions.
- Handle administrative doctor leaves with an automatic conflict-cascade (cancelling overlapping appointments and notifying users).
- Ensure high reliability: third-party API failures (AI, Email, Calendar) must not break core appointment workflows.

## 3. Implemented Solution
This repository implements a full-stack Healthcare Appointment Manager:
- **Roles**: Distinct Patient, Doctor, and Admin roles.
- **Authentication**: Secure JWT-based authentication and route authorization.
- **Booking Engine**: Doctor search and atomic appointment booking with slot availability derived dynamically from working hours and existing appointments.
- **Concurrency Protection**: Double-booking prevention using PostgreSQL partial unique constraints and transactions.
- **Symptom Collection**: Post-booking symptom form.
- **AI Integration**: Google Gemini LLM pre-visit summary (urgency, chief complaint, doctor questions) and patient-friendly post-visit summaries.
- **Post-Visit Notes**: Doctor portal for submitting clinical notes and structured prescriptions.
- **Leave Management**: Admin tools for doctor leave, which cascades to automatically cancel affected appointments and queue notifications.
- **Notifications**: Resilient email notifications via Nodemailer, using an `EmailLog` table and an asynchronous retry worker.
- **Medication Reminders**: Automated background `node-cron` job that parses prescriptions and schedules emails.
- **Google Calendar**: Full OAuth 2.0 integration and event synchronization.
- **Deployment**: Deployed on Vercel (frontend), Render (Node.js backend + workers), and Supabase (PostgreSQL).

## 4. Problem Statement → Implemented Feature Mapping

| Problem Statement Requirement | Implemented Solution |
|---|---|
| Basic booking is insufficient | Implemented dynamic slot generation, doctor specialisation search, and distinct booking phases. |
| Provide symptoms before visits | Patient dashboard forces symptom submission for confirmed appointments. |
| AI-generated pre-visit summary | Gemini AI parses symptoms into Urgency, Chief Complaint, and Questions for the Doctor. |
| Post-visit notes and prescriptions | Doctor dashboard includes a Visit Note form with a structured prescription JSON builder. |
| Patient-friendly post-visit summary | Gemini AI translates clinical jargon into a readable summary available on the Patient dashboard. |
| Email and Google Calendar notifications | Google OAuth 2.0 calendar integration + Nodemailer async email workers. |
| Admin manages doctors and leave | Admin dashboard for CRUD doctor profiles and leave management. |
| Prevent double-booking / simultaneous attempts | PostgreSQL unique constraints `(doctor_id, slot_start)` and Prisma atomic transactions block race conditions. |

## 5. Key Technical Decisions
- **PostgreSQL/Prisma**: Chosen for strict relational integrity, transactions, and unique constraints necessary for the booking engine.
- **Double-Booking Prevention**: Achieved via a partial unique index on `(doctor_id, slot_start)` where status is not CANCELLED.
- **Concurrent Booking Attempts**: Handled natively by the database; the first transaction commits, and subsequent concurrent transactions throw a constraint violation which the API translates to a 409 Conflict.
- **Doctor Leave Conflicts**: Handled via a strict database transaction that inserts the leave and marks overlapping appointments as CANCELLED atomically.
- **Asynchronous Notifications**: Handled by background `node-cron` workers polling an `EmailLog` table, fully decoupling network requests from HTTP responses.
- **Failure Isolation**: Notification or LLM API timeouts are caught gracefully. An LLM failure saves a `FAILED` status but allows the booking/note to succeed.
- **Google Calendar OAuth 2.0**: Implemented via `@google/googleapis`. Tokens are stored encrypted/securely on the backend, and the application syncs events using `Asia/Kolkata` boundaries.
- **Role-based Access**: Implemented via middleware that checks the role embedded within the signed JWT.

## 6. AI / LLM Usage
The system leverages the Google Gemini API (`gemini-3.6-flash`) for two primary tasks. If the API fails, the application degrades gracefully without blocking the user.

**Pre-Visit Symptom Prompts:**
```text
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}
```

**Post-Visit Summary Prompts:**
```text
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>
```

## 7. Database
The system uses PostgreSQL. Major entities include:
- `User`: Base identity and credentials.
- `DoctorProfile`: Working hours, specialisation, slot duration.
- `Appointment`: Core booking ledger.
- `SymptomForm`: Pre-visit patient symptoms and AI outputs.
- `VisitNote`: Post-visit clinical notes, prescriptions, and AI summaries.
- `DoctorLeave`: Admin-defined unvailable dates.
- `MedicationReminder`: Parsed prescription schedules.
- `EmailLog`: Async email delivery queue.
- `CalendarEvent` and `OAuthToken`: Google Calendar integration states.

![Database Schema](images/database-schema.png)

## 8. API and Application Structure
- **Frontend**: React/Vite Single Page Application (SPA) utilizing React Router for role-based portal separation.
- **Backend**: Node.js/Express REST API.
- **Architecture**: Separated into Controllers (request parsing), Services (business logic), and Prisma DB layer.
- **Background Jobs**: `node-cron` workers reside inside the backend instance to manage email retries and medication reminder scheduling.
- **External Integrations**: Nodemailer (SMTP), Googleapis (Calendar), Google GenAI SDK (LLM).

## 9. Deployment
- **Frontend**: Vercel (Fast CDN delivery for the SPA).
- **Backend**: Render (Persistent Web Service to keep cron workers alive).
- **Database**: Supabase PostgreSQL.

*(Secrets, API keys, and credentials are securely injected via environment variables and are never committed to the repository).*

## 10. Assignment Compliance
This repository meets the submission expectations:
- **Public GitHub Repository**: Provided via the `main` branch.
- **Hosted Application**: Accessible via live Vercel URL.
- **Documentation**: Includes a comprehensive `README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, and this `PROJECT_OVERVIEW.md`.
- **Database Schema**: ER diagram included.
- **Clean Repository**: No `.env` files, secrets, `node_modules`, or build artifacts are committed.

## 11. Final Summary
The Healthcare Appointment Manager successfully solves the problem statement by providing a highly concurrent, reliable booking engine augmented by AI and external integrations. By enforcing double-booking protection at the database layer and isolating third-party API failures (LLM/Email/Calendar) into asynchronous background workers, the system guarantees that critical healthcare scheduling operations remain fast and unbreakable.
