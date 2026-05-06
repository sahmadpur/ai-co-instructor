import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getOwnerUserIds } from "@/lib/owner";
import { listSubmissions } from "@/lib/google/classroom";
import { classifySubmission } from "@/lib/google/submissions";
import { generateForSubmission } from "@/lib/generate";
import { AVAILABLE_MODELS, costUsd } from "@/lib/anthropic/cost";

export const maxDuration = 300;

const Body = z.object({
  additionalInstructions: z.string().optional(),
  model: z.enum(AVAILABLE_MODELS as unknown as [string, ...string[]]).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ feedbackId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = session.accessToken;
  const { feedbackId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const additional = parsed.data.additionalInstructions?.trim();

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

  await db
    .update(schema.feedback)
    .set({ status: "generating", errorMessage: null })
    .where(eq(schema.feedback.id, feedbackId));

  // Process synchronously inside the request — single row regenerate is quick.
  try {
    const submissions = row.submissionId
      ? await listSubmissions(token, run.courseId, run.assignmentId)
      : [];
    const sub = submissions.find((s) => s.id === row.submissionId);
    const classified = sub
      ? classifySubmission(sub)
      : {
          submissionType: row.submissionType,
          submissionPreview: row.submissionPreview ?? "(missing)",
          driveFileIds: [],
          notes: [],
          shortAnswerText: undefined,
        };

    const focusWithExtra = [
      run.feedbackFocus ?? undefined,
      additional ? `Additional instructions for this student: ${additional}` : undefined,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await generateForSubmission({
      taskDescription: run.taskDescription ?? run.assignmentTitle,
      feedbackFocus: focusWithExtra || undefined,
      shortAnswerText: classified.shortAnswerText,
      driveFileIds: classified.driveFileIds,
      notes: classified.notes,
      googleAccessToken: token,
      model: parsed.data.model ?? row.model,
    });

    const cost = costUsd(result.inputTokens, result.outputTokens, result.model);
    const now = new Date();

    // Per the doc's immutability rule for aiFeedback:
    // - if the prior status was 'failed', we may overwrite aiFeedback
    // - otherwise, write only if there was no aiFeedback yet, AND don't blow away an edit
    const shouldOverwriteAi =
      row.status === "failed" || row.aiFeedback == null;

    await db
      .update(schema.feedback)
      .set({
        aiFeedback: shouldOverwriteAi ? result.feedback : row.aiFeedback,
        editedFeedback: shouldOverwriteAi ? null : result.feedback,
        status: shouldOverwriteAi ? "generated" : "edited",
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
    console.error("regenerate failed", feedbackId, err);
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
