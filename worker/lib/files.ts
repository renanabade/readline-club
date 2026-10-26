// Uploaded materials live in R2 under a random key and are served only to
// approved members through /api/files/:key.
export const maxFileBytes = 20 * 1024 * 1024;
export const filePath = "/api/files/";
const fileTypes = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
} as const;
export type FileType = keyof typeof fileTypes;
export const fileContentType = (type: FileType) => fileTypes[type];
// Trust the bytes, not the browser's MIME type or the file name.
export function detectFileType(head: Uint8Array): FileType | null {
  const text = new TextDecoder("latin1").decode(head.subarray(0, 64));
  if (text.startsWith("%PDF-")) return "pdf";
  // An EPUB is a zip whose first entry is an uncompressed "mimetype" file.
  if (text.startsWith("PK\x03\x04") && text.includes("application/epub+zip"))
    return "epub";
  return null;
}
export function fileKey(url: string, origin: string) {
  const prefix = origin + filePath;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return /^[0-9a-f-]{36}$/.test(key) ? key : null;
}
