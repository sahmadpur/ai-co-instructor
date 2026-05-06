import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOwnerUserIds } from "@/lib/owner";
import { loadExportData } from "@/lib/exports/types";
import { exportExcel } from "@/lib/exports/excel";
import { exportCsv } from "@/lib/exports/csv";
import { exportHtml } from "@/lib/exports/html";

const VALID = new Set(["excel", "csv", "html", "pdf"]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string; format: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId, format } = await ctx.params;
  if (!VALID.has(format)) {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }
  const ownerIds = await getOwnerUserIds(session);
  const data = await loadExportData(runId, ownerIds);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const safeTitle = data.run.assignmentTitle
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "feedback";
  const date = new Date(data.run.createdAt).toISOString().slice(0, 10);
  const baseName = `${safeTitle}-${date}`;

  switch (format) {
    case "excel": {
      const buf = exportExcel(data);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }
    case "csv": {
      const csv = exportCsv(data);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      });
    }
    case "html": {
      const html = exportHtml(data);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    case "pdf": {
      const html = exportHtml(data, { print: true });
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
  return NextResponse.json({ error: "unreachable" }, { status: 500 });
}
