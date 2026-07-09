# Nexus Partners Admin — MERN Stack

Multi-company admin portal for [nexuspartners.com](https://nexuspartners.com).

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, General Sans font
- **Backend:** Express.js, MongoDB (Mongoose), JWT auth
- **Services:** Cloudinary (uploads), SendGrid (email — optional)

## Prerequisites

- Node.js 18+
- MongoDB running locally or MongoDB Atlas URI

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure server environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set at minimum:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/nexuspartners
JWT_SECRET=your-long-random-secret
JWT_REFRESH_SECRET=your-refresh-secret
CLIENT_URL=http://localhost:5173
```

Optional (for logo/favicon upload):

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Optional (for password reset emails):

```env
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=hello@nexuspartners.com
```

### 3. Seed database

```bash
npm run seed
```

This creates:
- **nexuspartners.com** (platform admin company)
- **vamshi@gmail.com** / `Saibaba@2025` (platform admin, active)
- **resume@nexuspartners.com** / `Saibaba@2025` (resume team user)

Static logo: `client/public/logo.png` (served at `/logo.png`)

### 4. Run development

```bash
npm run dev
```

- API: http://localhost:5000
- App: http://localhost:5173

## Phase 1 features

- [x] User registration with company selection
- [x] Login / logout with JWT
- [x] Inactive users blocked from login
- [x] Company admin: user management (activate/revoke, change role, send password reset)
- [x] Platform admin: manage all companies
- [x] Company settings: logo, favicon, colors, app title, branding preview
- [x] Blue → purple theme, General Sans, pill buttons

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/companies/public` | Companies for registration |
| GET | `/api/companies` | All companies (platform admin) |
| PATCH | `/api/companies/me` | Update own company settings |
| GET | `/api/users` | List users (company admin) |
| PATCH | `/api/users/:id` | Update user |
| POST | `/api/upload` | Upload file to Cloudinary |

## Phase 2 features

- [x] Ticket CRUD with full stage workflow
- [x] Stage history timeline (forward & backward)
- [x] Resume team allocation
- [x] Work notes, resume files/links, soft delete
- [x] Realtime updates via Socket.io
- [x] External API for nexuspartners (`POST /api/tickets/external`)
- [x] Idempotency key support for duplicate prevention
- [x] Ticket filters: company, assignment, type, chat link
- [x] Dashboard ticket stats

## Ticket API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (filters via query) |
| GET | `/api/tickets/stats` | Dashboard stats |
| POST | `/api/tickets` | Create ticket (authenticated) |
| POST | `/api/tickets/external` | External create (x-api-secret) |
| GET | `/api/tickets/:id` | Ticket detail + history |
| POST | `/api/tickets/:id/stage` | Change stage |
| POST | `/api/tickets/:id/assign` | Assign resume editor |
| POST | `/api/tickets/:id/notes` | Add work/onboarding note |
| POST | `/api/tickets/:id/files` | Add resume file/link |
| DELETE | `/api/tickets/:id` | Soft delete with reason |
| GET | `/api/tickets/resume-team` | List resume team members |

### External API (nexuspartners)

```http
POST /api/tickets/external
Content-Type: application/json
x-api-secret: your-secret
Idempotency-Key: optional-unique-key

{
  "ticket_type": "new_resume",
  "candidate_name": "John Doe",
  "phone_number": "+1234567890",
  "email": "john@example.com",
  "due_date": "2026-03-15"
}
```

## Next: Phase 3

Public resume information form, student linking, Gemini resume parse.

### Phase 3 features

- [x] Public resume form at `/resume-form/:ticketId` (save & exit, complete, reset)
- [x] Company logo/branding on public form
- [x] Form status: unfilled / partial / completed (computed from data)
- [x] Ticket detail: form data table, enable edit again, view-only share link
- [x] Shared view at `/resume-form-view/:token`
- [x] Resume parse API (`POST /api/resume/parse`) — external API + Gemini fallback

## Phase 4 features

- [x] Interviews workflow (reported → ready → completed)
- [x] Job placements with document upload + password delete
- [x] Teams, My Team, Recruiters (Nexus Partners API proxy)

## Phase 5 features

- [x] Razorpay payment link creation (mock mode when `RAZORPAY_KEY_ID=mock_key_id`)
- [x] Payment records + manual payments (Cash / UPI / Bank Transfer)
- [x] Razorpay webhook handler (`POST /api/webhooks/razorpay`)
- [x] Auto-ticket creation on paid link for nexuspartners (`payment_type: new`)
- [x] Subscription schedules API
- [x] Payments & Payment Links UI pages

### Payment API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List payment records |
| GET | `/api/payments/stats` | Payment stats |
| POST | `/api/payments/manual` | Record manual payment |
| GET | `/api/payments/links` | List Razorpay payment links |
| POST | `/api/payments/razorpay/link` | Create payment link |
| POST | `/api/payments/mock/:id/pay` | Simulate mock payment (dev) |
| GET | `/api/payments/subscriptions` | List subscription schedules |
| POST | `/api/webhooks/razorpay` | Razorpay webhook (no JWT) |

## Phase 7 features

- [x] All Students — browse, search, create students (password-gated)
- [x] Student View — payments, tickets, interviews, billing, notes
- [x] Search Resume — lookup student, build ATS download, update resume JSON
- [x] ATS Resumes — template CRUD with default template support
- [x] Prompt Editor — platform admin Gemini/ATS prompt management
- [x] Ticket ↔ student linking on Create Ticket and Ticket Detail
- [x] Mobile-responsive sidebar with hamburger menu
- [x] Settings: visa types, additional detail fields, create student password

### Phase 7 API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | List students (external API + local enrichment) |
| GET | `/api/students/:phone` | Student detail with linked records |
| POST | `/api/students` | Create student (password required) |
| PATCH | `/api/students/:phone/notes` | Save internal student notes |
| GET | `/api/resume-templates` | List ATS templates |
| POST | `/api/resume-templates` | Create template |
| POST | `/api/resume/build-download` | Build ATS resume download |
| POST | `/api/resume/update-student` | Update student resume data |
| GET | `/api/prompts` | List app prompts (platform admin) |
| PATCH | `/api/prompts/:key` | Update prompt content |

## Phase 6 features

- [x] Salaries module with password gate (`SALARIES_PASSWORD`)
- [x] Employee leave management
- [x] Generate Billing — day-rate reports via `billRatePerDay`
- [x] User Access — permission templates + per-module toggles
- [x] Internal Chat — realtime messaging with image upload
- [x] `requireModule` middleware for route-level access control

### Phase 6 API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/salaries` | List employee salaries |
| POST | `/api/salaries` | Upsert salary (password required) |
| GET | `/api/salaries/leaves` | List leave records |
| POST | `/api/salaries/leaves` | Create leave |
| GET | `/api/billing/preview` | Preview billing for month |
| POST | `/api/billing/generate` | Generate billing records |
| GET | `/api/permissions/templates` | Permission templates |
| PATCH | `/api/permissions/users/:id` | Update user permissions |
| GET | `/api/chat/conversations` | List chats |
| POST | `/api/chat/conversations/:id/messages` | Send message |
