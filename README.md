# AI Co-Instructor (`classroom-feedback`)

Single-teacher web app that pulls a Google Classroom assignment's submissions,
asks Claude to draft per-student feedback, lets the teacher edit/regenerate/
confirm, and exports to Excel / CSV / HTML / PDF.

See [`REQUIREMENTS.md`](./REQUIREMENTS.md) for the full spec.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Auth.js v5 (Google) ·
Drizzle ORM + better-sqlite3 · Anthropic SDK (`claude-sonnet-4-6`) ·
shadcn/ui (on base-ui) · Tailwind v4 · SheetJS · papaparse.

## Setup

1. **Google Cloud Console**
   - Create project, enable **Google Classroom API** + **Google Drive API**.
   - Configure OAuth consent screen → External, status Testing.
     Add yourself as a test user.
   - Create OAuth 2.0 Web client. Authorized redirect URI:
     `http://localhost:3000/api/auth/callback/google`.
   - Copy the client ID + secret.

2. **Anthropic Console**
   - Create an API key at <https://console.anthropic.com>.

3. **Local env**
   ```bash
   cp .env.local.example .env.local
   # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY
   # AUTH_SECRET is pre-populated by `openssl rand -base64 32` if you used
   # the bootstrapper; otherwise generate one yourself.
   ```

4. **Install + DB**
   ```bash
   npm install
   npm run db:migrate
   ```

5. **Run**
   ```bash
   npm run dev
   # http://localhost:3000
   ```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server on :3000 |
| `npm run build` | Production build |
| `npm run db:generate` | Re-generate Drizzle SQL from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `local.db` |
| `npm run lint` | ESLint |

## Where things live

| Concern | Path |
|---|---|
| Auth (Google + JWT + refresh) | `lib/auth.ts` |
| Classroom REST helpers | `lib/google/classroom.ts` |
| Drive REST helpers | `lib/google/drive.ts` |
| Submission classification | `lib/google/submissions.ts` |
| Anthropic client + cost | `lib/anthropic/{client,cost}.ts` |
| **Feedback prompt (iterate here)** | `lib/anthropic/prompts.ts` |
| Generation pipeline | `lib/anthropic/generate.ts` |
| Drizzle schema + client | `lib/db/{schema,index}.ts` |
| Run create / batch generate | `app/api/runs/...` |
| Edit + regenerate | `app/api/feedback/...` |
| Export Excel/CSV/HTML/PDF | `app/api/export/[runId]/[format]/route.ts` |
| Pages | `app/(app)/...` |

## Notes

- Concurrency for AI calls is capped at 5 (`p-limit`) per run.
- `aiFeedback` is preserved for the original Claude output; teacher edits go to
  `editedFeedback`. UI shows `editedFeedback ?? aiFeedback`.
- Drive attachments are sent inline as base64. Cap is 32MB per file.
- Supported attachment types:
  - **Google Doc** → exported as PDF, sent as document block
  - **PDF** → sent as document block
  - **Google Sheet** → exported as xlsx, then per-sheet CSV is sent as text
  - **xlsx** → SheetJS converts each sheet to CSV, sent as text
  - **docx** → mammoth extracts plain text, sent as text
  - **Images** (PNG/JPEG/WEBP/GIF) → sent as image block
  - Other types get a "skipped — unsupported" note.
- The PDF export reuses the HTML export with `?print=1` and triggers the
  browser print dialog.
