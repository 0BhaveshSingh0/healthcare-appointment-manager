# PLAN.md — Implementation Plan & Rules
### Healthcare Appointment & Follow-up Manager

> Related docs: [PRD](./PRD.md) · [Architecture](./ARCHITECTURE.md) · [Phases](./PHASES.md) · [Design](./DESIGN.md) · [Memory](./MEMORY.md)

---

## 1. Development Strategy

Build backend-first, feature-by-feature, in the dependency order defined in [PHASES.md](./PHASES.md): foundation (auth, DB) → admin/doctor management → booking core (with concurrency safety) → symptom/LLM integration → notes/LLM integration → notifications/calendar → reminders → leave-conflict cascade → polish/docs. Each phase should be runnable and testable before moving to the next. Frontend pages are built alongside the backend feature they consume, not in a separate late "frontend phase," so the app is demoable incrementally.

---

## 2. Technologies to Use

| Technology | Purpose | Reason |
|---|---|---|
| Node.js + Express | Backend API | Simple, well-understood, matches assignment's Nodemailer reference |
| React | Frontend SPA | Standard for role-based multi-portal dashboards |
| PostgreSQL | Database | Strong relational structure (see ARCHITECTURE §7) |
| Prisma | ORM/migrations | Transaction + unique-constraint support needed for double-booking prevention |
| JWT + bcrypt | Auth | Stateless, standard, satisfies role-based auth requirement |
| node-cron or BullMQ | Background jobs | Needed for reminders + email retries (assignment requirement) |
| SendGrid/Nodemailer | Email | Explicitly permitted by assignment |
| googleapis (Google Calendar API) | Calendar sync | Explicitly required by assignment |
| LLM provider SDK (TBD) | AI summaries | Explicitly required by assignment |

---

## 3. Libraries to Use

| Name | Purpose | Why needed | Where |
|---|---|---|---|
| `express` | HTTP server/routing | Core API framework | backend |
| `prisma` / `@prisma/client` | DB access + migrations | Type-safe, transaction-friendly | backend |
| `jsonwebtoken` | Auth tokens | Stateless auth | backend |
| `bcrypt` | Password hashing | Security requirement | backend |
| `zod` (or `joi`) | Request validation | Consistent input validation (NFR) | backend |
| `nodemailer` or `@sendgrid/mail` | Email sending | Assignment requirement | backend |
| `googleapis` | Calendar API + OAuth | Assignment requirement | backend |
| `node-cron` | Scheduled reminder checks | Assignment requirement (background job) | backend |
| `dotenv` | Env var loading | Standard, keeps secrets out of code | backend |
| `react-router-dom` | Routing | Standard SPA routing | frontend |
| `axios` | HTTP client | Simple API calls from frontend | frontend |

---

## 4. Libraries/Technologies to Avoid

- GraphQL — REST is sufficient for this scope; adds needless complexity.
- Redis / dedicated message queues (beyond a simple cron/job table) — not justified at this scale.
- Microservices / container orchestration (Kubernetes) — massive over-engineering for a single-clinic assignment.
- Heavy state-management libraries (Redux, MobX) — React Context is enough for this app's state needs.
- UI component libraries beyond what's needed for the defined design system (avoid pulling in a large design-system package if a lightweight one — e.g., Tailwind utility classes — satisfies [DESIGN.md](./DESIGN.md)).
- Any extra npm packages "just in case" — submission guidelines explicitly say keep dependencies minimal.

---

## 5. Coding Rules

- **Naming conventions:** camelCase for JS variables/functions, PascalCase for React components and classes, snake_case for DB columns (Prisma maps automatically).
- **File naming:** kebab-case for files (`booking-service.js`), PascalCase for React component files (`DoctorSearch.jsx`).
- **Component naming:** name by responsibility, not by page position (`SymptomForm`, not `Form1`).
- **Function naming:** verb-first (`createAppointment`, `sendReminderEmail`).
- **Code organization:** one responsibility per service file; controllers stay thin (parse → call service → respond).
- **Comments:** explain *why*, not *what*, especially around the concurrency logic and LLM prompt handling.
- **Reusability:** shared UI elements (buttons, cards, alerts) live in `components/`, not duplicated per page.
- **Error handling:** every async operation that can fail (DB, LLM, email, calendar) wrapped in try/catch with a mapped, meaningful error.
- **Validation:** every write endpoint has a schema validated before touching the database.

---

## 6. AI Coding Rules

**AI (or any developer) must:**
- Read `PRD.md`, `ARCHITECTURE.md`, `PLAN.md`, `PHASES.md`, `DESIGN.md`, and `MEMORY.md` before modifying code.
- Understand existing architecture before adding anything new.
- Modify only the files relevant to the current task/phase.
- Avoid unnecessary rewrites of working code.
- Avoid introducing new dependencies without a stated justification (update `PLAN.md` §3 if one is added).
- Preserve existing functionality unless a documented decision says otherwise.
- Follow the folder structure in `ARCHITECTURE.md` §9.
- Follow the design system in `DESIGN.md`.
- Follow the requirements in `PRD.md` and the architecture in `ARCHITECTURE.md`.
- Update `MEMORY.md` after any meaningful unit of work (see Memory's Critical Memory Rule).

**AI must NOT:**
- Randomly change the architecture.
- Add features not listed in `PRD.md` §4/§5 (no scope creep — this is a graded, scope-limited assignment).
- Install unnecessary libraries (see §4 above).
- Rewrite the entire project to fix a small, localized issue.
- Change the database schema without updating `ARCHITECTURE.md` §7 and logging the decision in `MEMORY.md`.
- Change API contracts without updating `ARCHITECTURE.md` §8.
- Ignore the existing implementation in favor of starting over.
- Assume undocumented requirements — if something is unclear, add it to `PRD.md` §12 Open Questions instead of guessing.

---

## 7. Error Handling Strategy

- All backend errors flow through one centralized error-handling middleware producing a consistent `{ error: { code, message } }` JSON shape.
- Known error types (validation, not-found, conflict/double-booking, auth) map to specific HTTP status codes (400/404/409/401/403); everything else maps to 500 and is logged server-side with a stack trace (never sent to the client).
- Third-party integration failures (LLM, email, Calendar) are caught at the service boundary, logged, and stored with a `FAILED` status on the relevant record — they never bubble up as a failure of the primary user action (booking, note submission), per PRD FR-024.
- Background jobs (reminders, email retries) use a bounded retry count with logging on final failure — no infinite retry loops.

---

## 8. Testing Strategy

- **Unit testing:** booking-concurrency logic, slot-generation logic (from working hours + slot duration), and LLM-response parsing (urgency/chief complaint/questions) are the highest-value unit tests — cover them first.
- **Integration testing:** booking flow end-to-end (search → book → symptom form), leave-conflict cascade (mark leave → verify cancellations + notifications), LLM failure path (mock LLM failure → verify booking still succeeds).
- **UI testing:** manual verification of each portal's core flow (patient booking, doctor notes, admin doctor/leave management) is sufficient at this scope; automated UI tests are optional/nice-to-have, not required by the assignment.
- **Edge cases to explicitly test:** simultaneous booking of the same slot, doctor leave marked over existing bookings, empty/garbled LLM response, invalid/expired OAuth token, email provider failure + retry.
- **Manual testing:** run through each user story in `PRD.md` §7 before considering a phase done.

---

## 9. Git Strategy

- **Branch naming:** work directly on `main` for a solo assignment of this size, or use short-lived `feature/<name>` branches merged into `main` if preferred — final submission must be on `main` (submission guideline requirement).
- **Commit naming:** `<type>: <short description>` (e.g., `feat: add booking concurrency guard`, `fix: handle LLM timeout on symptom form`).
- **When to commit:** at the end of each completed task in `PHASES.md`, not mid-feature.
- **What must never be committed:** `.env`, `node_modules/`, build output (`dist/`, `.next/`, `out/`), editor folders (`.vscode/`, `.idea/`) — per submission guidelines. Provide `.env.example` instead.

---

## 10. Definition of Done

A feature/phase is "done" when:
1. All its Functional Requirements (PRD §5) are implemented and pass their Acceptance Criteria (PRD §8).
2. Errors are handled per §7 above (no unhandled crashes on bad input or integration failure).
3. The relevant API endpoints and DB schema changes (if any) are documented in `ARCHITECTURE.md`.
4. `MEMORY.md` is updated (status, completed work, decisions, remaining work).
5. Manual test of the corresponding user story passes.
6. No unnecessary dependencies were added without justification in this file.
