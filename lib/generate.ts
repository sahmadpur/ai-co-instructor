import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { buildFeedbackPrompt } from "@/lib/anthropic/prompts";
import { getProvider } from "@/lib/anthropic/cost";
import { runAnthropic } from "@/lib/anthropic/generate";
import { runOpenAI } from "@/lib/openai/generate";
import {
  downloadFile,
  exportDriveFile,
  getFileMetadata,
  inferImageMediaType,
  MAX_FILE_BYTES,
} from "@/lib/google/drive";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const MAX_TEXT_CHARS = 60_000;

export type NormalizedBlock =
  | { kind: "text"; text: string }
  | { kind: "pdf"; data: string; filename: string }
  | { kind: "image"; mediaType: string; data: string };

export interface GenerateInput {
  taskDescription: string;
  feedbackFocus?: string;
  shortAnswerText?: string;
  driveFileIds: string[];
  notes: string[];
  googleAccessToken: string;
  model?: string;
}

export interface GenerateResult {
  feedback: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface RunnerArgs {
  blocks: NormalizedBlock[];
  systemPrompt: string;
  model: string;
}

export async function generateForSubmission(
  input: GenerateInput,
): Promise<GenerateResult> {
  const model = input.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const systemPrompt = buildFeedbackPrompt({
    taskDescription: input.taskDescription,
    feedbackFocus: input.feedbackFocus,
  });

  const blocks: NormalizedBlock[] = [];

  if (input.shortAnswerText && input.shortAnswerText.trim().length > 0) {
    blocks.push({
      kind: "text",
      text: `Student's text submission:\n\n${input.shortAnswerText}`,
    });
  }

  for (const fileId of input.driveFileIds) {
    const block = await fetchDriveBlock(input.googleAccessToken, fileId);
    if (block) blocks.push(block);
  }

  if (input.notes.length > 0) {
    blocks.push({
      kind: "text",
      text: `Additional notes about this submission:\n${input.notes
        .map((n) => `- ${n}`)
        .join("\n")}`,
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      kind: "text",
      text: "(The student's submission is empty or could not be loaded.)",
    });
  }

  blocks.push({
    kind: "text",
    text: "Now write the feedback for this submission.",
  });

  const provider = getProvider(model);
  const runner = provider === "openai" ? runOpenAI : runAnthropic;
  return runner({ blocks, systemPrompt, model });
}

async function fetchDriveBlock(
  token: string,
  fileId: string,
): Promise<NormalizedBlock | null> {
  let meta;
  try {
    meta = await getFileMetadata(token, fileId);
  } catch (err) {
    return {
      kind: "text",
      text: `(Could not load Drive file ${fileId}: ${
        err instanceof Error ? err.message : String(err)
      })`,
    };
  }

  const size = meta.size ? Number(meta.size) : 0;
  if (size > MAX_FILE_BYTES) {
    return {
      kind: "text",
      text: `(Skipping "${meta.name}" — file is ${(size / 1_048_576).toFixed(
        1,
      )}MB which exceeds the 32MB limit.)`,
    };
  }

  if (meta.mimeType === GOOGLE_DOC_MIME) {
    const buf = await exportDriveFile(token, fileId, "application/pdf");
    return pdfBlock(buf, meta.name);
  }

  if (meta.mimeType === "application/pdf") {
    const buf = await downloadFile(token, fileId);
    return pdfBlock(buf, meta.name);
  }

  if (meta.mimeType === DOCX_MIME) {
    const buf = await downloadFile(token, fileId);
    return docxToTextBlock(buf, meta.name);
  }

  if (meta.mimeType === XLSX_MIME) {
    const buf = await downloadFile(token, fileId);
    return xlsxToTextBlock(buf, meta.name);
  }

  if (meta.mimeType === GOOGLE_SHEET_MIME) {
    const buf = await exportDriveFile(token, fileId, XLSX_MIME);
    return xlsxToTextBlock(buf, meta.name);
  }

  const imageMediaType = inferImageMediaType(meta.mimeType);
  if (imageMediaType) {
    const buf = await downloadFile(token, fileId);
    return {
      kind: "image",
      mediaType: imageMediaType,
      data: buf.toString("base64"),
    };
  }

  return {
    kind: "text",
    text: `(Skipping "${meta.name}" — unsupported file type ${meta.mimeType}.)`,
  };
}

function pdfBlock(buf: Buffer, filename: string): NormalizedBlock {
  return {
    kind: "pdf",
    data: buf.toString("base64"),
    filename,
  };
}

async function docxToTextBlock(
  buf: Buffer,
  filename: string,
): Promise<NormalizedBlock> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const text = truncate(value.trim());
    if (!text) {
      return {
        kind: "text",
        text: `(File "${filename}" appears to be empty.)`,
      };
    }
    return {
      kind: "text",
      text: `Student's submission "${filename}" (Word document, text extracted):\n\n${text}`,
    };
  } catch (err) {
    return {
      kind: "text",
      text: `(Could not parse "${filename}" as docx: ${
        err instanceof Error ? err.message : String(err)
      })`,
    };
  }
}

function xlsxToTextBlock(buf: Buffer, filename: string): NormalizedBlock {
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sections: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim().length === 0) continue;
      sections.push(`## Sheet: ${sheetName}\n${csv}`);
    }
    const joined = sections.join("\n\n");
    if (!joined) {
      return {
        kind: "text",
        text: `(Spreadsheet "${filename}" has no readable cells.)`,
      };
    }
    return {
      kind: "text",
      text: `Student's submission "${filename}" (spreadsheet, exported as CSV per sheet):\n\n${truncate(
        joined,
      )}`,
    };
  } catch (err) {
    return {
      kind: "text",
      text: `(Could not parse "${filename}" as spreadsheet: ${
        err instanceof Error ? err.message : String(err)
      })`,
    };
  }
}

function truncate(s: string): string {
  if (s.length <= MAX_TEXT_CHARS) return s;
  return `${s.slice(0, MAX_TEXT_CHARS)}\n\n[…truncated, original was ${s.length} characters]`;
}
