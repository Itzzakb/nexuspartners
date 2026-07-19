# Nexus Partners — User Manual

**Product:** Nexus Partners Admin Portal & Recruiter Portal  
**Website:** [nexuspartners.com](https://nexuspartners.com)  
**Version:** 1.0  
**Last updated:** July 2026

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Getting started](#2-getting-started)
3. [User roles and access](#3-user-roles-and-access)
4. [Admin portal overview](#4-admin-portal-overview)
5. [Dashboard](#5-dashboard)
6. [Ticket workflow (core process)](#6-ticket-workflow-core-process)
7. [Students](#7-students)
8. [Resume & ATS tools](#8-resume--ats-tools)
9. [Interviews](#9-interviews)
10. [Job placements](#10-job-placements)
11. [Job Scrap](#11-job-scrap)
12. [Teams & recruiters](#12-teams--recruiters)
13. [Payments & billing](#13-payments--billing)
14. [Salaries](#14-salaries)
15. [Chat](#15-chat)
16. [User management & permissions](#16-user-management--permissions)
17. [Company settings](#17-company-settings)
18. [Recruiter portal](#18-recruiter-portal)
19. [Public links (no login required)](#19-public-links-no-login-required)
20. [API documentation (for developers)](#20-api-documentation-for-developers)
21. [FAQ & troubleshooting](#21-faq--troubleshooting)

---

## 1. Introduction

Nexus Partners is a web platform for managing resume-related work across internal teams and recruiters. It supports:

- **Ticket-based resume workflow** — Mentor → Resume → Onboarding teams
- **Student records** — profiles, notes, payments, subscriptions
- **ATS resume building** — search, edit, and download resumes
- **Interviews & placements** — track candidate interviews and job offers
- **Job scraping** — automated job discovery from external job boards (TheirStack)
- **Recruiter portal** — separate login for recruiters to apply to jobs on behalf of students
- **Payments, billing, salaries, and internal chat**

The system has **two main interfaces**:

| Interface | Who uses it | URL (example) |
|-----------|-------------|---------------|
| **Admin Portal** | Staff (mentors, resume team, onboarding, admins) | `https://your-domain.com/login` |
| **Recruiter Portal** | External recruiters assigned to students | `https://your-domain.com/recruiter-portal/login` |

---

## 2. Getting started

### 2.1 Admin login

1. Open the admin portal URL in your browser.
2. Enter your **email** and **password**.
3. Click **Sign in**.
4. You land on the **Dashboard**.

**First-time users:** Use **Register** if your company allows self-registration, or ask your company admin to create your account under **User Management**.

**Forgot password:** Use **Reset password** on the login page (email link via SendGrid).

### 2.2 Recruiter login

1. Open `/recruiter-portal/login`.
2. Enter **username** and **password** (provided when the recruiter account is created in **Recruiters**).
3. You land on **Applications**.

> Recruiter accounts are separate from admin accounts. A recruiter cannot use admin email login, and vice versa.

### 2.3 Navigation

- **Desktop:** Use the left sidebar for all modules.
- **Mobile:** Tap the menu icon to open the sidebar.
- **Sign out:** Bottom of the sidebar → **Sign out**.

---

## 3. User roles and access

### 3.1 Built-in roles

| Role | Typical use |
|------|-------------|
| **Admin** | Full company access; settings, users, billing |
| **Mentor** | Creates tickets, tracks candidates |
| **Resume** | Works on resume tickets; sees **My Tickets** view |
| **Onboarding** | Tracks onboarding stage and completion |

Platform-level **Platform Admin** can manage multiple companies.

### 3.2 Module permissions

Admins can restrict which sidebar items each user sees via **User Access**:

| Module | What it controls |
|--------|------------------|
| Tickets | Ticket lists, create ticket, ticket detail |
| Interviews | Interview list and detail |
| Placements | Job placement records |
| Teams | Team management, My Team |
| Recruiters | Create/list recruiters |
| Payments | Payments and payment links |
| Salaries | Employee salaries and leaves |
| Billing | Generate billing |
| Chat | Internal messaging |
| Users | User management, user access |
| Students | All Students, student detail |
| ATS | Search Resume, ATS Resumes |
| Job Scrap | Job search profiles and scraped jobs |
| Prompts | AI prompt editor (platform admin) |

**Company admins** and **platform admins** see all modules by default. Other users see only modules granted to them (or default modules if no template is assigned: tickets, chat, interviews, placements, students).

---

## 4. Admin portal overview

### Sidebar structure

**Main navigation**

- Dashboard  
- All Students  
- Search Resume / ATS Resumes  
- Create Ticket  
- Interviews  
- Job Placements  
- Job Scrap *(admin)*  
- Teams / My Team *(admin for Teams)*  
- Recruiters *(admin)*  
- Payments / Payment Links *(admin)*  
- Salaries  
- Generate Billing  
- Chat  
- User Access *(admin)*  
- Prompt Editor *(platform admin)*  
- User Management *(admin)*  
- Companies *(platform admin)*  
- Settings *(admin)*  

**Tickets section** (filtered views)

- All Tickets  
- New Resumes  
- Existing Resume  
- My Tickets *(resume role only)*  
- Group Created  
- Waiting for Approval  
- Sent to Onboarding  
- Onboarded Successfully  
- Deleted Tickets  

---

## 5. Dashboard

The dashboard gives a snapshot of operations:

- **Stat cards:** Total tickets, pending, waiting for approval, completed (with trend vs previous period).
- **Activity chart:** Ticket activity over 7 days, 30 days, or 3 months.
- **Bottom panel:** Tabs for recent tickets, interviews, and stage breakdown.
- **Upcoming interviews:** Interviews in the next 7 days.

Use the dashboard for daily standups and workload overview.

---

## 6. Ticket workflow (core process)

Tickets are the heart of Nexus Partners. They track a candidate’s resume from creation through onboarding.

### 6.1 Ticket types

| Type | When to use |
|------|-------------|
| **New Resume** | Candidate needs a resume built from scratch |
| **Existing Resume** | Candidate already has a resume to update or refine |

### 6.2 Ticket stages (in order)

```
Ticket Created
    ↓
Group Created & Instructions Completed
    ↓
Waiting for Client Approval
    ↓
Sent to Onboarding
    ↓
Onboarded Successfully
```

Tickets can move **forward** or **backward** to any previous stage (for rework). Every stage change is logged in **History** with who changed it and optional notes.

| Stage | Typical owner |
|-------|----------------|
| Ticket Created | Mentor |
| Group Created & Instructions Completed | Resume team |
| Waiting for Client Approval | Mentor / client review |
| Sent to Onboarding | Onboarding team |
| Onboarded Successfully | Onboarding team |

### 6.3 Creating a ticket

1. Go to **Create Ticket**.
2. Select **Ticket Type** (New / Existing Resume).
3. Optionally **search and link an existing student** to auto-fill name, phone, email.
4. Fill in **Candidate Name**, **Phone**, **Email**, **Due Date**, **Notes/Instructions**, optional **Chat Link**.
5. Click **Create Ticket**.
6. You are taken to the **Ticket Detail** page.

### 6.4 Ticket detail — what you can do

On any ticket (`/ticket/:id`):

- **Change stage** — Use ← Previous / Next → buttons; add an optional note.
- **Link student** — Connect ticket to a Nexus Partners student record.
- **Resume form** — Copy link for the candidate to fill a structured resume form (public, no login).
- **Share form view** — Read-only share link for completed form.
- **Enable form edit** — Allow candidate to edit after submission.
- **Upload files** — Attach resume files or links.
- **Work notes** — Internal notes for resume team.
- **Onboarding notes** — Notes for onboarding team.
- **Assign** — Assign ticket to a resume team member.
- **History** — Full audit trail of stage changes.
- **Delete** — Soft-delete with reason (appears under Deleted Tickets).

### 6.5 Ticket list views

Use sidebar ticket filters or `/tickets?view=...`:

| View | Shows |
|------|--------|
| All Tickets | All non-deleted tickets |
| New Resumes | Type = new_resume |
| Existing Resume | Type = existing_resume |
| My Tickets | Assigned to current user (resume team) |
| Group Created | Stage = group_created |
| Waiting for Approval | Stage = waiting_for_approval |
| Sent to Onboarding | Stage = sent_to_onboarding |
| Onboarded Successfully | Stage = onboarded_successfully |
| Deleted Tickets | Soft-deleted tickets |

---

## 7. Students

### 7.1 All Students

- Browse and search students synced from the Nexus Partners student API.
- **Create student** (password-protected in Settings) — add new student to the system.
- Click a student to open **Student Detail**.

### 7.2 Student detail

Shows:

- Profile information from student API  
- **Recruiter notes** (editable)  
- Linked **tickets**  
- **Interviews**  
- **Payments** and **billing** history  

Use **Search Resume** from student detail to jump to resume tools for that phone number.

---

## 8. Resume & ATS tools

### 8.1 Search Resume

1. Enter student **phone number** and search.
2. View student profile and **resume JSON**.
3. Select an **ATS template** (from ATS Resumes).
4. **Build & Download** — generates ATS-compatible resume file.
5. **Update Resume** — save edited JSON back to the student record.

### 8.2 ATS Resumes (templates)

Admins manage resume templates:

- **Name**, description, sections, template content  
- Mark one template as **default**  
- Templates are used when building/downloads resumes in Search Resume and in the Recruiter Portal  

### 8.3 Prompt Editor (platform admin)

Edit AI prompts used for:

- Resume parsing (Gemini)  
- ATS resume build instructions  
- **Fix Resume for Job** (recruiter portal)  

Changes affect how AI tailors resumes globally.

---

## 9. Interviews

### 9.1 Interview list

- **Active interviews** — not yet completed  
- **Completed** — finished interviews  
- Filter by company (platform admin)  
- Bulk actions on completed interviews  

### 9.2 Interview stages

1. **Interview Reported**  
2. **Ready for Interview**  
3. **Interview Completed**  

### 9.3 Creating / editing an interview

Fields include: candidate name, phone, position, company, date/time, timezone, job description, screenshot, resume file, cancelled flag, self-instruction flag, moved-forward tracking.

### 9.4 Share link

Generate a **share link** (`/interview-share/:token`) to send interview details externally without login.

---

## 10. Job placements

Record successful job placements:

- Candidate, company, role, salary, dates  
- Upload documents (offer letter, interview screenshot, etc.)  
- Soft-delete with password protection  
- Toggle **show deleted** to audit removed records  

---

## 11. Job Scrap

*Admin / job_scrap permission required.*

Automated job discovery via **TheirStack API**.

### 11.1 Tabs

| Tab | Purpose |
|-----|---------|
| **Search Profiles** | Configure what jobs to search for and when to sync |
| **Scraped Jobs** | Browse stored jobs |
| **Sync History** | Log of manual and scheduled sync runs |

### 11.2 Search profile

Each profile defines:

- **Job titles**, **countries**, **domains**, **location IDs**  
- **Posted time** — last N hours/days or calendar date range  
- **Remote** filter (any / remote only / on-site only)  
- **Schedule** — time of day, days of week, timezone for automatic sync  
- **Active** toggle  

Use **Sync now** for immediate fetch, or rely on cron schedule.

### 11.3 Scraped jobs table

- Search by title, company, location  
- Filter by source (API vs manual), status  
- Filter by **scraped date range**  
- Add jobs manually  
- Open apply URL, view domain, edit, delete  

Scraped jobs feed the **Recruiter Portal** job matching for students.

---

## 12. Teams & recruiters

### 12.1 Teams (admin)

- Create teams with name and company  
- Assign **recruiters (clerks)** and **students** to teams  
- Used for organizational grouping  

### 12.2 My Team

Any user with teams access can see teams they belong to and member/student lists.

### 12.3 Recruiters (admin)

- List recruiters from student platform  
- **Create recruiter** — name, email, mobile, username, password  
- Creating a recruiter also creates their **Recruiter Portal** login  

Recruiters only see students assigned to them in the external system.

---

## 13. Payments & billing

### 13.1 Payments

View payment records synced per student (subscription payments, etc.).

### 13.2 Payment links

- Create Razorpay payment links  
- Optional email/SMS notification toggles  
- Track status: created, paid, expired  
- Mock pay in development environment  

### 13.3 Generate billing

1. Select **year** and **month**.  
2. **Preview** — shows per-student active days and line amounts.  
3. **Generate** — creates billing records (draft or finalized).  
4. Billing uses company **bill rate per day** from Settings.  
5. Students on skip-billing list are excluded.  

---

## 14. Salaries

*Requires salaries module + password verification for sensitive actions.*

- Manage **employee salary** records  
- Track **leaves**  
- Password gate configured via `SALARIES_PASSWORD` in server environment  

---

## 15. Chat

Real-time internal messaging:

1. **Search users** to start a conversation.  
2. Select a conversation from the left panel.  
3. Send text messages and **images**.  
4. Messages update live via WebSocket.  

Use for quick coordination between mentor, resume, and onboarding teams.

---

## 16. User management & permissions

### 16.1 User Management (admin)

- List users in your company  
- Create users (email, name, role, password)  
- Activate/deactivate users  
- Send password reset  

### 16.2 User Access (admin)

- Create **permission templates** — named sets of module toggles  
- Apply templates to individual users  
- Control exactly which sidebar items each staff member sees  

### 16.3 Companies (platform admin only)

- Create and edit companies  
- Set branding, API company name, billing settings, Razorpay, visa types, etc.  

---

## 17. Company settings

*Company admins only — **Settings** in sidebar.*

Configure:

- **Branding** — logo, favicon, app title, primary/secondary colors  
- **Website**  
- **Create student password** — gate for creating new students  
- **Visa types** and **additional detail fields** for students  
- **Bill rate per day**, salary currency  
- **Skip billing names** — students excluded from billing  
- **Demo profile IDs**  
- **Payment types**  
- **Razorpay** keys (platform admin)  
- **Zoho** integration toggle  

Changes apply to your company’s portal appearance and business rules.

---

## 18. Recruiter portal

Separate app section for recruiters working with assigned students.

**URL:** `/recruiter-portal/login`

### 18.1 Tabs

| Tab | Purpose |
|-----|---------|
| **Applications** | Pick a student → browse matched jobs → act on jobs |
| **My Students** | All students assigned to this recruiter |

### 18.2 Applications workflow

1. **Select a student** in the left sidebar (search supported).  
2. **Job list** appears on the right — jobs matched to the student’s role/title.  
3. Filter jobs by search text or **scraped date range**.  
4. Paginate through results (20 per page).  
5. Click a job card → **Job Detail**.

### 18.3 Job detail actions

| Action | What it does |
|--------|----------------|
| **Drop** | Hide this job for this student going forward |
| **Fix Resume** | AI tailors student resume to this job (Gemini); saves to student profile |
| **Download ATS Resume** | Build job-specific ATS PDF; opens download URL |
| **Apply Now** | Records application and opens external apply link in browser |

Also shows applicant info, activity counts (today / week / month), and recruiter notes.

### 18.4 Student detail (recruiter)

- Activity stats  
- Basic info, subscription, payments  
- **Recruiter notes** (editable)  
- Tickets list  
- Resume data viewer  
- **Download Resume** — general ATS download  
- Link to **View applications** for that student  

### 18.5 Job matching logic

- Jobs come from **Job Scrap** (status = open).  
- Matched by keywords from the student’s **role/job title** against job title.  
- Jobs **dropped** for that student are excluded.  
- Optional search and date filters on top.

---

## 19. Public links (no login required)

These URLs are shared with candidates or external parties:

| Link type | URL pattern | Purpose |
|-----------|-------------|---------|
| Resume form | `/resume-form/:ticketId` | Candidate fills structured resume for a ticket |
| Resume form view | `/resume-form-view/:token` | Read-only view of submitted form |
| Interview share | `/interview-share/:token` | Share interview details externally |

Staff copy these links from **Ticket Detail** or **Interview Detail**.

---

## 20. API documentation (for developers)

If your team integrates a mobile app or external system:

| Resource | URL |
|----------|-----|
| Swagger UI (Recruiter API) | `{API_URL}/api/docs/recruiter` |
| OpenAPI JSON | `{API_URL}/api/docs/recruiter/openapi.json` |
| Health check | `{API_URL}/api/health` |

**Example (local):** `http://localhost:4600/api/docs/recruiter`

Recruiter API covers: login, students, jobs, drop/apply, fix resume, ATS download, resume templates.

Admin APIs are used by the web app directly; contact your technical team for integration scope.

---

## 21. FAQ & troubleshooting

### I can’t see a sidebar item

Your admin may have disabled that module for your account. Ask them to check **User Access** or assign a permission template.

### Recruiter can’t log in

1. Confirm account was created under **Recruiters** in admin.  
2. Use **username** (not email) on recruiter login.  
3. Ensure account is active.  

### Job Scrap returns no jobs

1. Check **TheirStack API key** is configured on the server.  
2. Verify search profile has valid filters (titles, countries, posted date).  
3. Run **Sync now** on the profile and check **Sync History** for errors.  

### Fix Resume does nothing in development

**Gemini API key** (`GEMINI_API_KEY`) must be set on the server for AI resume tailoring. Without it, dev mode may return a mock response.

### ATS download has no file URL

Resume build depends on the Nexus Partners student/resume API. In development, mock mode may not return a real download URL.

### Chat messages not updating

Ensure WebSocket connection is allowed (same domain / `VITE_SOCKET_URL` configured). Refresh the page and re-open the conversation.

### Forgot admin password

Use **Reset password** on login page, or ask a company admin to send reset from **User Management**.

---

## Quick reference — URLs

| Page | Path |
|------|------|
| Admin login | `/login` |
| Dashboard | `/dashboard` |
| Create ticket | `/create` |
| Tickets | `/tickets` |
| Students | `/students` |
| Job Scrap | `/job-scrap` |
| Settings | `/settings` |
| Recruiter login | `/recruiter-portal/login` |
| Recruiter applications | `/recruiter-portal/applications` |
| Recruiter students | `/recruiter-portal/students` |
| API Swagger | `/api/docs/recruiter` |

---

## Support

For technical issues (login, API, integrations), contact your Nexus Partners system administrator or development team.

For workflow questions (when to move ticket stages, who assigns recruiters), follow your company’s internal SOP; this manual describes what the software supports, not your organization’s policy.

---

*Nexus Partners — User Manual v1.0*
