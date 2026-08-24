# Phase 2 Implementation Plan — Admin: Doctor Profile & Leave Management

## Goal
Implement Phase 2 of the Healthcare Appointment Manager, satisfying FR-003, FR-004, and FR-005. Admins will manage doctor profiles and leave days using a standardized JSON schedule structure, mapping to pre-registered DOCTOR accounts.

---

## 1. Exact Database Changes
Modify `backend/prisma/schema.prisma` to include two new models linked to the existing `User` model:

### [MODIFY] `schema.prisma`
```prisma
model DoctorProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  specialisation      String
  workingHoursJson    Json     // Enforces the fixed 7-day schedule structure
  slotDurationMinutes Int
  createdAt           DateTime @default(now())
  
  leaves              DoctorLeave[]
}

model DoctorLeave {
  id              String         @id @default(uuid())
  doctorProfileId String
  doctorProfile   DoctorProfile  @relation(fields: [doctorProfileId], references: [id], onDelete: Cascade)
  leaveDate       DateTime       @db.Date
  reason          String?
  createdAt       DateTime       @default(now())

  @@unique([doctorProfileId, leaveDate]) // Prevents duplicate leaves on the same day
}
```
*(Also add a `doctorProfile DoctorProfile?` field to the `User` model to complete the relationship).*

---

## 2. Exact API Endpoints
All endpoints will reside in `backend/src/routes/admin.js`.

- `GET /admin/doctors`
  - Fetches all `User` records where `role = DOCTOR`, including their attached `DoctorProfile` (if it exists) and their `leaves`.
- `POST /admin/doctors/:userId/profile`
  - Creates a `DoctorProfile` attached to an existing DOCTOR user.
- `PUT /admin/doctors/:userId/profile`
  - Updates an existing `DoctorProfile`.
- `POST /admin/doctors/:userId/leave`
  - Inserts a new record into `DoctorLeave`.

---

## 3. Authentication & ADMIN Authorization
Every route in `/admin/*` will be wrapped by:
1. `authenticate` middleware (validates JWT).
2. `authorizeRole('ADMIN')` middleware (asserts `req.user.role === 'ADMIN'`).

---

## 4. Doctor Selection & Listing Behavior
On the frontend (`AdminDashboard.jsx` / `DoctorManagement.jsx`), the system will display a list/table of all users who have the `DOCTOR` role. 
- If a doctor does not have a profile yet, they will show as "Profile Pending", and the Admin will click "Create Profile".
- If they do have a profile, the Admin can click "Edit Profile" or "Manage Leaves".

---

## 5. Working-Hours Validation
All profile create/update endpoints will use **Zod** to strictly validate `workingHoursJson`.
The schema will exactly mirror the approved 7-day structure:
```javascript
const daySchema = z.object({
  enabled: z.boolean(),
  start: z.string().nullable(),
  end: z.string().nullable()
});

const workingHoursSchema = z.object({
  monday: daySchema, tuesday: daySchema, wednesday: daySchema,
  thursday: daySchema, friday: daySchema, saturday: daySchema, sunday: daySchema
}).refine(data => {
  // Add custom refinement to ensure that if enabled=true, start and end must exist and start < end.
});
```

---

## 6. Leave Validation
Leave creation will use Zod validation to ensure:
1. `leaveDate` is a valid ISO date string.
2. The date is >= today (cannot mark leave in the past).
3. The database's `@@unique` constraint will safely reject any attempt to mark the same leave date twice for the same doctor.

---

## 7. Slot-Generation Behavior
Create a pure utility function `generateSlots(workingHoursJson, slotDurationMinutes, targetDate)`.
- It will find the day of the week for `targetDate`.
- If that day is `enabled: false`, it returns `[]`.
- If `enabled: true`, it parses `start` and `end` times, and slices them into exact `slotDurationMinutes` increments. 
- Example: `09:00` to `17:00` at `30` mins returns `["09:00", "09:30", ... "16:30"]`.
- *Note: This will be fully unit-tested to guarantee safe behavior for Phase 3.*

---

## 8. Frontend Pages/Components
- `frontend/src/pages/AdminDashboard.jsx`: Sidebar navigation or tabbed view.
- `frontend/src/components/admin/DoctorList.jsx`: Table displaying all doctors.
- `frontend/src/components/admin/DoctorProfileModal.jsx`: Form containing fields for Specialisation, Slot Duration, and the 7-day Schedule.
- `frontend/src/components/admin/LeaveManagementModal.jsx`: Calendar/Date input to mark leave days for a specific doctor.

---

## 9. Testing Strategy
- **Unit Tests:** Direct testing of the `generateSlots` utility with various inputs (standard days, disabled days, crossing mid-day, non-divisible durations).
- **Integration Tests:** Write an `admin-test.js` script to verify:
  - Non-admins get `403 Forbidden` on all routes.
  - Profile creation validation (rejects malformed `workingHoursJson`).
  - Correct saving and returning of created Profiles and Leaves.
- **Manual UI Tests:** Verify the frontend forms cleanly pass the nested JSON payload and correctly update the UI upon success.

---

## 10. Edge Cases
- **Missing Doctor:** Admin attempts to attach a profile to a non-existent User ID, or a User ID who isn't a DOCTOR. (Will return `404` or `400`).
- **Malformed Time Strings:** If `start` is "25:00", Zod regex will catch and reject it.
- **Negative Duration:** `slotDurationMinutes` must be >= 5.

---

## 11. Completion Criteria
Phase 2 is complete when:
- Prisma migration is successfully run for `DoctorProfile` and `DoctorLeave`.
- The Admin can successfully fetch doctors, add profiles, and mark leave days via the React UI.
- The `generateSlots` utility passes all unit tests.
- Backend restricts all access strictly to `ADMIN` roles.
