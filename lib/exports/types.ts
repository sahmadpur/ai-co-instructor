import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface ExportData {
  run: typeof schema.runs.$inferSelect;
  rows: Array<typeof schema.feedback.$inferSelect>;
}

export async function loadExportData(
  runId: string,
  userId: string,
): Promise<ExportData | null> {
  const run = await db.query.runs.findFirst({
    where: and(eq(schema.runs.id, runId), eq(schema.runs.userId, userId)),
  });
  if (!run) return null;
  const rows = await db.query.feedback.findMany({
    where: eq(schema.feedback.runId, runId),
    orderBy: (f, { asc }) => [asc(f.studentName)],
  });
  return { run, rows };
}

export function finalFeedback(
  row: typeof schema.feedback.$inferSelect,
): string {
  return (row.editedFeedback ?? row.aiFeedback ?? "").trim();
}
