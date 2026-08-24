# Deployment Guide
### Healthcare Appointment Manager

## Prerequisites
- Node.js (v18+)
- npm
- Git
- PostgreSQL / Supabase

---

## Local Backend Setup

1. Open your terminal and navigate to the backend directory:
```bash
cd backend
npm install
```

2. Create a local environment file by copying the example:
```bash
cp .env.example .env
```

3. Update the `backend/.env` file with your specific variables (DO NOT commit this file). You only need to populate the variables named in the file:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_URL`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`

---

## Local Database Setup

Use the following Prisma commands to initialize your local database. 

```bash
npx prisma generate
npx prisma migrate deploy
```

**WARNING:** DO NOT use `npx prisma migrate reset` as it will permanently destroy all data. Use only `deploy` to safely apply migrations to your active database.

---

## Local Frontend Setup

1. Open a separate terminal window and navigate to the frontend directory:
```bash
cd frontend
npm install
```

2. Configure the frontend environment variable. Create a `frontend/.env` file with your backend URL:
- `VITE_API_URL`

3. Start the development server:
```bash
npm run dev
```

---

## Local URLs

When running locally, your default configuration uses:
- **Frontend URL:** http://localhost:5173
- **Backend API URL:** http://localhost:3000

---

## Production Deployment Architecture

The application is deployed across the following services:
- **Vercel** → Hosts the React/Vite frontend SPA.
- **Render** → Hosts the Node.js/Express backend API and persistent background cron workers.
- **Supabase** → Hosts the production PostgreSQL database.
- **Google Cloud** → Provides Google OAuth / Google Calendar APIs.
- **SMTP** → Manages email delivery (when configured).

---

## Production Environment Variables

In production, you must set these environment variables securely within your hosting provider dashboards. Never expose these values publicly.

### Vercel (Frontend)
- `VITE_API_URL`

### Render (Backend)
- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FRONTEND_URL`
- `PORT`
- SMTP variables (if configured)

---

## Google Calendar

The application uses Google OAuth to interact with patients' and doctors' personal Google Calendars.

- **OAuth Client Configuration:** You must create an OAuth 2.0 Client ID in the Google Cloud Console.
- **Scope Used:** `https://www.googleapis.com/auth/calendar.events` (Sensitive scope).
- **Callback URL Format:** The `GOOGLE_REDIRECT_URI` must perfectly match the production backend URL callback (e.g., `https://your-backend.onrender.com/auth/google/callback`).
- **Testing vs Production:** Because this app requests a sensitive scope, the OAuth consent screen will display an "Unverified App" warning during academic/testing use. Users must click "Advanced" -> "Go to app (unsafe)" to proceed. To remove this warning for arbitrary public accounts, the Google Cloud Project must pass official Google verification.

---

## Email

The system uses Nodemailer for all outbound notifications.
- **Implementation:** Email actions write records to an `EmailLog` database table. A continuous `email-retry-worker` background job polls this table and manages actual outbound SMTP delivery.
- **Configuration:** You must provide valid SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`) in the backend environment variables.
- **Note:** If SMTP is not configured, the worker will log "Missing credentials", but the primary application booking and system functions will still operate smoothly without blocking. Real email delivery explicitly requires active SMTP configuration.
