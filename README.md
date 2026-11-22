# FinBridge CRM — Loan Sales & Call Centre CRM System

A full-stack Loan Sales & Call Centre CRM platform built for financial intermediaries connecting borrowers with partner banks. Powered by React, TypeScript, Tailwind CSS, Recharts, Zod, React Hook Form, PapaParse, SheetJS (`xlsx`), and Firebase Authentication & Cloud Firestore.

## Portals & Routes

1. **Desktop Admin Portal (`/admin`)**
   - **Dashboard**: 10 live KPIs, 7-day call velocity chart, employee leaderboard, lead pipeline & loan application breakdown, upcoming follow-ups, and recent audit activity.
   - **Lead Management**: Create, edit, archive/restore, permanent delete, multi-filters (status, employee, loan type, priority, date), sorting, pagination, bulk employee assignment, CSV/XLSX import & export, and configurable duplicate lead prevention (`phone`, `email`, `phone_or_email`, `none`).
   - **Lead Distribution**: Unassigned queue, manual assignment, bulk assignment, workload-balanced automatic round-robin across 20+ agents, reassignment, and full assignment history.
   - **Employee Management**: Add/edit/activate/deactivate staff, set daily call targets, inspect employee profile, assigned leads, and call metrics.
   - **Call Management**: Log calls across all 8 call outcomes, auto-create follow-up callbacks, and review agent call statistics.
   - **Follow-up Management**: Overdue, Today, Upcoming, and Completed follow-up buckets, reassignment, and completion outcomes.
   - **Document Management**: Upload KYC files (Aadhaar, PAN, Bank Statement, Salary Slip, Employment/Address Proof), preview/download blobs, and verify/reject/request re-upload.
   - **Banks & Loan Schemes**: Full CRUD for partner banks and loan products (min/max loan amounts, interest rates, income eligibility, processing fees, tenure).
   - **Loan Applications**: Track applications across all 9 underwriting stages (`Lead Interested` through `Disbursed` and `Closed`) with full `loan_status_history` audit timelines.
   - **Reports & Analytics**: Date-filtered performance, conversion rates, bank-wise disbursements, and CSV report exports.

2. **Mobile Admin UI (`/admin/mobile`)**
   - Mobile-first application interface covering all 10 Admin modules with bottom navigation, touch bottom sheets (`>= 44px` targets), card-based lists, and direct persistence to Firestore.

3. **Staff / Call Centre Portal (`/staff`)**
   - Strictly scoped to the logged-in employee's assigned leads (`assignedEmployeeEmail` / `employeeEmail` enforced by both Firestore Security Rules and client queries).
   - Includes Staff Dashboard (8 KPIs + daily call target progress bar), My Leads drawer, Call Logger, Follow-ups, KYC Document Upload & Re-upload, Loan Application Progress, and Personal Performance Analytics.

## Database & Security Architecture

- **Schema Blueprint**: `/firebase-blueprint.json`
- **Security Rules**: `/firestore.rules` (enforces verified email auth, role-based Admin vs. Staff isolation, server timestamp integrity, and strict document schemas)
- **Collections**:
  - `users`, `admins`, `employees`, `daily_targets`
  - `leads`, `lead_assignments`
  - `call_logs`, `follow_ups`
  - `customer_documents`, `document_files`
  - `banks`, `loan_schemes`, `loan_applications`, `loan_status_history`
   - `activity_logs`, `notifications`, `settings`

## Real-Time Notifications & AI Lead Scoring

- **Real-Time Notification Stream (`notifications`)**: Persistent Firestore `onSnapshot` push alerts scoped by role and user email, delivering instant notifications for newly assigned leads, overdue/upcoming follow-ups, Hot AI-scored leads, KYC verification status changes, and loan application updates, with optional browser Desktop Notification opt-in.
- **AI-Powered Lead Scoring (`POST /api/ai/score-leads`)**: Express server endpoint powered by `@google/genai` (`gemini-4-hydrogen`) scoring borrower leads on a `0–100` scale (`Hot` / `Warm` / `Cold`) across 4 dimensions — Demographics, Financial Capacity (Income-to-Loan ratio), Lead Source Intent, and Call/Follow-up/KYC Engagement — backed by a deterministic `quantitative-v1` baseline calculator.

## Initial Demo Data

On first Admin sign-in, `seedDatabaseIfNeeded` populates Firestore (in atomic batches) with:
- 1 Admin + 20 Staff Call Centre Employees (`staff@loancrm.com` and 19 additional agents)
- 6 Partner Banks & 12 Loan Schemes
- 110 Borrower Leads (85 assigned across staff, 25 unassigned for round-robin testing) with baseline scores
- 95 Call Logs across the past 7 days & today
- 32 Follow-ups (overdue, today, upcoming, completed)
- 30 KYC Customer Documents (verified, pending, rejected, re-upload required)
- 28 Loan Applications across all 9 stages with status timelines
- Role-scoped starter real-time notifications

## Authentication Setup

- **Google Sign-In**: Enabled out of the box.
- **Email/Password Sign-In**: Enable **Email/Password** in Firebase Console (`Authentication -> Sign-in method -> Email/Password`) and create/verify your Admin (`admin@loancrm.com`) and Staff (`staff@loancrm.com`) users with `email_verified` enabled.

## Scripts

```bash
npm install
npm run dev      # Start Express + Vite dev server on port 3000
npm run lint     # Type-check with TypeScript
npm run build    # Production client bundle build
npm run start    # Start production Express server (server.ts)
```
