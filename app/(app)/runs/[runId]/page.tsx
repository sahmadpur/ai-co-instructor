import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, sum } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  FeedbackTable,
  type RunPayload,
} from "@/components/feedback-table";
import type { FeedbackRowData } from "@/components/feedback-row";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const { runId } = await params;

  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), eq(schema.runs.userId, session.user.id)),
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

  const initialFeedback: FeedbackRowData[] = feedbackRows.map((r) => ({
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
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Courses</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/courses/${run.courseId}`} />}>
              {run.courseName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{run.assignmentTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {run.assignmentTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {run.courseName} · run created{" "}
          {run.createdAt.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · status {run.status}
        </p>
      </div>

      <FeedbackTable
        initialRun={initialRun}
        initialFeedback={initialFeedback}
        initialTotalCostUsd={totalCostUsd}
      />
    </div>
  );
}
