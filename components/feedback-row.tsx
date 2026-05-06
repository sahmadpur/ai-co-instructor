"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

const STATUS_CONFIG: Record<
  FeedbackRowData["status"],
  { label: string; cls: string; dot: string }
> = {
  pending: {
    label: "queued",
    cls: "border-rule-strong text-foreground/55",
    dot: "bg-foreground/30",
  },
  generating: {
    label: "in press",
    cls: "border-marker/40 bg-marker/10 text-marker",
    dot: "bg-marker anim-nib",
  },
  generated: {
    label: "ai draft",
    cls: "border-foreground/30 text-foreground/75",
    dot: "bg-foreground/50",
  },
  edited: {
    label: "edited",
    cls: "border-foreground/85 bg-foreground text-background",
    dot: "bg-marker",
  },
  failed: {
    label: "failed",
    cls: "border-destructive/50 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·"
  );
}

export function FeedbackRow({
  row,
  locked,
  index,
  onChange,
}: {
  row: FeedbackRowData;
  locked: boolean;
  index: number;
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
  const status = STATUS_CONFIG[row.status];

  return (
    <TableRow className="border-b border-rule align-top">
      <TableCell className="w-[14rem] py-5 align-top">
        <div className="flex items-start gap-3">
          <span className="font-display text-2xl italic text-foreground/30 tabular-nums leading-none pt-1 w-6 text-right">
            {(index + 1).toString().padStart(2, "0")}
          </span>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-rule-strong/60 bg-paper/60 font-display text-sm italic text-foreground/75">
            {initials(row.studentName)}
          </div>
          <div className="min-w-0">
            <div className="font-display text-base leading-tight">
              {row.studentName}
            </div>
            {row.studentEmail ? (
              <div className="font-mono-num text-[0.65rem] uppercase tracking-[0.16em] text-foreground/55 truncate">
                {row.studentEmail}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell className="max-w-[18rem] py-5 align-top text-sm">
        <div className="space-y-2">
          <span className="font-mono-num text-[0.6rem] uppercase tracking-[0.2em] text-foreground/55">
            {row.submissionType}
          </span>
          <div className="line-clamp-3 whitespace-pre-wrap font-display italic leading-snug text-foreground/70 border-l-2 border-rule pl-3">
            {row.submissionPreview ?? "—"}
          </div>
        </div>
      </TableCell>

      <TableCell className="min-w-[26rem] py-5 align-top">
        {isBusy ? (
          <div className="flex items-center gap-2 font-mono-num text-xs uppercase tracking-[0.18em] text-foreground/55">
            <span className="anim-nib block h-2 w-2 rounded-full bg-marker" />
            {row.status === "generating" ? "the AI is writing…" : "queued, awaiting pen…"}
          </div>
        ) : row.status === "failed" ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em]">
              generation failed
            </div>
            <div className="font-display italic">
              {row.errorMessage ?? "an unknown error"}
            </div>
          </div>
        ) : (
          <div className="relative">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={persist}
              disabled={locked || saving}
              rows={Math.max(6, Math.min(14, draft.split("\n").length + 2))}
              className="bg-paper/40 text-[0.95rem] leading-relaxed"
              style={{
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
              }}
            />
            {row.editedFeedback != null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-2 top-2 font-mono-num text-[0.6rem] uppercase tracking-[0.18em] text-marker/85"
              >
                · edited
              </span>
            ) : null}
          </div>
        )}
      </TableCell>

      <TableCell className="w-[8.5rem] py-5 align-top">
        <div className="flex flex-col items-start gap-2">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-num text-[0.6rem] uppercase tracking-[0.18em]",
              status.cls,
            ].join(" ")}
          >
            <span className={`block h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          {saving ? (
            <span className="font-mono-num text-[0.6rem] uppercase tracking-[0.18em] text-foreground/55">
              saving…
            </span>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="w-[8.5rem] py-5 align-top">
        <div className="flex flex-col gap-1">
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
              className="font-mono-num text-[0.65rem] uppercase tracking-[0.18em] justify-start"
            >
              reset to ai
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
