"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_MODEL,
  MODELS_BY_PROVIDER,
  PROVIDER_LABELS,
  type ModelId,
  type Provider,
} from "@/lib/anthropic/cost";

export function GenerateForm({
  courseId,
  courseName,
  courseWorkId,
  assignmentTitle,
  taskDescription,
  submissionsReady,
}: {
  courseId: string;
  courseName: string;
  courseWorkId: string;
  assignmentTitle: string;
  taskDescription: string;
  submissionsReady: number;
}) {
  const [feedbackFocus, setFeedbackFocus] = useState("");
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseName,
          courseWorkId,
          assignmentTitle,
          taskDescription,
          feedbackFocus: feedbackFocus.trim() || undefined,
          model,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `request failed (${res.status})`);
      }
      const { runId } = (await res.json()) as { runId: string };
      router.push(`/runs/${runId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Could not start run: ${msg}`);
      setSubmitting(false);
    }
  }

  const noSubs = submissionsReady === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="feedback-focus"
          className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
        >
          note <span className="font-display normal-case italic text-foreground/45">(optional)</span>
        </Label>
        <Textarea
          id="feedback-focus"
          rows={4}
          placeholder="e.g., focus on whether user stories follow INVEST and acceptance criteria are testable"
          value={feedbackFocus}
          onChange={(e) => setFeedbackFocus(e.target.value)}
          disabled={submitting}
          className="bg-paper/60"
        />
        <p className="font-display text-xs italic text-foreground/55">
          What should the AI pay particular attention to?
        </p>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="model"
          className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
        >
          model
        </Label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value as ModelId)}
          disabled={submitting}
          className="font-mono-num text-sm flex h-9 w-full rounded-md border border-input bg-paper/60 px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(Object.keys(MODELS_BY_PROVIDER) as Provider[]).map((p) => (
            <optgroup key={p} label={PROVIDER_LABELS[p]}>
              {MODELS_BY_PROVIDER[p].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="border-t border-rule pt-5">
        <Button
          type="submit"
          size="lg"
          disabled={submitting || noSubs}
          className="group relative h-12 w-full justify-between overflow-hidden text-base"
        >
          <span className="font-display text-lg italic">
            {submitting ? "Starting…" : noSubs ? "No submissions to grade" : "Start run"}
          </span>
          {!submitting && !noSubs ? (
            <span className="font-mono-num text-xs tracking-widest opacity-80 transition-transform group-hover:translate-x-1">
              {submissionsReady.toString().padStart(2, "0")}&nbsp;students&nbsp;→
            </span>
          ) : null}
        </Button>
        {!submitting && !noSubs ? (
          <p className="mt-3 text-center font-display text-xs italic text-foreground/55">
            this starts a new run you can edit before exporting
          </p>
        ) : null}
      </div>
    </form>
  );
}
