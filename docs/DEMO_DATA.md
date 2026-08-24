# Demo Data System

The Healthcare Appointment Manager includes a safe, repeatable demo data seeding system. This system is designed strictly for demonstration purposes, allowing reviewers to experience the application from the perspective of three distinct roles (Patient, Doctor, Admin) without needing to manually generate realistic historical data, symptoms, or AI summaries.

## Demo Accounts

The following credentials are safe to use on any instance seeded with the demo script. These are **fictional/demo accounts only**.

### 1. Demo Patient
- **Email:** `patient.demo@healthcare-demo.com`
- **Password:** `Patient@12345`
- **Purpose:** Demonstrates the patient dashboard, booking flow, adding symptoms, and viewing past completed AI summaries.

### 2. Demo Doctor
- **Email:** `doctor.demo@healthcare-demo.com`
- **Password:** `Doctor@12345`
- **Purpose:** Demonstrates the active doctor dashboard, viewing pending symptom reports, and completing visits/prescriptions.

### 3. Demo Admin
- **Email:** `admin.demo@healthcare-demo.com`
- **Password:** `Admin@12345`
- **Purpose:** Demonstrates the admin dashboard, creating doctor profiles, and assigning working hours.

## Seed Command

To safely populate the database with these fictional records, run the following command from the `backend/` directory:

```bash
npm run seed:demo
```

### Idempotency and Safety
The seed script is idempotent. Running it multiple times will not duplicate the demo users. Furthermore, it operates **exclusively** on the designated demo accounts and their relationships.

**Important:** Your personal non-demo users, their profiles, and their appointments are **100% safe** and will never be overwritten or deleted by the standard seed command. You can safely register your own account and interact with the demo doctor simultaneously.

## Reset Command

If the demo environment needs to be purged, use the reset flag:

```bash
npm run seed:demo -- --reset
```

### Safety Warning
The reset command will delete the demo users and securely cascade-delete all of their associated demo appointments, symptoms, and visit notes. It explicitly targets **only** the `DEMO_EMAILS` defined in the script, preventing accidental destruction of your genuine production database records.
