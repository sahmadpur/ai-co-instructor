# AI Feedback Generator for Google Classroom — REQUIREMENTS.md

**Project codename:** classroom-feedback
**Version:** v1
**Owner:** Sohrab Ahmadpur
**Target:** Single-teacher tool for generating AI-assisted feedback on Google Classroom submissions

---

## 1. Project Overview

A web app that lets a teacher sign in with their Google Workspace for Education account, pick a Google Classroom course and assignment, and have AI generate written feedback for each student submission. The teacher reviews and edits the feedback in a table, optionally regenerates individual rows, confirms the final version, and exports to Excel / PDF / CSV / HTML.

**This is NOT:**
- A grading tool (no scores, no rubrics, no numbers)
- A replacement for Google Classroom (Classroom remains the LMS)
- A multi-tenant SaaS (single-teacher mode for v1)
- A student-facing tool (teachers only)

**This IS:**
- A feedback-writing accelerator
- A read-only consumer of Classroom data (no writes back to Classroom)
- A local productivity tool the teacher runs for themselves

---

## 2. User Flow

1. Teacher visits the app and clicks **Sign in with Google**
2. App requests Classroom + Drive read-only scopes via OAuth
3. Teacher lands on home page → list of their Google Classroom courses
4. Teacher picks a course → list of assignments in that course
5. Teacher picks an assignment → preview screen showing:
   - Assignment title and description (fetched from Classroom)
   - Submission count
   - Optional **Feedback Focus** textarea ("What should the AI pay attention to?")
   - **Generate Feedback** button
6. On Generate:
   - App fetches all submissions from Classroom
   - Downloads attachments via Drive API where needed
   - Sends each submission to Claude with task description + feedback focus
   - Streams results into an editable table as they complete
7. Teacher reviews the table:
   - Each row = one student
   - Columns: student name, submission preview, AI feedback (editable), status, actions
   - Per-row **Regenerate** button (with optional "additional instructions")
   - Inline edit of feedback text
8. Teacher clicks **Confirm All** → record locks
9. Teacher clicks **Export** → choose format (Excel / PDF / CSV / HTML)
10. Past runs persist in the app's local DB and can be reopened

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | React 19, Server Actions where useful |
| Language | TypeScript | Strict mode |
| Auth | Auth.js v5 (NextAuth) | Google provider |
| DB | SQLite | Single file, easy backup |
| ORM | Drizzle ORM | Migrations via drizzle-kit |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) | Claude Sonnet 4.6 |
| UI | shadcn/ui + Tailwind CSS | Data table, dialog, button, textarea |
| Excel export | SheetJS (`xlsx`) | |
| PDF export | Browser `window.print()` with print CSS for v1; Puppeteer if per-student PDFs needed later | |
| CSV | papaparse | Proper escaping |
| HTML | Template literal | |
| Concurrency | `p-limit` | Limit AI calls to 5 in parallel |
| Deployment | Local dev / Vercel free tier / $5 VPS | |

---

## 4. Project Structure

```
classroom-feedback/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx                      # authenticated layout
│   │   ├── page.tsx                        # course list
│   │   ├── courses/[courseId]/page.tsx     # assignment list
│   │   ├── assignments/[courseWorkId]/page.tsx  # focus + generate
│   │   └── runs/[runId]/page.tsx           # editable feedback table
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── classroom/
│   │   │   ├── courses/route.ts
│   │   │   ├── courses/[courseId]/coursework/route.ts
│   │   │   └── coursework/[courseWorkId]/submissions/route.ts
│   │   ├── runs/
│   │   │   ├── route.ts                    # POST = create new run
│   │   │   ├── [runId]/route.ts            # GET, PATCH (confirm)
│   │   │   └── [runId]/generate/route.ts   # POST = trigger AI batch
│   │   ├── feedback/
│   │   │   ├── [feedbackId]/route.ts       # PATCH = edit
│   │   │   └── [feedbackId]/regenerate/route.ts
│   │   └── export/[runId]/[format]/route.ts
│   ├── login/page.tsx
│   └── layout.tsx
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── course-list.tsx
│   ├── assignment-list.tsx
│   ├── feedback-table.tsx
│   ├── feedback-row.tsx
│   ├── regenerate-dialog.tsx
│   ├── export-menu.tsx
│   └── progress-bar.tsx
├── lib/
│   ├── auth.ts                             # auth.js config
│   ├── db/
│   │   ├── index.ts                        # drizzle client
│   │   └── schema.ts                       # tables
│   ├── google/
│   │   ├── classroom.ts                    # course/coursework/submission fetchers
│   │   └── drive.ts                        # attachment downloader
│   ├── anthropic/
│   │   ├── client.ts
│   │   ├── prompts.ts                      # feedback prompt template
│   │   └── generate.ts                     # single-submission generator
│   ├── exports/
│   │   ├── excel.ts
│   │   ├── pdf.ts
│   │   ├── csv.ts
│   │   └── html.ts
│   └── utils.ts
├── drizzle/migrations/
├── public/
├── .env.local
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Data Model (Drizzle / SQLite)

```ts
// lib/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                    // Google sub
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),                    // uuid
  userId: text('user_id').notNull().references(() => users.id),
  courseId: text('course_id').notNull(),
  courseName: text('course_name').notNull(),
  assignmentId: text('assignment_id').notNull(), // Classroom courseWorkId
  assignmentTitle: text('assignment_title').notNull(),
  taskDescription: text('task_description'),
  feedbackFocus: text('feedback_focus'),
  status: text('status', { enum: ['draft', 'generating', 'review', 'confirmed'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
});

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),                    // uuid
  runId: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull(),        // Classroom userId
  studentName: text('student_name').notNull(),
  studentEmail: text('student_email'),
  submissionId: text('submission_id'),            // Classroom submission id
  submissionType: text('submission_type', {
    enum: ['text', 'gdoc', 'pdf', 'image', 'mixed', 'none']
  }).notNull(),
  submissionPreview: text('submission_preview'),  // first ~300 chars
  aiFeedback: text('ai_feedback'),                // immutable original
  editedFeedback: text('edited_feedback'),        // teacher's version
  status: text('status', {
    enum: ['pending', 'generating', 'generated', 'edited', 'failed']
  }).notNull(),
  errorMessage: text('error_message'),
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
});

export const apiLogs = sqliteTable('api_logs', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  feedbackId: text('feedback_id').references(() => feedback.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Key design notes:
- `aiFeedback` is **immutable** — never overwritten, even on regenerate. Regenerate writes a new row or updates `aiFeedback` only if status was `failed`.
- `editedFeedback` defaults to NULL; UI shows `editedFeedback ?? aiFeedback`. On first edit, copy aiFeedback to editedFeedback then apply changes.
- A "run" is one click of Generate. Reopening a run shows the same table state.

---

## 6. Google OAuth Setup

### Google Cloud Console

1. Create project: `classroom-feedback`
2. Enable APIs:
   - Google Classroom API
   - Google Drive API
3. Configure OAuth consent screen:
   - User type: **External**
   - Publishing status: **Testing** (do NOT submit for verification yet)
   - Add yourself + any other test teachers as test users (max 100)
4. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<production-domain>/api/auth/callback/google`

### Required scopes

```
openid
email
profile
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.students.readonly
https://www.googleapis.com/auth/classroom.rosters.readonly
https://www.googleapis.com/auth/classroom.profile.emails
https://www.googleapis.com/auth/drive.readonly
```

### Auth.js config (`lib/auth.ts`)

- Google provider with the scopes above
- `access_type: 'offline'` and `prompt: 'consent'` to get a refresh token
- Persist `access_token` and `refresh_token` in JWT/session for use in API routes
- On token expiry, refresh using the refresh token

---

## 7. Google Classroom API Integration (`lib/google/classroom.ts`)

Use the access token from the session to call Classroom REST endpoints directly with `fetch` (avoids googleapis SDK weight). Endpoints needed:

| Purpose | Endpoint |
|---|---|
| List courses (where user is teacher) | `GET https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE` |
| List coursework | `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork` |
| Get coursework details | `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork/{courseWorkId}` |
| List submissions | `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork/{courseWorkId}/studentSubmissions` |
| Get student profile | `GET https://classroom.googleapis.com/v1/userProfiles/{userId}` |

### Submission processing

For each `studentSubmission`:
- If `state` is `NEW` or `CREATED` → mark `submissionType: 'none'`, skip AI call, still show row
- Read `assignmentSubmission.attachments[]`:
  - `driveFile` → use Drive API to fetch
  - `link` → ignore for v1 (mark as link-only, skip AI)
  - `youTubeVideo` → ignore for v1
  - `form` → ignore for v1
- If `shortAnswerSubmission.answer` exists → use as text submission

---

## 8. Google Drive Integration (`lib/google/drive.ts`)

For each Drive file ID found in submissions:

1. Get file metadata: `GET https://www.googleapis.com/drive/v3/files/{fileId}?fields=id,name,mimeType,size`
2. Branch by `mimeType`:
   - `application/vnd.google-apps.document` → Export as PDF: `GET /drive/v3/files/{fileId}/export?mimeType=application/pdf` → send to Claude as `document` block
   - `application/pdf` → Download directly: `GET /drive/v3/files/{fileId}?alt=media` → send to Claude as `document` block
   - `image/png`, `image/jpeg`, `image/webp`, `image/gif` → Download → send to Claude as `image` block
   - Other (docx, etc.) → For v1: skip with note "unsupported file type". Future: convert via Drive export or LibreOffice headless.
3. Cap file size at 32MB (Claude API limit).

---

## 9. AI Integration (`lib/anthropic/`)

### Model

`claude-sonnet-4-6` (or latest Sonnet at build time — confirm via Anthropic docs).

### Prompt template (`lib/anthropic/prompts.ts`)

```ts
export function buildFeedbackPrompt({
  taskDescription,
  feedbackFocus,
}: {
  taskDescription: string;
  feedbackFocus?: string;
}) {
  return `You are reviewing a student's submission for a Business Analysis or Data Analysis course. Your job is to write feedback the student can learn from.

TASK DESCRIPTION:
${taskDescription}

FEEDBACK FOCUS:
${feedbackFocus || 'General quality of the submission against the task description.'}

Write feedback in this exact structure:

**What worked**
2-3 specific things the student did well. Reference actual content from their submission, not generic praise.

**What to improve**
2-3 specific issues. For each one, show what better looks like with a concrete example or rewrite. Don't just say "be more specific" — demonstrate what specific looks like.

**One thing to think about**
A single question or prompt that pushes the student's thinking deeper.

Rules:
- 150-250 words total
- Direct, constructive, peer-to-peer tone — not parent-to-child
- Reference the actual submission, not generic BA principles
- If the submission is empty, missing, or off-topic, say so plainly and give one suggestion for what to do next
- Output the feedback only — no preamble, no signoff`;
}
```

### Generation function (`lib/anthropic/generate.ts`)

- Input: `{ taskDescription, feedbackFocus, submission }` where `submission` is one of `{ type: 'text', text }`, `{ type: 'document', base64, mediaType }`, `{ type: 'image', base64, mediaType }`
- Build a Messages API call with one user message containing the prompt + the submission as the appropriate content block
- Return `{ feedback, inputTokens, outputTokens }` and log to `apiLogs`
- Catch errors and surface a useful error message to the row

### Concurrency

Use `p-limit(5)` when generating for a whole class. Stream completions back to the client with Server-Sent Events or by polling a status endpoint — start with polling for simplicity (every 2s, fetch run state, update table).

### Cost tracking

- Sonnet 4.6 input ~ $3 / MTok, output ~ $15 / MTok (verify current pricing at build time)
- Compute and store per-call cost in `apiLogs.costUsd`
- Display total run cost in the UI

---

## 10. UI / UX Specification

### Pages

**`/login`** — single button: "Sign in with Google"

**`/` (course list)**
- Page title: "Your Classroom Courses"
- Card grid: course name, section, student count, "Pick" button → `/courses/{id}`
- Empty state if no active courses

**`/courses/{courseId}` (assignment list)**
- Breadcrumb: Courses › {Course Name}
- List of assignments (most recent first): title, due date, submission count, "Pick" button → `/assignments/{courseWorkId}`

**`/assignments/{courseWorkId}` (run setup)**
- Breadcrumb: Courses › {Course Name} › {Assignment Title}
- Read-only: assignment description (rendered from Classroom)
- Textarea: "Feedback focus (optional)" with placeholder "e.g., focus on whether user stories follow INVEST and acceptance criteria are testable"
- Stats: "X submissions ready, Y not turned in"
- Big button: **Generate Feedback** → creates a `run`, kicks off generation, redirects to `/runs/{runId}`

**`/runs/{runId}` (the main table)**
- Breadcrumb + run metadata header (course, assignment, created date, status)
- Progress bar while status is `generating` (X of N done)
- Table columns:
  1. Student name
  2. Submission preview (truncated, click to expand in dialog)
  3. AI Feedback (textarea, editable inline, autosave on blur)
  4. Status badge (pending / generating / generated / edited / failed)
  5. Actions: Regenerate button, Reset to AI version button (only if edited)
- Below table:
  - Total cost so far
  - **Confirm All** button (locks the run)
  - **Export** dropdown: Excel / PDF / CSV / HTML
- Regenerate dialog: optional textarea "Additional instructions for this student", Cancel / Regenerate

### UX rules

- Autosave on textarea blur (PATCH `/api/feedback/{id}` with `editedFeedback`)
- Confirmed runs: textareas become read-only, big banner "Confirmed on {date}"
- Failed rows: show error message, regenerate button still works
- Don't block on individual failures — table still usable

---

## 11. Export Functionality

All exports include: course name, assignment title, generation date, and per-student feedback.

**Excel** (`lib/exports/excel.ts`)
Columns: Student Name, Email, Submission Preview, Feedback (final), Status. Use SheetJS, autosize columns, freeze header row.

**CSV** (`lib/exports/csv.ts`)
Same columns. Use papaparse `unparse` for proper escaping.

**HTML** (`lib/exports/html.ts`)
Single self-contained HTML file with print-friendly CSS. One section per student (h2 with name, blockquote with submission preview, div with feedback).

**PDF** (`lib/exports/pdf.ts`)
v1: serve the HTML with `?print=1` query param, browser handles print-to-PDF via `window.print()`.
v2 (if needed): server-side Puppeteer for one-click download.

---

## 12. Environment Variables

```bash
# .env.local
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=<from google cloud console>
GOOGLE_CLIENT_SECRET=<from google cloud console>

ANTHROPIC_API_KEY=<from console.anthropic.com>
ANTHROPIC_MODEL=claude-sonnet-4-6

DATABASE_URL=file:./local.db
```

---

## 13. Build Order / Milestones

### Milestone 1 — Auth + Classroom read (Day 1)
- [ ] Next.js 15 project scaffold with TypeScript + Tailwind
- [ ] Install and configure shadcn/ui
- [ ] Auth.js v5 with Google provider, scopes set, refresh token flow
- [ ] `/login` page
- [ ] `/` showing real Classroom courses
- [ ] `/courses/{id}` showing real assignments
- **Done when:** signing in shows your real courses and clicking through shows real assignments.

### Milestone 2 — Submission ingestion (Day 2)
- [ ] Drizzle schema + migrations
- [ ] Drive API integration (Doc → PDF export, PDF download, image download)
- [ ] `/assignments/{courseWorkId}` page with description + focus textarea
- [ ] On Generate click: create `run` row + `feedback` rows for each submission, status `pending`
- **Done when:** clicking Generate creates DB rows for every student in a real assignment.

### Milestone 3 — AI generation (Day 3)
- [ ] Anthropic client + prompt template
- [ ] Single-submission generator with all 3 content types (text/doc/image)
- [ ] `/runs/{runId}` page, polling for updates
- [ ] Concurrent batch generation with p-limit(5)
- [ ] Cost logging
- **Done when:** generating produces real feedback for every student in your test class.

### Milestone 4 — Editing + regenerate (Day 4)
- [ ] Inline textarea editing with autosave
- [ ] Regenerate button + dialog with extra instructions
- [ ] Reset to AI version button
- [ ] Confirm All flow + lock state
- **Done when:** you can edit, regenerate, and confirm a full run.

### Milestone 5 — Exports (Day 5)
- [ ] Excel export
- [ ] CSV export
- [ ] HTML export
- [ ] PDF (browser print) export
- **Done when:** all 4 formats download cleanly.

### Milestone 6 — Polish (Day 6+)
- [ ] Error handling on all API routes
- [ ] Loading states everywhere
- [ ] Empty states
- [ ] Cost summary in run header
- [ ] "Past runs" list on home page
- [ ] Prompt iteration based on real student work

---

## 14. Acceptance Criteria

The v1 ships when all of the following are true:

1. A teacher can sign in with their @ada.edu.az or @codeacademy email and see their real courses
2. They can pick any active course and see all assignments
3. They can pick any assignment and see its description plus a focus textarea
4. Clicking Generate produces feedback for every student with a turned-in submission within ~2 minutes for a class of 30
5. Submissions of type text, Google Doc, PDF, and image are all handled
6. Each row of the table is independently editable, regeneratable, and savable
7. Confirming locks the run; reopening a confirmed run shows the locked state
8. All four exports (Excel, CSV, HTML, PDF) produce a usable file
9. Total run cost is visible and accurate
10. The original AI output is preserved separately from the teacher-edited version

---

## 15. Out of Scope for v1 (Future)

- Multi-teacher / multi-tenant
- Student-facing UI
- Posting feedback back to Classroom (API doesn't support private comments)
- Custom rubrics
- Numeric grading
- Bulk regenerate with new focus
- Comment bank / saved snippets
- Comparing AI vs edited diffs as analytics
- Localization (currently English only; Az/Ru/Tr later)
- DOCX/XLSX submission support beyond PDF/Doc/image
- Server-side PDF rendering with Puppeteer (browser print is enough for v1)

---

## 16. Notes for Claude Code

When building this:

- **Start at Milestone 1.** Don't scaffold the full file tree upfront — grow it as you implement features.
- **Prefer Server Components and Server Actions** for data fetching and mutations where it makes sense; use client components only for interactivity (the table, regenerate dialog, exports).
- **Store the Google access token in the JWT session** via Auth.js callbacks; pass it explicitly into Classroom/Drive helpers.
- **Use `googleapis` npm package only if you find raw fetch tedious** — for ~6 endpoints, raw fetch is lighter.
- **Test with a throwaway test course in Classroom** before pointing at real student data.
- **For Anthropic SDK**, use the latest version. Use the Messages API. PDFs and images go in `content` array as `{ type: 'document', source: { type: 'base64', media_type, data } }` and `{ type: 'image', source: { type: 'base64', media_type, data } }` respectively.
- **Don't over-abstract early.** Inline what's used once. Extract when used twice.
- **Keep the prompt template easy to find and edit** — `lib/anthropic/prompts.ts` is where most of the iteration will happen post-launch.
