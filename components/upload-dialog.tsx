"use client";

import { useRef, useState } from "react";
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
import { DEFAULT_MODEL } from "@/lib/anthropic/cost";
import { ModelSelect } from "@/components/model-select";

export function UploadDialog({
  feedbackId,
  currentModel,
  disabled,
  hasFeedback,
  onStarted,
}: {
  feedbackId: string;
  currentModel: string;
  disabled?: boolean;
  hasFeedback?: boolean;
  onStarted?: () => void;
}) {
  const initial = currentModel || DEFAULT_MODEL;
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState<string>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setInstructions("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function generate() {
    if (files.length === 0) {
      toast.error("Choose at least one PDF first.");
      return;
    }

    const form = new FormData();
    for (const f of files) form.append("files", f);
    if (instructions.trim()) {
      form.append("additionalInstructions", instructions.trim());
    }
    form.append("model", model);

    // Optimistically flip the row to "generating" and close immediately; the
    // LLM call runs server-side and feedback-table polling picks up the result.
    onStarted?.();
    setOpen(false);
    reset();
    toast.success("Generating…");

    void (async () => {
      try {
        const res = await fetch(`/api/feedback/${feedbackId}/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `request failed (${res.status})`);
        }
      } catch (err) {
        toast.error(
          `Could not generate: ${
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
        {hasFeedback ? "re-upload" : "upload"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="tracking-eyebrow text-foreground/55">upload</div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            Upload this student&rsquo;s files
          </DialogTitle>
          <DialogDescription className="font-display italic text-foreground/65">
            Drop the student&rsquo;s PDFs (extract the archive first). They&rsquo;re
            graded once and not stored — re-upload to regenerate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label
            htmlFor="upload-files"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
          >
            pdf files
          </Label>
          <input
            id="upload-files"
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="font-mono-num text-sm block w-full rounded-md border border-input bg-paper/60 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-3 file:py-1 file:font-mono-num file:text-xs file:uppercase file:tracking-[0.18em] file:text-background hover:file:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {files.length > 0 ? (
            <ul className="space-y-1 font-mono-num text-[0.7rem] text-foreground/65">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex justify-between gap-3">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 tabular-nums text-foreground/45">
                    {(f.size / 1_048_576).toFixed(1)}MB
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="upload-instructions"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
          >
            additional instructions
          </Label>
          <Textarea
            id="upload-instructions"
            rows={3}
            placeholder="e.g., focus on the requirements analysis section"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="upload-model"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/65"
          >
            model
          </Label>
          <ModelSelect id="upload-model" value={model} onChange={setModel} />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            onClick={generate}
            disabled={files.length === 0}
            className="font-display italic"
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
