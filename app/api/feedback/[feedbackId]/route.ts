import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

const Body = z.object({
  editedFeedback: z.string().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ feedbackId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { feedbackId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const row = await db.query.feedback.findFirst({
    where: eq(schema.feedback.id, feedbackId),
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const run = await db.query.runs.findFirst({
    where: eq(schema.runs.id, row.runId),
  });
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.status === "confirmed") {
    return NextResponse.json(
      { error: "run is confirmed and locked" },
      { status: 409 },
    );
  }

  const edited = parsed.data.editedFeedback;
  await db
    .update(schema.feedback)
    .set({
      editedFeedback: edited,
      status:
        edited == null
          ? row.aiFeedback
            ? "generated"
            : row.status
          : "edited",
    })
    .where(eq(schema.feedback.id, feedbackId));

  return NextResponse.json({ ok: true });
}
