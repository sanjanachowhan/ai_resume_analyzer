import { SCORING } from '../config/matching.js';
import { IMPLIES, RELATED_GROUPS } from '../data/skillRelations.js';

const importanceWeight = (importance) =>
  importance === 'preferred' ? SCORING.preferredSkillWeight : SCORING.requiredSkillWeight;

// Skills listed in a "Skills" section but never used in a job, project, etc. are weaker evidence.
const isWeakEvidence = (skill) => skill.evidence?.length > 0 && skill.evidence.every((e) => e === 'skills');

function findRelated(skillName, resumeByName) {
  for (const group of RELATED_GROUPS) {
    if (!group.includes(skillName)) continue;
    const related = group.find((other) => other !== skillName && resumeByName.has(other));
    if (related) return related;
  }
  return null;
}

// jobSkills:    [{ name, importance: 'required' | 'preferred' }]
// resumeSkills: [{ name, evidence }]
export function matchSkills(jobSkills, resumeSkills) {
  const resumeByName = new Map(resumeSkills.map((s) => [s.name, s]));

  // Skills the resume proves indirectly (PostgreSQL proves SQL).
  const implied = new Map();
  for (const skill of resumeSkills) {
    for (const target of IMPLIES[skill.name] ?? []) {
      if (!resumeByName.has(target) && !implied.has(target)) implied.set(target, skill.name);
    }
  }

  const matched = [];
  const partial = [];
  const missing = [];
  const used = new Set(); // resume skills that explain at least one job skill
  let earned = 0;
  let total = 0;

  for (const job of jobSkills) {
    const weight = importanceWeight(job.importance);
    total += weight;

    if (resumeByName.has(job.name)) {
      const resumeSkill = resumeByName.get(job.name);
      matched.push({ skill: job.name, importance: job.importance, weakEvidence: isWeakEvidence(resumeSkill) });
      used.add(job.name);
      earned += weight;
    } else if (implied.has(job.name)) {
      const source = implied.get(job.name);
      matched.push({ skill: job.name, importance: job.importance, via: `implied by ${source}` });
      used.add(source);
      earned += weight;
    } else {
      const related = findRelated(job.name, resumeByName);
      if (related) {
        partial.push({ skill: job.name, importance: job.importance, relatedTo: related });
        used.add(related);
        earned += weight * SCORING.partialCredit;
      } else {
        missing.push({ skill: job.name, importance: job.importance });
      }
    }
  }

  const jobNames = new Set(jobSkills.map((s) => s.name));
  const additional = resumeSkills.filter((s) => !jobNames.has(s.name) && !used.has(s.name)).map((s) => s.name);

  // Required gaps first: they matter most.
  const byImportance = (a, b) => (a.importance === b.importance ? 0 : a.importance === 'required' ? -1 : 1);
  missing.sort(byImportance);
  partial.sort(byImportance);

  return {
    score: total === 0 ? null : Math.round((earned / total) * 100),
    matched,
    partial,
    missing,
    additional,
    // Everything the resume demonstrates, directly or by implication (used for keyword matching).
    resumeSkillNames: new Set([...resumeByName.keys(), ...implied.keys()]),
  };
}
