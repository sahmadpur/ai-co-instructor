import * as XLSX from "xlsx";
import { type ExportData, finalFeedback } from "./types";

export function exportExcel(data: ExportData): Buffer {
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

  const ws = XLSX.utils.aoa_to_sheet(meta);
  ws["!cols"] = autoWidths([header, ...rows]);
  ws["!freeze"] = { xSplit: 0, ySplit: 5 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Feedback");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function autoWidths(rows: (string | number)[][]): { wch: number }[] {
  const cols = rows[0]?.length ?? 0;
  const widths = new Array(cols).fill(10);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      if (len > widths[i]) widths[i] = Math.min(60, len);
    });
  }
  return widths.map((wch) => ({ wch }));
}
