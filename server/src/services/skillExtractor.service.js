import { SKILLS, SOFT_SKILLS, CERTIFICATIONS } from '../data/skillsDictionary.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPattern = (alias) => escapeRegExp(alias).replace(/\s+/g, '\\s+');
const byLengthDesc = (a, b) => b.length - a.length;
const alternation = (list) => [...list].sort(byLengthDesc).map(toPattern).join('|');

// Turns one dictionary entry into regular expressions (compiled once, reused for every text).
function compile({ aliases = [], exact = [], strict = [] }) {
  const regexes = [];
  if (aliases.length) {
    regexes.push(new RegExp(`(?<![a-z0-9+#])(?:${alternation(aliases)})(?![a-z0-9+#])`, 'i'));
  }
  if (exact.length) {
    regexes.push(new RegExp(`(?<![A-Za-z0-9+#])(?:${alternation(exact)})(?![A-Za-z0-9+#])`));
  }
  if (strict.length) {
    regexes.push(new RegExp(`(?:^|[\\s,;|/(•*:-])(?:${alternation(strict)})(?=\\s*(?:[,;|/)•]|$))`, 'm'));
  }
  return regexes;
}

const COMPILED_SKILLS = SKILLS.map((skill) => ({ skill, regexes: compile(skill) }));
const COMPILED_SOFT = SOFT_SKILLS.map((skill) => ({ skill, regexes: compile(skill) }));
const COMPILED_CERTS = CERTIFICATIONS.map((skill) => ({ skill, regexes: compile(skill) }));

function findAll(compiled, text) {
  if (!text) return [];
  const found = [];
  for (const { skill, regexes } of compiled) {
    let first = Infinity;
    for (const re of regexes) {
      const match = re.exec(text);
      if (match && match.index < first) first = match.index;
    }
    if (first !== Infinity) found.push({ skill, index: first });
  }
  return found.sort((a, b) => a.index - b.index);
}

// Technical skills found in `text`, in order of first appearance: [{ name, category }]
export function extractSkills(text) {
  return findAll(COMPILED_SKILLS, text).map(({ skill }) => ({ name: skill.name, category: skill.category }));
}

export function extractSoftSkills(text) {
  return findAll(COMPILED_SOFT, text).map(({ skill }) => skill.name);
}

export function extractCertifications(text) {
  return findAll(COMPILED_CERTS, text).map(({ skill }) => skill.name);
}
