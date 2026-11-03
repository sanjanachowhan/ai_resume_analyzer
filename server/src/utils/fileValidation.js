import path from 'node:path';

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // DOCX files are ZIP archives

// Checks the real file content (magic bytes), not just the extension or the client-supplied MIME type.
// Returns 'pdf', 'docx' or null.
export function detectFileType(buffer, originalName = '') {
  const ext = path.extname(originalName).slice(1).toLowerCase();

  const looksLikePdf = buffer.subarray(0, 1024).includes('%PDF');
  const looksLikeZip = buffer.subarray(0, 4).equals(ZIP_SIGNATURE);

  if (ext === 'pdf' && looksLikePdf) return 'pdf';
  if (ext === 'docx' && looksLikeZip) return 'docx';
  return null;
}
