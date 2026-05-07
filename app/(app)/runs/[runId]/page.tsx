import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, sum, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getOwnerUserIds } from "@/lib/owner";
import {
  FeedbackTable,
  type RunPayload,
} from "@/components/feedback-table";
import type { FeedbackRowData } from "@/components/feedback-row";
import { RUN_STATUS_LABEL, type RunStatus } from "@/lib/status-labels";
import { latestUsageByFeedback } from "@/lib/db/usage";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const { runId } = await params;
  const ownerIds = await getOwnerUserIds(session);

  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), inArray(schema.runs.userId, ownerIds)),
  });
  if (!run) notFound();

  const feedbackRows = await db.query.feedback.findMany({
    where: eq(schema.feedback.runId, runId),
    orderBy: (f, { asc }) => [asc(f.studentName)],
  });

  const costRow = await db
    .select({ total: sum(schema.apiLogs.costUsd) })
    .from(schema.apiLogs)
    .where(eq(schema.apiLogs.runId, runId));
  const totalCostUsd = Number(costRow[0]?.total ?? 0);

  const initialRun: RunPayload = {
    id: run.id,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    confirmedAt: run.confirmedAt ? run.confirmedAt.toISOString() : null,
    courseName: run.courseName,
    assignmentTitle: run.assignmentTitle,
  };

  const usage = await latestUsageByFeedback(runId);
  const initialFeedback: FeedbackRowData[] = feedbackRows.map((r) => {
    const u = usage.get(r.id);
    return {
      id: r.id,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      submissionType: r.submissionType,
      submissionPreview: r.submissionPreview,
      aiFeedback: r.aiFeedback,
      editedFeedback: r.editedFeedback,
      status: r.status,
      errorMessage: r.errorMessage,
      model: r.model,
      lastInputTokens: u?.inputTokens ?? null,
      lastOutputTokens: u?.outputTokens ?? null,
    };
  });

  const statusLabel = RUN_STATUS_LABEL[run.status as RunStatus] ?? run.status;
  const isConfirmed = run.status === "confirmed";

  return (
    <div className="space-y-10">
      <nav aria-label="breadcrumb" className="anim-fade flex flex-wrap items-center gap-2 font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55">
        <Link href="/" className="hover:text-foreground">groups</Link>
        <span className="font-display text-base italic text-foreground/35">/</span>
        <Link href={`/courses/${run.courseId}`} className="hover:text-foreground truncate max-w-[16rem]">
          {run.courseName}
        </Link>
        <span className="font-display text-base italic text-foreground/35">/</span>
        <span className="text-foreground">run</span>
      </nav>

      <header className="anim-fade-up grid gap-8 border-b border-rule-strong/60 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="tracking-eyebrow text-foreground/55">a run from</span>
            <span className="font-display italic text-foreground/65">
              {run.courseName}
            </span>
          </div>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05] tracking-tight">
            {run.assignmentTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55">
            <span>
              opened&nbsp;
              {run.createdAt.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            <span aria-hidden>·</span>
            <span>{feedbackRows.length} students</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <span className="tracking-eyebrow text-foreground/55">status</span>
          <span
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono-num text-[0.7rem] uppercase tracking-[0.2em]",
              isConfirmed
                ? "border-foreground/80 bg-foreground text-background"
                : run.status === "generating"
                ? "border-marker/50 bg-marker/10 text-marker"
                : "border-rule-strong text-foreground/75",
            ].join(" ")}
          >
            {run.status === "generating" ? (
              <span className="anim-nib block h-1.5 w-1.5 rounded-full bg-marker" />
            ) : null}
            {statusLabel}
          </span>
        </div>
      </header>

      <FeedbackTable
        initialRun={initialRun}
        initialFeedback={initialFeedback}
        initialTotalCostUsd={totalCostUsd}
      />
    </div>
  );
}
