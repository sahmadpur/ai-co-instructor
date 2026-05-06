import { type ExportData, finalFeedback } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFeedback(text: string): string {
  // Convert **bold** to <strong>; preserve newlines.
  const escaped = esc(text);
  const bolded = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bolded.replace(/\n/g, "<br>");
}

export function exportHtml(data: ExportData, opts: { print?: boolean } = {}): string {
  const date = new Date(data.run.createdAt).toISOString().slice(0, 10);
  const sections = data.rows
    .map((r) => {
      const feedback = finalFeedback(r);
      return `
<section class="student">
  <h2>${esc(r.studentName)}</h2>
  ${r.studentEmail ? `<p class="email">${esc(r.studentEmail)}</p>` : ""}
  ${
    r.submissionPreview
      ? `<blockquote>${esc(r.submissionPreview)}</blockquote>`
      : ""
  }
  <div class="feedback">${
    feedback ? renderFeedback(feedback) : "<em>No feedback yet.</em>"
  }</div>
</section>`;
    })
    .join("\n");

  const printScript = opts.print
    ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 200));</script>'
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Feedback — ${esc(data.run.assignmentTitle)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111;
    max-width: 7.5in;
    margin: 0 auto;
    padding: 32px;
    background: #fff;
  }
  header h1 { font-size: 20px; margin-bottom: 4px; }
  header p { color: #666; margin: 0; }
  section.student { page-break-inside: avoid; padding: 16px 0; border-bottom: 1px solid #eee; }
  section.student:last-of-type { border-bottom: 0; }
  section.student h2 { font-size: 16px; margin: 0 0 4px; }
  section.student .email { font-size: 12px; color: #888; margin: 0 0 8px; }
  blockquote {
    background: #f7f7f7;
    border-left: 3px solid #ddd;
    margin: 8px 0;
    padding: 8px 12px;
    font-size: 13px;
    color: #444;
    white-space: pre-wrap;
  }
  .feedback { white-space: pre-wrap; }
  @media print {
    body { padding: 0; max-width: none; }
    section.student { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <h1>${esc(data.run.assignmentTitle)}</h1>
  <p>${esc(data.run.courseName)} · ${date}</p>
</header>
${sections}
${printScript}
</body>
</html>`;
}
