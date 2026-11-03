// Education level and years-of-experience extraction (shared by resumes and job descriptions).

const DEGREES = [
  { level: 4, label: "PhD", re: /\b(?:ph\.?\s?d\.?|doctorate|doctoral)(?![a-z])/i },
  {
    level: 3,
    label: "Master's",
    re: /\bmaster(?:['’]s|s)\b|\bmaster\s+(?:of|in|degree)\b|\bm\.?\s?tech\b|\bm\.?\s?sc\b|\bmba\b|\bm\.\s?e\b\.?/i,
  },
  {
    level: 2,
    label: "Bachelor's",
    re: /\bbachelor(?:['’]?s)?\b|\bb\.?\s?tech\b|\bb\.\s?e\b\.?|\bb\.?\s?sc\b|\bb\.\s?s\b\.?|\bbca\b|\bundergraduate degree\b/i,
  },
  { level: 1, label: 'Diploma', re: /\b(?:diploma|associate degree)\b/i },
];

// Every degree level mentioned in `text`: [{ level, label }]
export function detectDegrees(text) {
  if (!text) return [];
  return DEGREES.filter(({ re }) => re.test(text)).map(({ level, label }) => ({ level, label }));
}

export const highestDegree = (degrees) => degrees.reduce((best, d) => (!best || d.level > best.level ? d : best), null);
export const lowestDegree = (degrees) => degrees.reduce((best, d) => (!best || d.level < best.level ? d : best), null);

// ---- Years of experience: job descriptions ("3+ years", "3-5 years", "two years") ----

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*\+?)?\s*years?\b/gi;

// Returns [{ min, max, text }] for a line such as "3+ years of experience with Node.js".
export function extractYearsFromLine(line) {
  if (!/year/i.test(line) || !/experience/i.test(line)) return [];
  const normalized = line.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (w) => NUMBER_WORDS[w.toLowerCase()]);
  return [...normalized.matchAll(YEARS_RE)].map((m) => ({
    min: Number(m[1]),
    max: m[2] ? Number(m[2]) : null,
    text: line.slice(0, 160),
  }));
}

// ---- Years of experience: resumes ----

// "5 years of professional experience" written on the resume itself.
export function extractStatedYears(text) {
  const match = text?.match(/(\d{1,2})\+?\s*years?\s+(?:of\s+)?(?:[a-z-]+\s+){0,3}experience/i);
  return match ? Number(match[1]) : null;
}

const MONTH_TOKEN = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_TOKEN = `(?:${MONTH_TOKEN}\\s*,?\\s*)?(?:19|20)\\d{2}|\\d{1,2}[/.-](?:19|20)\\d{2}`;
const RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN}|present|current|now|ongoing|till date)`, 'gi');
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "Jan 2021" -> months since year 0. "Present" -> the current month.
function toMonthNumber(token, now) {
  if (/^(present|current|now|ongoing|till date)$/i.test(token.trim())) return now.getFullYear() * 12 + now.getMonth();
  const numeric = token.match(/^(\d{1,2})[/.-]((?:19|20)\d{2})$/);
  if (numeric) return Number(numeric[2]) * 12 + (Number(numeric[1]) - 1);
  const year = Number(token.match(/(?:19|20)\d{2}/)[0]);
  const month = token.match(/[a-z]{3}/i);
  return year * 12 + (month ? MONTH_INDEX[month[0].toLowerCase()] ?? 0 : 0);
}

// Adds up the date ranges in the experience section ("Jun 2022 - Present") without double counting overlaps.
// Returns years (one decimal) or null when no date range can be found. Never guesses.
export function estimateExperienceYears(experienceText, now = new Date()) {
  if (!experienceText) return null;

  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const intervals = [];
  for (const m of experienceText.matchAll(RANGE_RE)) {
    const start = toMonthNumber(m[1], now);
    const end = toMonthNumber(m[2], now);
    if (end >= start && Math.floor(start / 12) >= 1990 && end <= nowMonth + 12) intervals.push([start, end]);
  }
  if (!intervals.length) return null;

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0].slice()];
  for (const [start, end] of intervals.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const months = merged.reduce((sum, [start, end]) => sum + (end - start + 1), 0); // both end months count
  return Math.round((months / 12) * 10) / 10;
}
