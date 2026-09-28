# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI Co-Instructor (package name `classroom-feedback`) is a single-teacher web app: it pulls a Google
Classroom assignment's student submissions, asks an LLM to draft per-student feedback, lets the
teacher edit / regenerate / confirm, then exports to Excel / CSV / HTML / PDF. `REQUIREMENTS.md` holds
the full spec. Feedback is written **in Azerbaijani** by design (see the prompt).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (run before claiming work complete) |
| `npm run db:generate` | Generate Drizzle SQL migrations from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the DB (`local.db` locally) |

There is no test suite. Verify changes via `npm run lint`, `npm run build`, and manual testing.
Running locally requires Google OAuth + an LLM API key in `.env.local` (see `.env.local.example`).

## Architecture

### Request → feedback flow
1. **Create run** (`POST /api/runs`) — lists submissions + student profiles from Classroom, inserts a
   `runs` row plus one `feedback` row per student, then **fire-and-forget** kicks off the generation
   route (forwarding the auth cookie). Returns `202` immediately.
2. **Generate** (`POST /api/runs/[runId]/generate`) — sets run `generating`, processes all `pending`
   feedback rows with `p-limit(5)` concurrency, then sets run `review`. Per row it classifies the
   submission, calls the model, writes `aiFeedback`, and logs token usage + cost to `apiLogs`.
3. **Edit / regenerate** (`app/api/feedback/[feedbackId]/...`) — regenerate runs synchronously inside
   the request (single row is fast) and supports per-row `additionalInstructions` + model override.
4. **Confirm + export** (`app/api/export/[runId]/[format]`) — PDF export reuses the HTML export with
   `?print=1` and triggers the browser print dialog.

### Multi-provider LLM abstraction
The app supports both Anthropic and OpenAI models, selected per run/row.
- `lib/generate.ts` is the provider-agnostic core: it fetches + **normalizes** every input (short
  answer text, Drive attachments, notes) into `NormalizedBlock`s (`text` / `pdf` / `image`), builds the
  system prompt, then dispatches to `runAnthropic` or `runOpenAI` based on `getProvider(model)`.
- `lib/anthropic/generate.ts` and `lib/openai/generate.ts` each translate `NormalizedBlock[]` into that
  SDK's content format. OpenAI uses the Responses API; reasoning models (`o*`, `gpt-5*`, `gpt-6*`) get a larger
  `max_output_tokens` and `reasoning.effort: low`.
- **`lib/anthropic/cost.ts` is the pricing table** despite its path — `PRICING_PER_MTOK` (both
  providers), `DEFAULT_MODEL`, `getProvider()`, `costUsd()`. Reprice or label models here.
- **`lib/models.ts` builds the live catalogue**: it calls each provider's `models.list()`, filters to
  text/PDF-capable chat models, decorates with pricing, and caches in memory for 1h. If a provider call
  fails, that provider falls back to the static table. `GET /api/models` serves it; the client hook
  `lib/use-models.ts` + `components/model-select.tsx` render every dropdown. API routes validate a
  submitted model with `isAllowedModel()` — never `z.enum` over a static list.
- Anthropic runner uses the catalogue's `capabilities.effort` (fallback: id regex) to send
  `output_config.effort: "low"` with a 4096 `max_tokens` ceiling on adaptive-thinking models.

### Drive attachment handling (`lib/generate.ts` → `fetchDriveBlock`)
Each attachment type is converted: Google Doc → exported PDF (document block); PDF → document block;
Google Sheet / xlsx → per-sheet CSV text (SheetJS); docx → text (mammoth); HTML → text (cheerio);
`.sql`/`.r`/`.rmd`/plain → text; images → image block. Cap is 32MB (`MAX_FILE_BYTES`); text is truncated
at 60k chars. Unsupported types produce a "skipped" note instead of failing the row.

### The feedback prompt
`lib/anthropic/prompts.ts` (`buildFeedbackPrompt`) is the single iteration point for tone/structure. It
is domain-specific: Business/Data Analysis grading, output **in Azerbaijani** with two fixed headings,
deliberately critical (no praise), 150–250 words, formal "siz" form. Small wording changes here have
large effects — change it deliberately.

### Auth & data ownership
- Auth.js v5 (`lib/auth.ts`), Google provider, **JWT session strategy**. Requests Classroom + Drive
  readonly scopes; manually refreshes the Google access token in the `jwt` callback and exposes it as
  `session.accessToken`. On refresh failure it sets `session.error = "RefreshTokenError"`.
- **`proxy.ts` is the route middleware** (Next.js 16 renames `middleware` → `proxy`). It gates every
  non-public path behind a login redirect.
- **Ownership is resolved by email, not just user id.** JWT `sub` can drift across sign-ins, so a Google
  account may own records under several `users.id` values. `getOwnerUserIds(session)` (`lib/owner.ts`)
  returns all ids sharing the session email; auth checks use `inArray(runs.userId, ownerIds)`. Run
  creation reuses the first existing user record for the email. Preserve this pattern in any new
  ownership check — never gate on `session.user.id` alone.

### Database
Drizzle ORM over **libSQL** (`@libsql/client`, `drizzle-orm/libsql`). One client serves both local
SQLite (`file:./local.db`) and hosted Turso (`libsql://…`); `drizzle.config.ts` uses the `turso`
dialect. Tables (`lib/db/schema.ts`): `users`, `runs`, `feedback`, `apiLogs`. Timestamps are
`integer` epoch columns (`mode: "timestamp"`).

## Conventions & gotchas

- **Display rule:** `aiFeedback` is the immutable original model output; teacher edits go to
  `editedFeedback`. The UI shows `editedFeedback ?? aiFeedback`. On regenerate, if a row was already
  generated/edited the new text goes to `editedFeedback` (not overwriting `aiFeedback`); only `failed`
  or never-generated rows overwrite `aiFeedback`.
- **Status vocabularies are split:** DB enums (`runs.status`: draft/generating/review/confirmed;
  `feedback.status`: pending/generating/generated/edited/failed) are mapped to user-facing labels in
  `lib/status-labels.ts`. Keep DB enums and label maps in sync.
- Generation routes set `export const maxDuration = 300`.
- A `confirmed` run is locked — generation/regeneration short-circuits.
- The README's stack section is slightly stale (says better-sqlite3 / Anthropic-only); the code uses
  libSQL and is multi-provider. Trust the code.
- Path alias `@/*` → repo root (`tsconfig.json`).
