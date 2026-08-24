## 🎥 Video Demonstration

[Watch the Complete Project Demo](https://drive.google.com/file/d/1FvoTj4O-zTMbWs68TinanpkljULQ3iWW/view?usp=sharing)

The video demonstrates the complete working flow of the Healthcare Appointment Manager, including:
- Demo Patient workflow
- Demo Doctor workflow
- Admin dashboard and doctor management
- Real patient account workflow
- Google Calendar connection
- Doctor search and appointment booking
- Pre-visit symptom submission
- Google Calendar synchronization
- Appointment confirmation email
- Doctor-side appointment management
- Appointment cancellation
- Cancellation email notification

# Healthcare Appointment Manager

A comprehensive full-stack application for managing healthcare appointments, pre-visit symptoms, post-visit notes, prescriptions, doctor leaves, and automated notifications with Google Calendar integrations.

## Live Application

[**Healthcare Appointment Manager — Live Demo**](https://healthcare-appointment-manager-rho-bay.vercel.app)

## Features

- **Authentication & Roles**: Secure JWT-based authentication for Patients, Doctors, and Admins.
- **Appointment Booking Engine**: Atomic transaction-based booking that prevents double-booking and enforces concurrency safety.
- **Symptom Collection & AI Integration**: Patients submit pre-visit symptoms which are summarized by Google Gemini AI.
- **Post-Visit Notes & Summaries**: Doctors submit clinical notes and prescriptions, converted into patient-friendly summaries by AI.
- **Medication Reminders**: Automated background jobs parse prescription frequency/duration and schedule recurring email reminders.
- **Doctor Leave Cascade**: Admin leaves trigger an atomic cascade to safely cancel affected appointments and send notification emails.
- **Google Calendar Sync**: Full Google OAuth 2.0 integration to sync appointments to personal Google Calendars.
- **Resilient Notifications**: Async email workers with retry and backoff mechanisms to ensure LLM or Email failures never block primary booking actions.

## Architecture

The system uses a 3-tier architecture with a REST API backend. To maintain high responsiveness, all side-effects (emails, AI calls, Calendar syncing) are processed asynchronously via continuous background `node-cron` workers.

[Architecture Documentation](docs/ARCHITECTURE.md)

## Project Overview

[Project Overview](docs/PROJECT_OVERVIEW.md)

## Quick Start

### 1. Database Setup
Create a local PostgreSQL database `healthcare_appointments`.

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your .env variables, then run:
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000
npm run dev
```

## Project Structure

```text
healthcare-appointment-manager/
├── backend/
├── frontend/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── images/
│       └── database-schema.png
├── docker-compose.yml
└── README.md
```

## Deployment

[Deployment Guide](docs/DEPLOYMENT.md)

## Technology Stack

- **React**
- **Vite**
- **Node.js**
- **Express**
- **Prisma**
- **PostgreSQL**
- **Supabase**
- **Google OAuth / Calendar**
- **Gemini AI**
- **Vercel**
- **Render**

## Security

- All secrets and credentials are safely stored in environment variables.
- `.env` files are intentionally excluded from the repository.
- Passwords are cryptographically hashed using bcrypt.
- JWT verification is strictly enforced on all protected backend API routes.
- Database operations use parameterized Prisma queries to prevent SQL injection vulnerabilities.
