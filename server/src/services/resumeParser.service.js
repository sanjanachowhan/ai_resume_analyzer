import { extractText } from '../parsers/index.js';
import { parseResumeSections } from '../parsers/resumeSectionParser.js';
import { cleanText } from '../utils/textCleaner.js';
import { buildResumeProfile } from './resumeProfile.service.js';
import { AppError } from '../utils/AppError.js';

const MIN_TEXT_LENGTH = 50;

// buffer + fileType -> { text, parsedData }
// `text` is the full cleaned resume text (stored in Resume.rawText).
// `parsedData` holds the structured sections we could identify reliably.
export async function parseResume({ buffer, fileType }) {
  const text = cleanText(await extractText(buffer, fileType));

  if (text.length < MIN_TEXT_LENGTH) {
    throw new AppError(
      "We couldn't find readable text in this file. If it's a scanned document or an image-based PDF, please upload a text-based version.",
      422,
      'EMPTY_RESUME'
    );
  }

  const sections = parseResumeSections(text);
  return { text, parsedData: { ...sections, profile: safeProfile(text, sections) } };
}

// Skill extraction must never stop a resume from being saved; the text is stored either way.
function safeProfile(text, sections) {
  try {
    return buildResumeProfile(text, sections);
  } catch (err) {
    console.error('Resume profile extraction failed:', err.message);
    return null;
  }
}
