import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getOwnerUserIds } from "@/lib/owner";
import { isFinalProjectRun } from "@/lib/final-project";
import { runFeedbackGeneration, type NormalizedBlock } from "@/lib/generate";
import { costUsd } from "@/lib/anthropic/cost";
import { isAllowedModel } from "@/lib/models";
import { MAX_FILE_BYTES } from "@/lib/google/drive";

export const maxDuration = 300;

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ feedbackId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { feedbackId } = await ctx.params;

  const row = await db.query.feedback.findFirst({
    where: eq(schema.feedback.id, feedbackId),
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const run = await db.query.runs.findFirst({
    where: eq(schema.runs.id, row.runId),
  });
  const ownerIds = await getOwnerUserIds(session);
  if (!run || !ownerIds.includes(run.userId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.status === "confirmed") {
    return NextResponse.json({ error: "run is locked" }, { status: 409 });
  }
  if (!isFinalProjectRun(run.courseName, run.assignmentTitle)) {
    return NextResponse.json(
      { error: "upload is only available for final-project runs" },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files uploaded" }, { status: 400 });
  }

  const nonPdf = files.filter((f) => !isPdf(f));
  if (nonPdf.length > 0) {
    return NextResponse.json(
      {
        error: `only PDF files are supported. Rejected: ${nonPdf
          .map((f) => f.name)
          .join(", ")}`,
      },
      { status: 400 },
    );
  }

  const tooLarge = files.filter((f) => f.size > MAX_FILE_BYTES);
  if (tooLarge.length > 0) {
    return NextResponse.json(
      {
        error: `file exceeds the 32MB limit: ${tooLarge
          .map((f) => f.name)
          .join(", ")}`,
      },
      { status: 400 },
    );
  }

  const rawModel = form.get("model");
  const model =
    typeof rawModel === "string" && (await isAllowedModel(rawModel))
      ? rawModel
      : row.model;

  const rawInstructions = form.get("additionalInstructions");
  const additional =
    typeof rawInstructions === "string" ? rawInstructions.trim() : "";

  const focusWithExtra = [
    run.feedbackFocus ?? undefined,
    additional ? `Additional instructions for this student: ${additional}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  await db
    .update(schema.feedback)
    .set({ status: "generating", errorMessage: null })
    .where(eq(schema.feedback.id, feedbackId));

  try {
    const contentBlocks: NormalizedBlock[] = await Promise.all(
      files.map(async (f) => {
        const data = Buffer.from(await f.arrayBuffer()).toString("base64");
        return { kind: "pdf", data, filename: f.name } as const;
      }),
    );

    const result = await runFeedbackGeneration({
      contentBlocks,
      taskDescription: run.taskDescription ?? run.assignmentTitle,
      feedbackFocus: focusWithExtra || undefined,
      model,
    });

    const cost = costUsd(result.inputTokens, result.outputTokens, result.model);
    const now = new Date();

    // Same immutability rule as regenerate: keep aiFeedback as the original
    // model output. A failed or never-generated row may overwrite aiFeedback;
    // otherwise the new text lands in editedFeedback so prior edits aren't lost.
    const shouldOverwriteAi = row.status === "failed" || row.aiFeedback == null;
    const filenames = files.map((f) => f.name).join(", ");

    await db
      .update(schema.feedback)
      .set({
        aiFeedback: shouldOverwriteAi ? result.feedback : row.aiFeedback,
        editedFeedback: shouldOverwriteAi ? null : result.feedback,
        status: shouldOverwriteAi ? "generated" : "edited",
        submissionType: "pdf",
        submissionPreview: filenames,
        model: result.model,
        generatedAt: now,
        errorMessage: null,
      })
      .where(eq(schema.feedback.id, feedbackId));

    await db.insert(schema.apiLogs).values({
      id: uuid(),
      runId: run.id,
      feedbackId: row.id,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: cost,
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("upload generation failed", feedbackId, err);
    await db
      .update(schema.feedback)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(schema.feedback.id, feedbackId));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 },
    );
  }
}
