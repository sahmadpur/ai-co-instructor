"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FeedbackRow, type FeedbackRowData } from "@/components/feedback-row";
import { ExportMenu } from "@/components/export-menu";

export type RunStatus = "draft" | "generating" | "review" | "confirmed";

export interface RunPayload {
  id: string;
  status: RunStatus;
  createdAt: string;
  confirmedAt: string | null;
  courseName: string;
  assignmentTitle: string;
}

interface RunResponse {
  run: {
    id: string;
    status: RunStatus;
    createdAt: number | string;
    confirmedAt: number | string | null;
  };
  feedback: FeedbackRowData[];
  totalCostUsd: number;
}

export function FeedbackTable({
  initialRun,
  initialFeedback,
  initialTotalCostUsd,
}: {
  initialRun: RunPayload;
  initialFeedback: FeedbackRowData[];
  initialTotalCostUsd: number;
}) {
  const [run, setRun] = useState<RunPayload>(initialRun);
  const [rows, setRows] = useState<FeedbackRowData[]>(initialFeedback);
  const [totalCostUsd, setTotalCostUsd] = useState(initialTotalCostUsd);
  const [confirming, setConfirming] = useState(false);
  const pollingRef = useRef(false);

  const locked = run.status === "confirmed";

  const anyRowBusy = useMemo(
    () =>
      rows.some((r) => r.status === "pending" || r.status === "generating"),
    [rows],
  );
  const shouldPoll = run.status === "generating" || anyRowBusy;

  useEffect(() => {
    if (!shouldPoll) return;
    if (pollingRef.current) return;
    pollingRef.current = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as RunResponse;
        setRows(data.feedback);
        setTotalCostUsd(data.totalCostUsd);
        const stillBusy =
          data.run.status === "generating" ||
          data.feedback.some(
            (r) => r.status === "pending" || r.status === "generating",
          );
        if (data.run.status !== run.status) {
          setRun((r) => ({ ...r, status: data.run.status }));
        }
        if (!stillBusy) {
          clearInterval(interval);
          pollingRef.current = false;
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => {
      clearInterval(interval);
      pollingRef.current = false;
    };
  }, [run.id, run.status, shouldPoll]);

  const counts = useMemo(() => {
    const total = rows.length;
    const done = rows.filter(
      (r) =>
        r.status === "generated" ||
        r.status === "edited" ||
        r.status === "failed",
    ).length;
    const edited = rows.filter((r) => r.status === "edited").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return { total, done, edited, failed };
  }, [rows]);

  function updateRow(next: FeedbackRowData) {
    setRows((rs) => rs.map((r) => (r.id === next.id ? next : r)));
  }

  async function confirmAll() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `confirm failed (${res.status})`);
      }
      setRun((r) => ({
        ...r,
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
      }));
      toast.success("Run confirmed and locked.");
    } catch (err) {
      toast.error(
        `Could not confirm: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-8">
      {run.status === "generating" ? (
        <div className="paper-card space-y-3 rounded-lg p-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="tracking-eyebrow text-foreground/55">in press</div>
              <div className="font-display text-lg italic">
                The AI is writing your feedback…
              </div>
            </div>
            <div className="font-mono-num text-sm tabular-nums">
              <span className="text-2xl font-display tabular-nums">
                {counts.done}
              </span>
              <span className="text-foreground/55"> / {counts.total}</span>
            </div>
          </div>
          <Progress
            value={counts.total > 0 ? (counts.done / counts.total) * 100 : 0}
            className="h-1.5"
          />
        </div>
      ) : null}

      {locked && run.confirmedAt ? (
        <div className="flex items-start gap-4 rounded-lg border border-foreground/30 bg-foreground/5 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-foreground bg-foreground text-background font-display italic">
            ✓
          </span>
          <div className="space-y-1">
            <div className="tracking-eyebrow text-foreground/65">filed & locked</div>
            <div className="font-display text-base">
              Confirmed on{" "}
              <span className="italic">
                {new Date(run.confirmedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              . Feedback is read-only — export below.
            </div>
          </div>
        </div>
      ) : null}

      <div className="paper-card overflow-hidden rounded-xl">
        <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
          <Stat label="students" value={counts.total} />
          <Stat label="ready" value={counts.done} />
          <Stat label="edited" value={counts.edited} accent={counts.edited > 0} />
          <Stat label="failed" value={counts.failed} destructive={counts.failed > 0} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-rule-strong/70">
                <TableHead className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/55 px-4 py-3">
                  · student
                </TableHead>
                <TableHead className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/55 px-4 py-3">
                  submission
                </TableHead>
                <TableHead className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/55 px-4 py-3">
                  feedback
                </TableHead>
                <TableHead className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/55 px-4 py-3">
                  state
                </TableHead>
                <TableHead className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/55 px-4 py-3">
                  actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <FeedbackRow
                  key={row.id}
                  row={row}
                  locked={locked}
                  index={i}
                  onChange={updateRow}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-5 border-t-2 border-rule-strong/60 pt-6">
        <div className="space-y-1">
          <div className="tracking-eyebrow text-foreground/55">running tab</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl tabular-nums">
              ${totalCostUsd.toFixed(4)}
            </span>
            <span className="font-display italic text-foreground/55 text-sm">
              tokens to date
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu runId={run.id} />
          {!locked ? (
            <Button
              onClick={confirmAll}
              disabled={confirming}
              size="lg"
              className="group h-11 gap-3"
            >
              <span className="font-display text-base italic">
                {confirming ? "Confirming…" : "Confirm & file"}
              </span>
              {!confirming ? (
                <span aria-hidden className="font-mono-num text-xs tracking-widest opacity-80 transition-transform group-hover:translate-x-1">
                  →
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  destructive,
}: {
  label: string;
  value: number;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="tracking-eyebrow text-foreground/55">{label}</div>
      <div
        className={[
          "mt-0.5 font-display text-2xl tabular-nums leading-none",
          destructive ? "text-destructive" : accent ? "text-marker" : "text-foreground",
        ].join(" ")}
      >
        {value.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
