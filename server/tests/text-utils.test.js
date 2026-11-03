import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText } from '../src/utils/textCleaner.js';
import { detectFileType } from '../src/utils/fileValidation.js';
import { parseResumeSections } from '../src/parsers/resumeSectionParser.js';

// ---------- text cleaning ----------

test('cleanText normalizes line endings, spaces and blank lines', () => {
  assert.equal(cleanText('a\r\nb\rc'), 'a\nb\nc');
  assert.equal(cleanText('  too    many \t spaces  '), 'too many spaces');
  assert.equal(cleanText('one\n\n\n\n\ntwo'), 'one\n\ntwo');
  assert.equal(cleanText('  \n\n hello \n\n  '), 'hello');
});

test('cleanText removes characters PostgreSQL cannot store and normalizes bullets', () => {
  assert.equal(cleanText('bad\u0000text'), 'badtext');
  assert.equal(cleanText('a\u0001b\u0007c'), 'abc');
  assert.equal(cleanText('\u25CF Built APIs\n\u2022 Wrote tests'), '• Built APIs\n• Wrote tests');
  assert.equal(cleanText('non\u00A0breaking'), 'non breaking');
});

test('cleanText copes with empty and missing input', () => {
  assert.equal(cleanText(''), '');
  assert.equal(cleanText(), '');
  assert.equal(cleanText(null), '');
});

// ---------- file type detection (checks real content, not just the name) ----------

const pdf = Buffer.from('%PDF-1.7\n1 0 obj');
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

test('real PDF and DOCX files are recognized by their content', () => {
  assert.equal(detectFileType(pdf, 'resume.pdf'), 'pdf');
  assert.equal(detectFileType(pdf, 'RESUME.PDF'), 'pdf');
  assert.equal(detectFileType(zip, 'resume.docx'), 'docx');
});

test('a renamed or disguised file is rejected', () => {
  assert.equal(detectFileType(Buffer.from('just some text'), 'resume.pdf'), null);
  assert.equal(detectFileType(pdf, 'resume.docx'), null); // PDF content, DOCX name
  assert.equal(detectFileType(zip, 'resume.pdf'), null); // ZIP content, PDF name
  assert.equal(detectFileType(Buffer.from('MZ\x90\x00 fake exe'), 'resume.pdf'), null);
  assert.equal(detectFileType(pdf, 'resume.txt'), null);
  assert.equal(detectFileType(pdf, 'resume'), null);
  assert.equal(detectFileType(Buffer.alloc(0), 'resume.pdf'), null);
});

// ---------- resume sections ----------

test('sections are found with different heading styles', () => {
  const text = 'Jane Doe\njane@example.com\n\nProfessional Summary\nBuilder of things.\n\nTechnical Skills:\nReact, Node.js\n\nWORK EXPERIENCE\nDev at Acme\n\nAcademic Projects\nA project\n\nCertifications & Courses\nAWS Cloud Practitioner\n\nEducation\nB.Tech';
  const parsed = parseResumeSections(text);
  assert.equal(parsed.name, 'Jane Doe');
  assert.equal(parsed.email, 'jane@example.com');
  assert.deepEqual(parsed.sectionsFound, ['summary', 'skills', 'education', 'experience', 'projects', 'certifications']);
  assert.equal(parsed.skills, 'React, Node.js');
  assert.equal(parsed.certifications, 'AWS Cloud Practitioner');
});

test('missing sections are null rather than guessed', () => {
  const parsed = parseResumeSections('Jane Doe\n\nSKILLS\nPython');
  assert.equal(parsed.experience, null);
  assert.equal(parsed.education, null);
  assert.deepEqual(parsed.sectionsFound, ['skills']);
});

test('a resume with no headings keeps everything out of the sections instead of guessing', () => {
  const parsed = parseResumeSections('I am a developer with many years of varied experience in several areas of software.');
  assert.deepEqual(parsed.sectionsFound, []);
  assert.equal(parsed.name, null); // a sentence is not a name
  assert.equal(parsed.email, null);
});

test('names are not taken from emails, numbers or long lines', () => {
  assert.equal(parseResumeSections('jane@example.com\n555 123 4567\nJane Doe').name, 'Jane Doe');
  assert.equal(parseResumeSections('Curriculum Vitae of a very experienced and highly motivated software engineer\nSKILLS\nJS').name, null);
});

test('a heading word inside a sentence is not treated as a section', () => {
  const parsed = parseResumeSections('Jane Doe\n\nEXPERIENCE\nI have experience with many projects and skills in teams\nSKILLS\nGo');
  assert.deepEqual(parsed.sectionsFound, ['skills', 'experience']);
  assert.match(parsed.experience, /many projects and skills/);
});
