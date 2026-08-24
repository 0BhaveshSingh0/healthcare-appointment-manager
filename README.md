# Healthcare Appointment & Follow-up Manager

A comprehensive full-stack application for managing healthcare appointments, pre-visit symptoms, post-visit notes, prescriptions, doctor leaves, and automated notifications/calendar integrations.

## Live Application

[**Healthcare Appointment Manager — Live Demo**](https://healthcare-appointment-manager-rho-bay.vercel.app)

[**GitHub Repository**](https://github.com/0BhaveshSingh0/healthcare-appointment-manager)

[**Backend API — Render**](https://healthcare-appointment-manager-n4wj.onrender.com)

## Main Features

- **Authentication & Roles**: Secure JWT-based authentication for Patients, Doctors, and Admins.
- **Appointment Booking Engine**: Atomic transaction-based booking that prevents double-booking and enforces concurrency safety via PostgreSQL unique constraints.
- **Symptom Collection & AI Integration**: Patients submit pre-visit symptoms which are summarized by Google Gemini AI to highlight urgency and chief complaints.
- **Post-Visit Notes & Summaries**: Doctors submit clinical notes and prescriptions, converted into patient-friendly summaries by AI.
- **Medication Reminders**: Automated background jobs parse prescription frequency/duration and schedule recurring email reminders.
- **Doctor Leave Cascade**: Admin leaves trigger an atomic cascade to safely cancel affected appointments, send notification emails, and remove Google Calendar events.
- **Google Calendar Sync**: Full OAuth 2.0 integration to sync appointments to both the Doctor's and Patient's personal Google Calendars.
- **Resilient Notifications**: Async email workers with retry and backoff mechanisms to ensure LLM or Email failures never block primary booking actions.

## Technology Stack

- **Frontend**: React, Vite, React Router
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Background Jobs**: node-cron (running in the persistent backend process)
- **Integrations**: Google Gemini API, Google Calendar API (OAuth 2.0), Nodemailer

## System Architecture Overview

The system uses a 3-tier architecture with a REST API backend. To maintain high responsiveness, all side-effects (emails, AI calls, Calendar syncing) are processed asynchronously. The backend uses `node-cron` for running the medication reminder scheduler and the email retry queue directly within the Express server instance.

![Healthcare Appointment Manager - Database Schema](docs/images/database-schema.png)

For more details, see the `docs/system-design-writeup.md`.

## Project Structure

```
.
├── backend/
│   ├── prisma/             # Database schema and migrations
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── db/             # Prisma client instance
│   │   ├── jobs/           # Cron workers (email retries, reminders)
│   │   ├── middleware/     # Auth, error handling
│   │   ├── routes/         # API routing
│   │   ├── services/       # Core business logic
│   │   └── app.js          # Express entrypoint
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API client
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React context (Auth)
│   │   ├── pages/          # Dashboard views
│   │   └── App.jsx
│   └── .env.example
└── docs/                   # Architectural documents and design write-ups
```

## Local Development Setup

### 1. Database Setup

Ensure you have PostgreSQL installed and running locally.
Create a local database:
```sql
CREATE DATABASE healthcare_appointments;
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update your `backend/.env` with your actual database URL and API keys (do NOT commit this file).

```bash
# Apply database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Update your `frontend/.env` to point to the backend (default is `http://localhost:3000`).

```bash
# Start frontend server
npm run dev
```

## Environment Variables

**Backend (`backend/.env`)**
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: Secret for signing tokens.
- `PORT`: Server port (default 3000).
- `FRONTEND_URL`: CORS origin for the frontend.
- `GEMINI_API_KEY`: API key for Google Gemini.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials.
- `GOOGLE_REDIRECT_URI`: OAuth callback URL.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL`: Nodemailer credentials.

**Frontend (`frontend/.env`)**
- `VITE_API_URL`: Backend API URL (default `http://localhost:3000`).

## Deployment Architecture

The application is fully deployed using the following modern stack:

- **Frontend (Vercel)**: Vercel hosts the React/Vite Single Page Application (SPA).
- **Backend (Render)**: Render hosts the Node.js/Express backend as a persistent Web Service. This is required because the backend runs continuous background `node-cron` workers for Medication Reminders and Email Retries, which would not work on serverless functions.
- **Database (Supabase)**: Supabase provides the production PostgreSQL database.

All configurations are handled securely via environment variables (e.g., `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `PORT`, and `VITE_API_URL`).

## Google Calendar & OAuth

**Important: Timezone Requirement**
For accurate slot calculation, the user's Google Calendar timezone must be set to `Asia/Kolkata` (IST, GMT+05:30). The database stores absolute UTC timestamps, but reminder and booking logic operates in IST.

**Production OAuth Note for Examiners:**
Because the app requests sensitive Calendar scopes, Google flags it as an "Unverified App" during the OAuth flow. This is expected for academic projects.
When connecting your Google Calendar:
1. Click **"Advanced"** on the warning screen.
2. Click **"Go to app (unsafe)"** to proceed.
3. The app will receive permissions, and you can safely close the popup.

## SMTP Setup (Pending)

Real SMTP credentials have intentionally been omitted from the repository for security. The notification architecture gracefully queues emails into the database (`EmailLog`). Until `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are provided in the environment variables, the backend will log "Missing credentials" but the primary application flow (booking, reminders, leaves) will continue unaffected.

## Security Notes

- No secrets or `.env` files are committed.
- Passwords are hashed via bcrypt.
- JWT is strictly enforced on all protected routes.
- Backend CORS should be strictly configured to the `FRONTEND_URL` in production.
- Database operations use parameterized queries/Prisma to prevent SQL injection.
