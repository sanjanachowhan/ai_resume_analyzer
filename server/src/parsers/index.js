import { AppError } from '../utils/AppError.js';
import { extractPdfText } from './pdfParser.js';
import { extractDocxText } from './docxParser.js';

const extractors = {
  pdf: extractPdfText,
  docx: extractDocxText,
};

export async function extractText(buffer, fileType) {
  const extractor = extractors[fileType];
  if (!extractor) {
    throw new AppError('Only PDF and DOCX files are supported.', 400, 'INVALID_FILE_TYPE');
  }

  try {
    return await extractor(buffer);
  } catch (err) {
    if (err instanceof AppError) throw err; // already a safe, specific message (for example UNSAFE_FILE)
    console.error(`Failed to extract ${fileType} text:`, err.message);
    throw new AppError(
      `We couldn't read this ${fileType.toUpperCase()} file. It may be corrupted or password-protected.`,
      422,
      'UNREADABLE_FILE'
    );
  }
}
