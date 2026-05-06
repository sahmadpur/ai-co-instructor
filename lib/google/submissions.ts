import type {
  StudentSubmission,
  SubmissionAttachment,
} from "./classroom";

export type SubmissionType =
  | "text"
  | "gdoc"
  | "pdf"
  | "image"
  | "mixed"
  | "none";

export interface ClassifiedSubmission {
  submissionType: SubmissionType;
  submissionPreview: string;
  shortAnswerText?: string;
  driveFileIds: string[];
  notes: string[];
}

export function classifySubmission(
  sub: StudentSubmission,
): ClassifiedSubmission {
  if (sub.state === "NEW" || sub.state === "CREATED") {
    return {
      submissionType: "none",
      submissionPreview: "(not turned in)",
      driveFileIds: [],
      notes: [],
    };
  }

  const shortAnswer = sub.shortAnswerSubmission?.answer?.trim();
  const attachments = sub.assignmentSubmission?.attachments ?? [];

  const driveFileIds: string[] = [];
  const notes: string[] = [];
  const kinds = new Set<SubmissionType>();

  if (shortAnswer) kinds.add("text");

  for (const att of attachments) {
    classifyAttachment(att, driveFileIds, notes, kinds);
  }

  if (kinds.size === 0) {
    return {
      submissionType: "none",
      submissionPreview: "(empty submission)",
      driveFileIds: [],
      notes,
    };
  }

  const submissionType: SubmissionType =
    kinds.size === 1 ? [...kinds][0] : "mixed";

  let preview = "";
  if (shortAnswer) {
    preview = shortAnswer.slice(0, 300);
    if (shortAnswer.length > 300) preview += "…";
  } else if (driveFileIds.length > 0) {
    preview = `${driveFileIds.length} file attachment${
      driveFileIds.length === 1 ? "" : "s"
    }`;
  } else if (notes.length > 0) {
    preview = notes.join("; ");
  }

  return {
    submissionType,
    submissionPreview: preview,
    shortAnswerText: shortAnswer,
    driveFileIds,
    notes,
  };
}

function classifyAttachment(
  att: SubmissionAttachment,
  driveFileIds: string[],
  notes: string[],
  kinds: Set<SubmissionType>,
) {
  if (att.driveFile?.id) {
    driveFileIds.push(att.driveFile.id);
    // We don't yet know the mimeType — record as gdoc/pdf/image lazily
    // For classification purposes here, treat as gdoc (best-guess); refined later.
    kinds.add("gdoc");
    return;
  }
  if (att.link?.url) {
    notes.push(`link: ${att.link.title ?? att.link.url}`);
    return;
  }
  if (att.youTubeVideo) {
    notes.push(`youtube: ${att.youTubeVideo.title ?? att.youTubeVideo.id}`);
    return;
  }
  if (att.form) {
    notes.push(`form: ${att.form.title ?? "form attachment"}`);
    return;
  }
}
