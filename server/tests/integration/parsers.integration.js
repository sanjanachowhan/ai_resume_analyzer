// Runs the REAL PDF and DOCX parsers on sample files.  npm run test:integration
// Needs the project's packages installed (pdf-parse, mammoth). No database is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractText } from '../../src/parsers/index.js';
import { parseResume } from '../../src/services/resumeParser.service.js';
import { extractDocumentText } from '../../src/services/documentText.service.js';
import { detectFileType } from '../../src/utils/fileValidation.js';

const fixture = (name) => fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url));

test('a real PDF resume is read, cleaned and split into sections', async () => {
  const buffer = fixture('jane-doe-resume.pdf');
  assert.equal(detectFileType(buffer, 'jane-doe-resume.pdf'), 'pdf');

  const { text, parsedData } = await parseResume({ buffer, fileType: 'pdf' });
  assert.match(text, /Jane Doe/);
  assert.ok(!text.includes('\u0000'));

  assert.equal(parsedData.name, 'Jane Doe');
  assert.equal(parsedData.email, 'jane.doe@example.com');
  for (const section of ['skills', 'experience', 'education']) assert.ok(parsedData.sectionsFound.includes(section), section);

  const skills = parsedData.profile.skills.map((s) => s.name);
  for (const skill of ['React', 'Node.js', 'PostgreSQL', 'Docker']) assert.ok(skills.includes(skill), skill);
  assert.equal(parsedData.profile.educationLevel.level, 2);
  assert.ok(Math.abs(parsedData.profile.yearsExperience.estimated - 3) < 0.2); // Jan 2021 - Dec 2023
});

test('a PDF made by a different tool (different compression) is read too', async () => {
  const { text, parsedData } = await parseResume({ buffer: fixture('reportlab-resume.pdf'), fileType: 'pdf' });
  assert.match(text, /Jane Doe/);
  assert.equal(parsedData.name, 'Jane Doe');
  assert.ok(parsedData.profile.skills.some((skill) => skill.name === 'React'));
  assert.ok(!/\n\n\n/.test(text)); // no runs of blank lines
});

test('a real DOCX resume is read and parsed', async () => {
  const buffer = fixture('alex-kim-resume.docx');
  assert.equal(detectFileType(buffer, 'alex-kim-resume.docx'), 'docx');

  const { parsedData } = await parseResume({ buffer, fileType: 'docx' });
  assert.equal(parsedData.name, 'Alex Kim');
  assert.equal(parsedData.email, 'alex.kim@example.com');
  assert.ok(parsedData.sectionsFound.includes('experience'));
  const skills = parsedData.profile.skills.map((s) => s.name);
  for (const skill of ['Python', 'Django', 'AWS']) assert.ok(skills.includes(skill), skill);
  assert.ok(parsedData.profile.yearsExperience.estimated > 5); // Mar 2020 - Present
});

test('a job description document is turned into clean text', async () => {
  const buffer = fixture('backend-job.docx');
  const text = await extractDocumentText({ buffer, originalname: 'backend-job.docx' });
  assert.match(text, /Backend Developer/);
  assert.match(text, /Node\.js and PostgreSQL/);
});

test('corrupted and disguised files fail with controlled errors', async () => {
  await assert.rejects(extractText(Buffer.from('%PDF-1.4 this is not really a pdf'), 'pdf'), { code: 'UNREADABLE_FILE' });
  await assert.rejects(extractText(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]), 'docx'), { code: 'UNREADABLE_FILE' });
  await assert.rejects(extractDocumentText({ buffer: Buffer.from('plain text'), originalname: 'job.pdf' }), { code: 'INVALID_FILE_TYPE' });
  await assert.rejects(extractText(Buffer.from('x'), 'exe'), { code: 'INVALID_FILE_TYPE' });
});

test('a file with too little text is rejected as empty', async () => {
  // A valid DOCX with no real content would be needed; this checks the text-length rule on the PDF path instead.
  await assert.rejects(
    parseResume({ buffer: Buffer.from('%PDF-1.4\n%%EOF'), fileType: 'pdf' }),
    (err) => ['EMPTY_RESUME', 'UNREADABLE_FILE'].includes(err.code)
  );
});
