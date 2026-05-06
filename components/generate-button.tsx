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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback-focus">Feedback focus (optional)</Label>
        <Textarea
          id="feedback-focus"
          rows={4}
          placeholder="e.g., focus on whether user stories follow INVEST and acceptance criteria are testable"
          value={feedbackFocus}
          onChange={(e) => setFeedbackFocus(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value as ModelId)}
          disabled={submitting}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
      <Button
        type="submit"
        size="lg"
        disabled={submitting || submissionsReady === 0}
      >
        {submitting
          ? "Starting…"
          : submissionsReady === 0
          ? "No submissions to grade"
          : `Generate Feedback for ${submissionsReady} submission${
              submissionsReady === 1 ? "" : "s"
            }`}
      </Button>
    </form>
  );
}
