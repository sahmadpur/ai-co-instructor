export type RunStatus = "draft" | "generating" | "review" | "confirmed";
export type CommentStatus =
  | "pending"
  | "generating"
  | "generated"
  | "edited"
  | "failed";

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  draft: "new",
  generating: "writing",
  review: "ready",
  confirmed: "done",
};

const COMMENT_LABEL_BASE: Record<CommentStatus, string> = {
  pending: "waiting",
  generating: "writing",
  generated: "first draft",
  edited: "accepted",
  failed: "error",
};

export function commentStatusLabel(
  status: CommentStatus,
  opts: { hasPriorRun?: boolean } = {},
): string {
  if (status === "generating" && opts.hasPriorRun) return "rewriting";
  return COMMENT_LABEL_BASE[status];
}
