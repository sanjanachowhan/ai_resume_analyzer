import { prisma } from '../src/config/prisma.js';

async function main() {
  const email = `smoke-${Date.now()}@example.com`;

  // 1. Create a user with a resume, job description and analysis
  const user = await prisma.user.create({
    data: { name: 'Smoke Test', email, passwordHash: 'not-a-real-hash' },
  });

  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      fileName: 'resume.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      rawText: 'React, Node.js, PostgreSQL developer.',
      contentHash: 'test-hash',
      parsedData: { skills: 'React, Node.js, PostgreSQL' },
    },
  });

  const job = await prisma.jobDescription.create({
    data: {
      userId: user.id,
      title: 'Full Stack Developer',
      company: 'Acme',
      description: 'Requires React, Node.js and AWS.',
      parsedData: { requiredSkills: ['React', 'Node.js', 'AWS'] },
    },
  });

  const analysis = await prisma.analysis.create({
    data: {
      userId: user.id,
      resumeId: resume.id,
      jobDescriptionId: job.id,
      overallScore: 78,
      skillScore: 82,
      keywordScore: 75,
      experienceScore: 80,
      educationScore: 100,
      responsibilityScore: 70,
      softSkillScore: 65,
      matchedSkills: ['React', 'Node.js'],
      missingSkills: [{ skill: 'AWS', importance: 'High' }],
      suggestions: ['Add an AWS deployment project.'],
      aiProvider: 'openai',
    },
    include: { resume: true, jobDescription: true },
  });

  console.log('OK  relations:', analysis.resume.fileName, '->', analysis.jobDescription.title);
  console.log('OK  json:', JSON.stringify(analysis.missingSkills));

  // 2. Deleting the user should cascade to everything they own
  await prisma.user.delete({ where: { id: user.id } });
  const remaining =
    (await prisma.resume.count({ where: { id: resume.id } })) +
    (await prisma.jobDescription.count({ where: { id: job.id } })) +
    (await prisma.analysis.count({ where: { id: analysis.id } }));

  console.log(remaining === 0 ? 'OK  cascade delete' : 'FAIL cascade delete');
  process.exitCode = remaining === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());