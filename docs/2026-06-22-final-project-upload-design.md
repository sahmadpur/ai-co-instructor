# Final-project per-student PDF upload — design

**Date:** 2026-06-22
**Status:** approved, ready for implementation plan

## Problem

For final projects, students combine several files into a `.zip`/`.rar` archive and
upload the archive to Google Classroom. The current pipeline can't grade these: an
archive attachment is classified as unsupported and produces a "skipped" note instead
of real feedback.

The teacher wants to grade these the **same way as every other task** — same run page,
same student list, same edit/export flow — but with the ability to **upload files per
student** instead of relying on the (ungradeable) Classroom archive.

## Decisions (from brainstorming)

- **Manual, per-student upload.** The teacher pre-extracts the archive locally and
  uploads the loose files. The system never touches `.zip`/`.rar` (no archive library,
  and it sidesteps server-side RAR extraction entirely).
- **PDF only.** All uploaded files are PDFs (the teacher exports MS Office / Google
  Docs / XMind to PDF before uploading). No `.xmind`/docx/xlsx handling is needed.
- **Ephemeral — no storage.** Uploaded files are used once for generation and not
  persisted. To regenerate, the teacher re-uploads. This means **no new DB tables** and
  no blob storage.
- **Local grading only.** Grading is done via `npm run dev` (localhost), so there is no
  Vercel ~4.5 MB request-body cap to work around; files post directly to the server.
- **Scoped to final-project runs.** The behavior is gated to runs where the course
  ("group") name starts with `BA` **and** the assignment title *contains* `Yekun Layihə`
  (normalized: case-insensitive, whitespace-collapsed, schwa `ə` folded to `e`). A
  substring match so variants like `Yekun Layihə 2024`, `Final - Yekun Layihe`, or extra
  punctuation are still caught.

## Gating predicate

New `lib/final-project.ts`:

```ts
// Lowercase, fold the schwa (ə → e), and collapse all whitespace runs to a
// single space so spacing/case/diacritic variants normalize to one form.
function normalizeTitle(s: string): string {
  return s
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

const FINAL_PROJECT_TITLE = "yekun layihe"; // already normalized

export function isFinalProjectRun(
  courseName: string,
  assignmentTitle: string,
): boolean {
  const isBaGroup = courseName.trim().toLocaleUpperCase("az").startsWith("BA");
  const titleMatches = normalizeTitle(assignmentTitle).includes(FINAL_PROJECT_TITLE);
  return isBaGroup && titleMatches;
}
```

`courseName` and `assignmentTitle` are already stored on the `runs` row, so this single
pure predicate is the only source of truth. It is evaluated at run-create time (to skip
auto-generation) and on the run page (to choose the upload UI). No new data plumbing.

## Architecture

### 1. Run creation — skip auto-generation (`app/api/runs/route.ts`)

After inserting the per-student `feedback` rows:

- If `isFinalProjectRun(courseName, assignmentTitle)` → set the run status directly to
  `review` and **do not** fire the fire-and-forget kickoff to `/api/runs/[runId]/generate`.
  Rows with submissions stay `pending` ("waiting"); the teacher fills them by uploading.
- Otherwise → existing behavior unchanged (status `generating` + kickoff).

Rationale: auto-generating against zip attachments wastes API spend producing junk the
upload would immediately overwrite.

### 2. Shared generation core (`lib/generate.ts`)

Extract the shared tail of `generateForSubmission` into a reusable function so the upload
path can hand in pre-built blocks instead of fetching from Drive:

```
runFeedbackGeneration({ contentBlocks, taskDescription, feedbackFocus, model })
  ├─ buildFeedbackPrompt(...)               // system prompt
  ├─ empty-fallback + "Now write the feedback" framing
  └─ dispatch to runAnthropic | runOpenAI    // via getProvider(model)
```

- `generateForSubmission` (Drive path): unchanged behavior — builds blocks from Drive,
  then calls `runFeedbackGeneration`.
- Upload path: maps each uploaded PDF → `{ kind: "pdf", data: base64, filename }`, then
  calls the same `runFeedbackGeneration`.

`fetchDriveBlock` and the per-type converters are **not** touched — the upload path only
ever produces PDF document blocks, which the code already knows how to build.

### 3. Upload endpoint — `POST /api/feedback/[feedbackId]/upload`

`multipart/form-data`, `export const maxDuration = 300`.

1. Auth + ownership check (reuse `getOwnerUserIds`).
2. Load the row + its run. Reject (`409`) if the run is `confirmed` (locked). Reject
   (`400`) if the run is not a final-project run (defensive — the UI only exposes upload
   there).
3. Read uploaded files. **Validate each is a PDF** (mime `application/pdf` or `.pdf`
   extension); reject non-PDFs with a clear message naming the rejected files. Enforce the
   existing 32 MB-per-file cap (`MAX_FILE_BYTES`). Require at least one file.
4. Optional `additionalInstructions` field, folded into `feedbackFocus` exactly like the
   regenerate route. Optional `model` field, validated against `AVAILABLE_MODELS`,
   defaulting to the row's current model.
5. Map PDFs → document blocks → `runFeedbackGeneration`.
6. Write the result to the row using the **same `aiFeedback` / `editedFeedback`
   immutability rule as the regenerate route**: `failed` or never-generated rows overwrite
   `aiFeedback` (status `generated`); otherwise the new text goes to `editedFeedback`
   (status `edited`), preserving the original `aiFeedback`. Set `generatedAt`.
7. Insert an `apiLogs` row (model, tokens, `costUsd`).
8. Update `submissionPreview` to the uploaded filenames (e.g. `report.pdf, appendix.pdf`)
   so the table reflects what was actually graded instead of the unusable zip.

### 4. Upload dialog — `components/upload-dialog.tsx`

A near-twin of `RegenerateDialog`:

- **Trigger:** an `upload` button in the row actions cell, disabled when `locked || isBusy`.
- **Body:** a PDF multi-file picker (`accept=".pdf,application/pdf"`, `multiple`, shows
  chosen filenames, requires ≥1 file); the same optional "additional instructions"
  textarea; the same model picker (`MODELS_BY_PROVIDER`), defaulting to the row's model.
  **No cost estimate** — there are no prior token counts for a fresh upload.
- **Submit:** mirrors regenerate exactly — optimistically flip the row to `generating` via
  `onStarted`, close, toast, then POST `FormData` in the background (no `Content-Type`
  header so the browser sets the multipart boundary). The existing `feedback-table` polling
  picks up the written result. Errors surface via `toast.error`.

### 5. Run page wiring

The run page (`app/(app)/runs/[runId]/page.tsx` → `feedback-table` → `feedback-row`) passes
an `isFinalProject` flag derived from `isFinalProjectRun(run.courseName, run.assignmentTitle)`.
When true, `feedback-row` renders `<UploadDialog>` **in place of** `<RegenerateDialog>` —
re-uploading *is* the rewrite for these rows, since their content comes from uploaded PDFs,
not Drive. Everything else — student list, inline editing, status pills, reset-to-ai,
export — is identical to other tasks.

## Out of scope (YAGNI)

- Archive (`.zip`/`.rar`) extraction, server- or client-side.
- `.xmind`, `.docx`, `.xlsx`, image handling on the upload path (PDF only).
- Persisting uploaded files / regenerate-without-re-upload.
- Bulk multi-student upload (folder with per-student subfolders).
- A Vercel-hosted upload path (4.5 MB body-cap workaround) — grading is local-only.

## Affected files

| File | Change |
|---|---|
| `lib/final-project.ts` | **new** — `isFinalProjectRun` predicate |
| `lib/generate.ts` | extract `runFeedbackGeneration`; reuse it in `generateForSubmission` |
| `app/api/runs/route.ts` | skip generation kickoff for final-project runs (status → `review`) |
| `app/api/feedback/[feedbackId]/upload/route.ts` | **new** — multipart PDF upload + generate |
| `components/upload-dialog.tsx` | **new** — per-row PDF upload dialog |
| `components/feedback-row.tsx` | render `UploadDialog` vs `RegenerateDialog` by `isFinalProject` |
| `app/(app)/runs/[runId]/page.tsx` + `components/feedback-table.tsx` | thread `isFinalProject` flag |