"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  MODELS_BY_PROVIDER,
  PROVIDER_LABELS,
  type ModelId,
  type Provider,
} from "@/lib/anthropic/cost";

export function RegenerateDialog({
  feedbackId,
  currentModel,
  disabled,
  onStarted,
}: {
  feedbackId: string;
  currentModel: string;
  disabled?: boolean;
  onStarted?: () => void;
}) {
  const initial = (AVAILABLE_MODELS as readonly string[]).includes(currentModel)
    ? (currentModel as ModelId)
    : DEFAULT_MODEL;
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState<ModelId>(initial);

  function regenerate() {
    // Optimistically flip the row to "generating" and close immediately.
    // The LLM call runs server-side; polling in feedback-table picks up the
    // result without blocking the dialog.
    const body = JSON.stringify({
      additionalInstructions: instructions.trim() || undefined,
      model,
    });
    onStarted?.();
    setOpen(false);
    setInstructions("");
    toast.success("Regenerating…");

    void (async () => {
      try {
        const res = await fetch(`/api/feedback/${feedbackId}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `request failed (${res.status})`);
        }
      } catch (err) {
        toast.error(
          `Could not regenerate: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        );
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.18em]"
          />
        }
      >
        rewrite
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="tracking-eyebrow text-foreground/55">a second pass</div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            Rewrite this feedback
          </DialogTitle>
          <DialogDescription className="font-display italic text-foreground/65">
            Optionally add extra instructions for this student. Leave blank to
            re-run with the same focus.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label
            htmlFor="regen-instructions"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
          >
            additional instructions
          </Label>
          <Textarea
            id="regen-instructions"
            rows={4}
            placeholder="e.g., be more critical of their assumptions section"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="regen-model"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
          >
            the pen
          </Label>
          <select
            id="regen-model"
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
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
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button onClick={regenerate} className="font-display italic">
            Rewrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
