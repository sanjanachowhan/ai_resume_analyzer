// Mirrors the server rules for instant feedback. The server re-validates everything.
export const MAX_FILE_SIZE_MB = 5;
export const ACCEPTED_EXTENSIONS = ['pdf', 'docx'];

export const getExtension = (filename) => filename.split('.').pop().toLowerCase();

export function validateResumeFile(file) {
  if (!ACCEPTED_EXTENSIONS.includes(getExtension(file.name))) {
    return 'Only PDF and DOCX files are supported.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
  }
  return null;
}
