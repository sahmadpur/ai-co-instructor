import Papa from "papaparse";
import { type ExportData, finalFeedback } from "./types";

export function exportCsv(data: ExportData): string {
  const header = ["Student Name", "Email", "Submission Preview", "Feedback", "Status"];
  const rows = data.rows.map((r) => [
    r.studentName,
    r.studentEmail ?? "",
    r.submissionPreview ?? "",
    finalFeedback(r),
    r.status,
  ]);
  const meta = [
    [`Course: ${data.run.courseName}`],
    [`Assignment: ${data.run.assignmentTitle}`],
    [`Generated: ${new Date(data.run.createdAt).toISOString()}`],
    [],
    header,
    ...rows,
  ];
  return Papa.unparse(meta, { quotes: true });
}
