"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { RegenerateDialog } from "@/components/regenerate-dialog";

export type FeedbackRowData = {
  id: string;
  studentName: string;
  studentEmail: string | null;
  submissionType: string;
  submissionPreview: string | null;
  aiFeedback: string | null;
  editedFeedback: string | null;
  status: "pending" | "generating" | "generated" | "edited" | "failed";
  errorMessage: string | null;
  model: string;
};

const STATUS_VARIANT: Record<
  FeedbackRowData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  generating: "outline",
  generated: "secondary",
  edited: "default",
  failed: "destructive",
};

export function FeedbackRow({
  row,
  locked,
  onChange,
}: {
  row: FeedbackRowData;
  locked: boolean;
  onChange: (next: FeedbackRowData) => void;
}) {
  const initial = row.editedFeedback ?? row.aiFeedback ?? "";
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(initial);

  useEffect(() => {
    const next = row.editedFeedback ?? row.aiFeedback ?? "";
    if (next !== lastSavedRef.current) {
      setDraft(next);
      lastSavedRef.current = next;
    }
  }, [row.editedFeedback, row.aiFeedback]);

  async function persist() {
    if (locked) return;
    if (draft === lastSavedRef.current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedFeedback: draft }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `save failed (${res.status})`);
      }
      lastSavedRef.current = draft;
      onChange({ ...row, editedFeedback: draft, status: "edited" });
    } catch (err) {
      toast.error(
        `Could not save: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetToAi() {
    if (locked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedFeedback: null }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `reset failed (${res.status})`);
      }
      const ai = row.aiFeedback ?? "";
      lastSavedRef.current = ai;
      setDraft(ai);
      onChange({ ...row, editedFeedback: null, status: "generated" });
    } catch (err) {
      toast.error(
        `Could not reset: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = row.status === "pending" || row.status === "generating";

  return (
    <TableRow>
      <TableCell className="align-top font-medium">
        <div>{row.studentName}</div>
        {row.studentEmail ? (
          <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
        ) : null}
      </TableCell>
      <TableCell className="align-top text-sm text-muted-foreground max-w-[18rem]">
        <div className="line-clamp-3 whitespace-pre-wrap">
          {row.submissionPreview ?? "—"}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide">
          {row.submissionType}
        </div>
      </TableCell>
      <TableCell className="align-top min-w-[24rem]">
        {isBusy ? (
          <div className="text-sm text-muted-foreground italic">
            {row.status === "generating" ? "generating…" : "queued…"}
          </div>
        ) : row.status === "failed" ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive">
              {row.errorMessage ?? "generation failed"}
            </div>
          </div>
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={persist}
            disabled={locked || saving}
            rows={Math.max(6, Math.min(14, draft.split("\n").length + 2))}
            className="font-sans text-sm"
          />
        )}
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
        {saving ? (
          <div className="mt-1 text-xs text-muted-foreground">saving…</div>
        ) : null}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-2">
          <RegenerateDialog
            feedbackId={row.id}
            currentModel={row.model}
            disabled={locked || isBusy}
            onStarted={() =>
              onChange({ ...row, status: "generating", errorMessage: null })
            }
          />
          {row.editedFeedback != null && !locked ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToAi}
              disabled={saving}
            >
              Reset to AI
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
