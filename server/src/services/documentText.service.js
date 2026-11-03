import { extractText } from '../parsers/index.js';
import { cleanText } from '../utils/textCleaner.js';
import { detectFileType } from '../utils/fileValidation.js';
import { AppError } from '../utils/AppError.js';

// Generic "uploaded PDF/DOCX -> clean text" helper (used for job descriptions).
export async function extractDocumentText(file, minLength = 50) {
  const fileType = detectFileType(file.buffer, file.originalname);
  if (!fileType) {
    throw new AppError(
      'Only PDF and DOCX files are supported, and the file content must match its extension.',
      400,
      'INVALID_FILE_TYPE'
    );
  }

  const text = cleanText(await extractText(file.buffer, fileType));
  if (text.length < minLength) {
    throw new AppError(
      "We couldn't find readable text in this file. If it's a scanned document or an image, please paste the text instead.",
      422,
      'EMPTY_DOCUMENT'
    );
  }
  return text;
}
