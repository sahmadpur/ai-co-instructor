import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function latestUsageByFeedback(
  runId: string,
): Promise<Map<string, { inputTokens: number; outputTokens: number }>> {
  const logs = await db
    .select({
      feedbackId: schema.apiLogs.feedbackId,
      inputTokens: schema.apiLogs.inputTokens,
      outputTokens: schema.apiLogs.outputTokens,
    })
    .from(schema.apiLogs)
    .where(eq(schema.apiLogs.runId, runId))
    .orderBy(desc(schema.apiLogs.createdAt));

  const map = new Map<string, { inputTokens: number; outputTokens: number }>();
  for (const l of logs) {
    if (!l.feedbackId) continue;
    if (map.has(l.feedbackId)) continue;
    map.set(l.feedbackId, {
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
    });
  }
  return map;
}
