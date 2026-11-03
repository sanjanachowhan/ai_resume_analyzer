// Heuristic section splitter. It only reports what it can identify reliably;
// anything uncertain stays available in the full rawText stored with the resume.

const SECTION_ALIASES = {
  summary: ['summary', 'professional summary', 'profile', 'objective', 'career objective', 'about me'],
  skills: ['skills', 'technical skills', 'key skills', 'core competencies', 'technologies', 'skills & tools', 'tech stack'],
  education: ['education', 'academic background', 'education & training', 'qualifications', 'academics'],
  experience: [
    'experience', 'work experience', 'professional experience', 'employment history',
    'work history', 'internships', 'internship experience',
  ],
  projects: ['projects', 'personal projects', 'academic projects', 'key projects'],
  certifications: ['certifications', 'certificates', 'licenses & certifications', 'courses', 'certifications & courses'],
};

const normalizeHeading = (line) =>
  line.toLowerCase().replace(/[^a-z&\s]/g, ' ').replace(/\s+/g, ' ').trim();

const HEADING_MAP = new Map();
for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
  for (const alias of aliases) HEADING_MAP.set(normalizeHeading(alias), section);
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function guessName(headerLines) {
  return (
    headerLines.find(
      (line) =>
        line.length <= 50 &&
        !line.includes('@') &&
        !/\d/.test(line) &&
        /^[A-Za-z][A-Za-z.'’-]*(\s+[A-Za-z][A-Za-z.'’-]*){1,3}$/.test(line)
    ) || null
  );
}

export function parseResumeSections(text) {
  const buckets = { header: [] };
  let current = 'header';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = line.length <= 40 ? HEADING_MAP.get(normalizeHeading(line)) : undefined;
    if (section) {
      current = section;
      buckets[current] ??= [];
      continue;
    }
    (buckets[current] ??= []).push(line);
  }

  const get = (key) => (buckets[key]?.length ? buckets[key].join('\n') : null);

  const parsed = {
    name: guessName(buckets.header.slice(0, 6)),
    email: text.match(EMAIL_RE)?.[0] ?? null,
    summary: get('summary'),
    skills: get('skills'),
    education: get('education'),
    experience: get('experience'),
    projects: get('projects'),
    certifications: get('certifications'),
  };

  const sectionKeys = ['summary', 'skills', 'education', 'experience', 'projects', 'certifications'];
  parsed.sectionsFound = sectionKeys.filter((key) => parsed[key]);
  return parsed;
}
