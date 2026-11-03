// Normalizes text extracted from PDF/DOCX files so later steps (section parsing, keyword matching, AI) get clean input.
export function cleanText(input = '') {
  return String(input ?? '') // null/undefined become an empty string, not the text "null"
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '') // PostgreSQL text columns reject NUL characters
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // other control characters
    .replace(/\u00A0/g, ' ') // non-breaking spaces
    .replace(/[\u2022\u25CF\u25AA\u25E6\uF0B7]/g, '•') // normalize bullet glyphs
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // at most one blank line in a row
    .trim();
}
