// Final-project runs get a manual per-student PDF-upload flow instead of the
// usual auto-generation, because students submit zip/rar archives that the
// pipeline can't grade. A run qualifies when the course ("group") name starts
// with "BA" and the assignment title contains "Yekun Layihə".

// Lowercase, fold the schwa (ə → e), and collapse all whitespace runs to a
// single space so spacing/case/diacritic variants normalize to one form.
function normalizeTitle(s: string): string {
  return s
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

const FINAL_PROJECT_TITLE = "yekun layihe"; // already normalized

export function isFinalProjectRun(
  courseName: string,
  assignmentTitle: string,
): boolean {
  const isBaGroup = courseName.trim().toLocaleUpperCase("az").startsWith("BA");
  const titleMatches = normalizeTitle(assignmentTitle).includes(
    FINAL_PROJECT_TITLE,
  );
  return isBaGroup && titleMatches;
}
