import { NextResponse } from "next/server";
import { z } from "zod";
import pLimit from "p-limit";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import {
  getUserProfile,
  listSubmissions,
} from "@/lib/google/classroom";
import { classifySubmission } from "@/lib/google/submissions";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/anthropic/cost";

const Body = z.object({
  courseId: z.string().min(1),
  courseName: z.string().min(1),
  courseWorkId: z.string().min(1),
  assignmentTitle: z.string().min(1),
  taskDescription: z.string().optional(),
  feedbackFocus: z.string().optional(),
  model: z.enum(AVAILABLE_MODELS as unknown as [string, ...string[]]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const token = session.accessToken;
  const email = session.user.email ?? "unknown";
  const name = session.user.name ?? "unknown";
  const image = session.user.image ?? null;
  const now = new Date();

  // Reuse the first user record for this email so runs stay attached to a
  // single user.id even if the JWT sub drifts across sign-ins.
  const existingByEmail = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  const userId = existingByEmail?.id ?? session.user.id;

  await db
    .insert(schema.users)
    .values({ id: userId, email, name, image, createdAt: now })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { email, name, image },
    });

  const runId = uuid();
  await db.insert(schema.runs).values({
    id: runId,
    userId,
    courseId: body.courseId,
    courseName: body.courseName,
    assignmentId: body.courseWorkId,
    assignmentTitle: body.assignmentTitle,
    taskDescription: body.taskDescription ?? null,
    feedbackFocus: body.feedbackFocus ?? null,
    status: "draft",
    model: body.model ?? DEFAULT_MODEL,
    createdAt: now,
  });

  let submissions;
  try {
    submissions = await listSubmissions(token, body.courseId, body.courseWorkId);
  } catch (err) {
    await db
      .update(schema.runs)
      .set({ status: "review" })
      .where(eq(schema.runs.id, runId));
    return NextResponse.json(
      {
        error: "failed to list submissions",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const profileLimit = pLimit(8);
  const profiles = await Promise.all(
    submissions.map((sub) =>
      profileLimit(async () => {
        try {
          const p = await getUserProfile(token, sub.userId);
          return {
            sub,
            name: p.name.fullName ?? "Unknown student",
            email: p.emailAddress ?? null,
          };
        } catch (err) {
          console.error("getUserProfile failed", sub.userId, err);
          return {
            sub,
            name: `Student ${sub.userId.slice(0, 6)}`,
            email: null,
          };
        }
      }),
    ),
  );

  const feedbackRows = profiles.map(({ sub, name, email }) => {
    const classified = classifySubmission(sub);
    return {
      id: uuid(),
      runId,
      studentId: sub.userId,
      studentName: name,
      studentEmail: email,
      submissionId: sub.id,
      submissionType: classified.submissionType,
      submissionPreview: classified.submissionPreview,
      aiFeedback: null,
      editedFeedback: null,
      status:
        classified.submissionType === "none"
          ? ("generated" as const)
          : ("pending" as const),
      errorMessage:
        classified.submissionType === "none"
          ? "no submission to grade"
          : null,
      generatedAt: null,
    };
  });

  if (feedbackRows.length > 0) {
    await db.insert(schema.feedback).values(feedbackRows);
  }

  await db
    .update(schema.runs)
    .set({ status: "generating" })
    .where(eq(schema.runs.id, runId));

  // Fire-and-forget kickoff to the generation route (M3 will implement work).
  const origin = new URL(req.url).origin;
  void fetch(`${origin}/api/runs/${runId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
    },
  }).catch((err) => {
    console.error("generation kickoff failed", err);
  });

  return NextResponse.json({ runId }, { status: 202 });
}
