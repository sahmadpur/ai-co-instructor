const BASE = "https://www.googleapis.com/drive/v3";
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

export class DriveError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getFileMetadata(
  token: string,
  fileId: string,
): Promise<DriveFileMeta> {
  const res = await fetch(
    `${BASE}/files/${fileId}?fields=id,name,mimeType,size`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new DriveError(res.status, await res.text());
  }
  return res.json() as Promise<DriveFileMeta>;
}

async function fetchBytes(token: string, url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new DriveError(res.status, await res.text());
  }
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_FILE_BYTES) {
    throw new DriveError(413, `file too large: ${contentLength} bytes`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_FILE_BYTES) {
    throw new DriveError(413, `file too large: ${buf.byteLength} bytes`);
  }
  return buf;
}

export async function downloadFile(
  token: string,
  fileId: string,
): Promise<Buffer> {
  return fetchBytes(token, `${BASE}/files/${fileId}?alt=media`);
}

export async function exportDriveFile(
  token: string,
  fileId: string,
  mimeType: string,
): Promise<Buffer> {
  const url = `${BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(
    mimeType,
  )}`;
  return fetchBytes(token, url);
}

// kept for back-compat; prefer exportDriveFile
export async function exportGoogleDoc(
  token: string,
  fileId: string,
  mimeType = "application/pdf",
): Promise<Buffer> {
  return exportDriveFile(token, fileId, mimeType);
}

export type SubmissionContent =
  | { type: "text"; text: string }
  | { type: "document"; base64: string; mediaType: "application/pdf" }
  | {
      type: "image";
      base64: string;
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    }
  | { type: "none"; reason: string };

export function inferImageMediaType(
  mimeType: string,
):
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"
  | null {
  switch (mimeType) {
    case "image/png":
      return "image/png";
    case "image/jpeg":
    case "image/jpg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    case "image/gif":
      return "image/gif";
    default:
      return null;
  }
}
