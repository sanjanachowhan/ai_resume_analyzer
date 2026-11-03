// Adds skill/requirement extraction to resumes and job descriptions saved BEFORE Phase 6.
//   npm run backfill            (only records that are missing it)
//   npm run backfill -- --force (recompute everything, e.g. after editing the skills dictionary)
import { prisma } from '../src/config/prisma.js';
import { buildResumeProfile } from '../src/services/resumeProfile.service.js';
import { analyzeJobDescription } from '../src/services/jobAnalyzer.service.js';

const force = process.argv.includes('--force');
let resumeCount = 0;
let jobCount = 0;

try {
  for (const resume of await prisma.resume.findMany()) {
    if (!force && resume.parsedData?.profile) continue;
    const sections = resume.parsedData ?? {};
    await prisma.resume.update({
      where: { id: resume.id },
      data: { parsedData: { ...sections, profile: buildResumeProfile(resume.rawText, sections) } },
    });
    resumeCount++;
  }

  for (const job of await prisma.jobDescription.findMany()) {
    if (!force && job.parsedData?.version) continue;
    await prisma.jobDescription.update({
      where: { id: job.id },
      data: { parsedData: analyzeJobDescription(job.description) },
    });
    jobCount++;
  }

  console.log(`Updated ${resumeCount} resume(s) and ${jobCount} job description(s).`);
} finally {
  await prisma.$disconnect();
}
