// Try the parser on a local file without starting the server:
//   npm run parse:resume -- "C:\path\to\resume.pdf"
import fs from 'node:fs';
import path from 'node:path';
import { detectFileType } from '../src/utils/fileValidation.js';
import { parseResume } from '../src/services/resumeParser.service.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npm run parse:resume -- <path-to-resume.pdf|docx>');
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const fileType = detectFileType(buffer, path.basename(filePath));
if (!fileType) {
  console.error('Not a valid PDF or DOCX file.');
  process.exit(1);
}

const { text, parsedData } = await parseResume({ buffer, fileType });

console.log(`File type: ${fileType} | extracted characters: ${text.length}`);
console.log(`Name: ${parsedData.name ?? '(not detected)'}`);
console.log(`Email: ${parsedData.email ?? '(not detected)'}`);
console.log(`Sections found: ${parsedData.sectionsFound.join(', ') || '(none)'}`);
console.log('\n--- First 600 characters ---\n');
console.log(text.slice(0, 600));
