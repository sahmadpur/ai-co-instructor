import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, sum, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getOwnerUserIds } from "@/lib/owner";
import { latestUsageByFeedback } from "@/lib/db/usage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await ctx.params;
  const ownerIds = await getOwnerUserIds(session);

  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), inArray(schema.runs.userId, ownerIds)),
  });
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const feedback = await db.query.feedback.findMany({
    where: eq(schema.feedback.runId, runId),
    orderBy: (f, { asc }) => [asc(f.studentName)],
  });
  const costRow = await db
    .select({ total: sum(schema.apiLogs.costUsd) })
    .from(schema.apiLogs)
    .where(eq(schema.apiLogs.runId, runId));
  const totalCostUsd = Number(costRow[0]?.total ?? 0);

  const usage = await latestUsageByFeedback(runId);
  const enrichedFeedback = feedback.map((f) => {
    const u = usage.get(f.id);
    return {
      ...f,
      lastInputTokens: u?.inputTokens ?? null,
      lastOutputTokens: u?.outputTokens ?? null,
    };
  });

  return NextResponse.json({ run, feedback: enrichedFeedback, totalCostUsd });
}

const PatchBody = z.object({ action: z.literal("confirm") });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const ownerIds = await getOwnerUserIds(session);
  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), inArray(schema.runs.userId, ownerIds)),
  });
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.status === "confirmed") {
    return NextResponse.json({ ok: true });
  }
  await db
    .update(schema.runs)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(schema.runs.id, runId));
  return NextResponse.json({ ok: true });
}
