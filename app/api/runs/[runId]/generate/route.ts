import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { listSubmissions } from "@/lib/google/classroom";
import { classifySubmission } from "@/lib/google/submissions";
import { generateForSubmission } from "@/lib/generate";
import { costUsd } from "@/lib/anthropic/cost";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = session.accessToken;
  const { runId } = await ctx.params;

  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), eq(schema.runs.userId, session.user.id)),
  });
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.status === "confirmed") {
    return NextResponse.json({ ok: true, skipped: "confirmed" });
  }

  await db
    .update(schema.runs)
    .set({ status: "generating" })
    .where(eq(schema.runs.id, runId));

  const submissions = await listSubmissions(
    token,
    run.courseId,
    run.assignmentId,
  );
  const submissionsBySubId = new Map(submissions.map((s) => [s.id, s]));

  const pendingRows = await db.query.feedback.findMany({
    where: and(
      eq(schema.feedback.runId, runId),
      eq(schema.feedback.status, "pending"),
    ),
  });

  const limit = pLimit(5);
  await Promise.all(
    pendingRows.map((row) =>
      limit(() => processRow({ row, run, token, submissionsBySubId })),
    ),
  );

  await db
    .update(schema.runs)
    .set({ status: "review" })
    .where(eq(schema.runs.id, runId));

  return NextResponse.json({ ok: true });
}

async function processRow({
  row,
  run,
  token,
  submissionsBySubId,
}: {
  row: typeof schema.feedback.$inferSelect;
  run: typeof schema.runs.$inferSelect;
  token: string;
  submissionsBySubId: Map<
    string,
    Awaited<ReturnType<typeof listSubmissions>>[number]
  >;
}) {
  await db
    .update(schema.feedback)
    .set({ status: "generating", errorMessage: null })
    .where(eq(schema.feedback.id, row.id));

  try {
    const sub = row.submissionId
      ? submissionsBySubId.get(row.submissionId)
      : undefined;
    const classified = sub
      ? classifySubmission(sub)
      : {
          submissionType: "none" as const,
          submissionPreview: "(missing)",
          driveFileIds: [],
          notes: [],
          shortAnswerText: undefined,
        };

    const result = await generateForSubmission({
      taskDescription: run.taskDescription ?? run.assignmentTitle,
      feedbackFocus: run.feedbackFocus ?? undefined,
      shortAnswerText: classified.shortAnswerText,
      driveFileIds: classified.driveFileIds,
      notes: classified.notes,
      googleAccessToken: token,
      model: run.model,
    });

    const cost = costUsd(result.inputTokens, result.outputTokens, result.model);
    const now = new Date();

    await db
      .update(schema.feedback)
      .set({
        aiFeedback: result.feedback,
        status: "generated",
        model: result.model,
        generatedAt: now,
        errorMessage: null,
      })
      .where(eq(schema.feedback.id, row.id));

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
  } catch (err) {
    console.error("generation failed", row.id, err);
    await db
      .update(schema.feedback)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(schema.feedback.id, row.id));
  }
}
