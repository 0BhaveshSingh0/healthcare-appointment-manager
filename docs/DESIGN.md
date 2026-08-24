# DESIGN.md — UI/UX Design System
### Healthcare Appointment & Follow-up Manager

> Related docs: [PRD](./PRD.md) · [Architecture](./ARCHITECTURE.md) · [Plan](./PLAN.md) · [Phases](./PHASES.md) · [Memory](./MEMORY.md)

> **Status note:** No color palette, typography, or visual reference was provided in the assignment/reference documents. Everything in this file is **INFERRED** — a reasonable, minimal design system chosen to keep three role-based portals (patient/doctor/admin) visually consistent, not a client-mandated brand. If the assigning company later provides brand colors/fonts, update this file (and only this file) and note the change in `MEMORY.md` §9 Decisions Made.

---

## 1. Design Philosophy

- **Clarity over decoration.** This is a clinical tool — patients may be reading it while unwell or anxious, doctors will scan it quickly between visits. Every screen should be scannable in seconds.
- **Calm, trustworthy, low-friction.** Muted, clinical color palette (blues/teals/neutrals) rather than bright/playful colors. No dark patterns, no unnecessary animation.
- **Consistency across three portals.** Patient, Doctor, and Admin portals share the same component library, spacing, and typography — only navigation and available actions differ by role. A future AI/developer must never invent a new visual style per portal.
- **Information hierarchy matters more than visual flourish.** Urgency levels (Low/Medium/High from the AI pre-visit summary) and booking status are the most important pieces of information on their respective screens and must be the most visually prominent.

---

## 2. Color Palette

*(INFERRED — no brand colors specified in source documents.)*

| Role | Hex | Usage |
|---|---|---|
| Primary | `#2563EB` (blue-600) | Primary buttons, active nav item, links, focus rings |
| Primary Hover | `#1D4ED8` (blue-700) | Hover/active state of primary buttons |
| Secondary | `#0D9488` (teal-600) | Secondary actions, calendar/scheduling accents |
| Background | `#F8FAFC` (slate-50) | App background |
| Surface | `#FFFFFF` | Cards, modals, form panels |
| Text (primary) | `#0F172A` (slate-900) | Headings, primary body text |
| Text (muted) | `#64748B` (slate-500) | Helper text, timestamps, secondary labels |
| Border | `#E2E8F0` (slate-200) | Card borders, input borders, dividers |
| Success | `#16A34A` (green-600) | Confirmed booking, successful actions |
| Warning | `#D97706` (amber-600) | Medium urgency, pending states |
| Error | `#DC2626` (red-600) | High urgency, cancellations, validation errors, 409 conflicts |

**Urgency-level color mapping (used directly on the AI pre-visit summary — Feature F4):**

| Urgency | Color |
|---|---|
| Low | Success `#16A34A` |
| Medium | Warning `#D97706` |
| High | Error `#DC2626` |

---

## 3. Typography

*(INFERRED — system font stack chosen to avoid adding a font-loading dependency, consistent with `PLAN.md` §4 "avoid unnecessary libraries.")*

- **Font family:** system font stack — `-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. No external font library needed.
- **Heading sizes:** H1 `28px / 700`, H2 `22px / 600`, H3 `18px / 600`.
- **Body size:** `15px / 400`.
- **Small text (timestamps, helper text, badges):** `13px / 400`.
- **Font weights used:** 400 (body), 500 (labels, button text), 600 (subheadings), 700 (page titles).
- **Line heights:** `1.5` for body text, `1.3` for headings.

---

## 4. Spacing System

*(INFERRED — 4px base unit, standard scale.)*

```text
xs   4px    — icon-to-text gaps
sm   8px    — tight internal padding
md   16px   — default padding, gap between related elements
lg   24px   — spacing between distinct sections within a card
xl   32px   — spacing between major page sections
2xl  48px   — page-level top/bottom margins
```

Consistent spacing must be reused via shared component styles/utility classes — never hardcoded per page (see `PLAN.md` §4: avoid a heavy design-system package; a lightweight utility approach, e.g. Tailwind, is sufficient).

---

## 5. Layout

- **Container width:** max `1200px`, centered, with `16px` side padding on smaller viewports.
- **Grid:** 12-column responsive grid for dashboard/list views; single-column stacked layout on mobile.
- **Navigation:** Persistent top navbar (logo/app name, role-appropriate nav links, user menu with logout) — same navbar shell across all three portals, with nav links swapped by role (`RoleGuard`-driven, per `ARCHITECTURE.md` §5).
- **Sidebar:** Not required at this scope — top nav is sufficient for the number of screens per portal (avoids over-engineering per `PLAN.md` §4).
- **Cards:** Used for doctor listings, appointment items, and summary panels — white surface, `border` color, `8px` border-radius, `md` internal padding.
- **Sections:** Each page groups related content into clearly titled sections (H2) rather than one long undifferentiated form/list.

---

## 6. Components

| Component | Design notes |
|---|---|
| **Buttons** | Primary (filled, Primary color), Secondary (outlined), Destructive (Error color, filled) — used only for cancel/delete actions. One consistent size/shape per button role across all portals — never a different button style for the same action type on different pages. |
| **Inputs** | Labeled above the field (not placeholder-only), `1px` border in Border color, Primary-color focus ring, inline error message below the field in Error color. |
| **Forms** | Grouped logically (e.g., working hours fields together); required fields marked; validation errors shown inline, mirrored from backend validation per `ARCHITECTURE.md` §5/§6. |
| **Cards** | Doctor search result card: name, specialisation, next available slot preview, "View Slots" button. Appointment card: date/time, doctor/patient name, status badge. |
| **Tables** | Used in Admin views (doctor list, leave calendar) — zebra-free, border-based rows, sticky header for long lists. |
| **Navigation** | Top navbar, active link underlined/colored in Primary. |
| **Modals** | Used for confirmations only (e.g., "Confirm booking," "Confirm N appointments will be cancelled" per Phase 7 leave cascade) — never for primary content/forms. |
| **Alerts / Toasts** | Success (green), Error (red), Info (blue) — top-right toast for transient feedback (e.g., "Booking confirmed"), inline `Alert` banner for persistent page-level state (e.g., "AI summary pending — LLM did not respond"). |
| **Loading states** | Skeleton placeholders for lists/cards; spinner for button-triggered actions (e.g., "Booking..."). No blocking full-page spinners except initial auth check. |
| **Empty states** | Friendly, actionable message + relevant next action (e.g., "No appointments yet — Search Doctors" for a patient with no bookings). |
| **Error states** | Distinguish validation errors (inline, field-level) from system errors (page-level `Alert`, e.g., "Something went wrong — please try again"), per `ARCHITECTURE.md` §11. |

---

## 7. Responsive Design

- **Desktop (≥1024px):** Full 12-column grid, multi-column dashboards, top navbar with all links visible.
- **Tablet (768–1023px):** Grid collapses to 2 columns for cards/lists; navbar links may collapse into a menu if space-constrained.
- **Mobile (<768px):** Single-column stacked layout; navbar collapses to a hamburger menu; forms and tables become vertically stacked/scrollable rather than horizontally cramped.

---

## 8. Accessibility

*(Baseline, per PRD §6 Non-Functional Requirements — Accessibility)*

- All form inputs have associated `<label>` elements (not placeholder-only labels).
- All interactive elements (buttons, links, form fields) are reachable and operable via keyboard (tab order, visible focus ring in Primary color).
- Color is never the only signal for meaning — urgency levels and status badges pair color with a text label (e.g., "High" badge, not just a red dot).
- Sufficient color contrast between text and background (targeting WCAG AA for body text).
- Error messages are announced next to the relevant field, not only via color.

---

## 9. UX Rules

- **Feedback after actions:** Every write action (book, cancel, submit symptom form, submit notes, mark leave) shows immediate feedback — a toast on success, an inline error on failure. No silent failures.
- **Loading behavior:** Buttons that trigger an async action show a loading state and are disabled while in flight (prevents duplicate submissions — relevant to double-booking risk in Phase 3).
- **Error messages:** Plain language, no raw error codes/stack traces shown to the user (per `ARCHITECTURE.md` §11 — raw DB/API errors never leak to the client).
- **Validation messages:** Shown inline, next to the field, at the moment of blur or submit — not only in a summary banner.
- **Confirmation messages:** Destructive or high-impact actions (cancel appointment, mark doctor leave over existing bookings) require an explicit confirmation modal stating the impact (e.g., "This will cancel 3 existing appointments and notify affected patients").
- **Navigation behavior:** After a successful booking/submission, the user is navigated to a relevant next screen (e.g., booking confirmation → symptom form), not left on a stale form.

---

## 10. Design Do / Don't

### DO
- Reuse the shared component library (`components/`) across all three portals.
- Keep the primary action on each screen visually obvious (one Primary button per view, generally).
- Pair urgency/status color coding with a text label, always.
- Keep spacing consistent using the scale in §4.

### DON'T
- Don't introduce a new color outside the palette in §2 without updating this file first.
- Don't use a different button style for the same semantic action (e.g., two different "Cancel" button treatments).
- Don't change typography or spacing scale between the patient, doctor, and admin portals — they must feel like one product.
- Don't add a component library (e.g., a full Material/Ant UI kit) beyond what's needed — see `PLAN.md` §4.
