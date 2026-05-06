"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (run.status !== "generating") return;
    if (pollingRef.current) return;
    pollingRef.current = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as RunResponse;
        setRows(data.feedback);
        setTotalCostUsd(data.totalCostUsd);
        if (data.run.status !== "generating") {
          setRun((r) => ({ ...r, status: data.run.status }));
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
  }, [run.id, run.status]);

  const total = rows.length;
  const done = rows.filter(
    (r) =>
      r.status === "generated" ||
      r.status === "edited" ||
      r.status === "failed",
  ).length;

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
    <div className="space-y-6">
      {run.status === "generating" ? (
        <div className="space-y-2">
          <Progress value={total > 0 ? (done / total) * 100 : 0} />
          <p className="text-sm text-muted-foreground">
            {done} of {total} done · feedback fills in as it completes
          </p>
        </div>
      ) : null}

      {locked && run.confirmedAt ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          Confirmed on{" "}
          {new Date(run.confirmedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          . Feedback is read-only.
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Submission</TableHead>
              <TableHead>AI Feedback</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <FeedbackRow
                key={row.id}
                row={row}
                locked={locked}
                onChange={updateRow}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Total cost so far: ${totalCostUsd.toFixed(4)}
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu runId={run.id} />
          {!locked ? (
            <Button onClick={confirmAll} disabled={confirming}>
              {confirming ? "Confirming…" : "Confirm All"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
