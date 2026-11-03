import { calculateMatch } from './scoreCalculator.service.js';
import { analyzeJobDescription } from './jobAnalyzer.service.js';
import { buildResumeProfile } from './resumeProfile.service.js';
import { gapAnalysisPrompt, improvementPrompt, finalSummaryPrompt } from '../ai/promptTemplates.js';
import { gapAnalysisSchema, improvementSchema, finalSummarySchema } from '../ai/schemas.js';
import { buildMissingSkills, buildWeakSkills, filterRewrites, fallbackSuggestions } from '../ai/guardrails.js';
import { AppError } from '../utils/AppError.js';

const errorInfo = (err) => ({
  code: err?.code ?? 'AI_ERROR',
  message: err?.isOperational ? err.message : 'The AI step failed. Please try again.',
});

const callInfo = (task, meta) => ({
  task,
  attempts: meta.attempts,
  inputTokens: meta.usage?.inputTokens ?? null,
  outputTokens: meta.usage?.outputTokens ?? null,
});

// Turns a saved Analysis row into the shape the API returns.
export function shapeAnalysis(row, resume, job) {
  const details = row.matchDetails ?? {};
  return {
    id: row.id,
    createdAt: row.createdAt,
    resume: { id: resume.id, fileName: resume.fileName },
    job: { id: job.id, title: job.title, company: job.company },
    scores: {
      overall: row.overallScore,
      skills: row.skillScore,
      keywords: row.keywordScore,
      experience: row.experienceScore,
      education: row.educationScore,
      responsibilities: row.responsibilityScore,
      softSkills: row.softSkillScore,
    },
    components: details.components ?? null,
    skills: {
      matched: row.matchedSkills,
      partial: details.partial ?? [],
      missing: row.missingSkills,
      additional: details.additional ?? [],
      weak: details.weakSkills ?? [],
    },
    keywords: details.keywords ?? { matched: [], missing: [] },
    responsibilities: details.responsibilities ?? [],
    softSkills: details.softSkills ?? { matched: [], missing: [] },
    ai: row.aiAnalysis ?? null,
    aiAvailable: Boolean(row.aiAnalysis),
    suggestions: row.suggestions,
    aiMeta: row.aiMeta ?? null,
  };
}

// db and ai are injected so the pipeline can be tested without a database or a real AI.
export function createAnalysisService({ db, ai }) {
  const inFlight = new Map();

  async function runAiStages({ resume, job, match, requirements, profile }) {
    const started = Date.now();

    let provider;
    try {
      provider = await ai.getProvider();
    } catch (err) {
      return { error: errorInfo(err) };
    }
    if (!provider.isConfigured()) {
      return { error: { code: 'AI_NOT_CONFIGURED', message: 'AI insights are not available because no AI API key is set on the server.' } };
    }

    const names = (list) => list.map((item) => item.skill);
    const base = { resumeText: resume.rawText, jobText: job.description };

    // Stage 1: gap analysis and resume rewrites are independent, so they run together.
    const [gapResult, rewriteResult] = await Promise.allSettled([
      ai.generateStructured({
        provider,
        schema: gapAnalysisSchema,
        prompt: gapAnalysisPrompt({
          ...base,
          resumeSkills: profile.skills.map((s) => s.name),
          jobRequirements: requirements,
          matched: names(match.skills.matched),
          partial: names(match.skills.partial),
          missing: names(match.skills.missing),
        }),
      }),
      ai.generateStructured({
        provider,
        schema: improvementSchema,
        prompt: improvementPrompt({ ...base, missing: names(match.skills.missing) }),
      }),
    ]);

    // Without the gap analysis there is nothing useful to add; the score report is still saved.
    if (gapResult.status === 'rejected') return { error: errorInfo(gapResult.reason) };

    const warnings = [];
    const calls = [callInfo('gap_analysis', gapResult.value.meta)];
    const gap = gapResult.value.data;

    let improvements = null;
    if (rewriteResult.status === 'fulfilled') {
      const { kept, dropped } = filterRewrites(rewriteResult.value.data.rewrites, resume.rawText);
      improvements = { rewrites: kept, summarySuggestion: rewriteResult.value.data.summarySuggestion };
      calls.push(callInfo('improvements', rewriteResult.value.meta));
      if (dropped) warnings.push(`${dropped} suggested rewrite(s) were discarded because they were not based on your resume's actual content.`);
    } else {
      warnings.push('Resume rewrite suggestions are unavailable right now.');
    }

    const missing = buildMissingSkills(match.skills.missing, gap.missingSkills);
    const suggestions = gap.suggestions.length ? gap.suggestions : fallbackSuggestions(match.skills.missing);

    // Stage 2: the final summary builds on the gap analysis.
    let summary = null;
    try {
      const result = await ai.generateStructured({
        provider,
        schema: finalSummarySchema,
        prompt: finalSummaryPrompt({
          overallScore: match.overallScore,
          components: match.components,
          strengths: gap.strengths,
          missing: names(match.skills.missing),
          suggestions,
        }),
      });
      summary = result.data;
      calls.push(callInfo('final_summary', result.meta));
    } catch {
      warnings.push('The final summary could not be generated.');
    }

    return {
      gap,
      improvements,
      summary,
      missing,
      suggestions,
      meta: {
        provider: provider.name,
        model: gapResult.value.meta.model ?? null,
        durationMs: Date.now() - started,
        calls,
        warnings,
        error: null,
      },
    };
  }

  async function execute(userId, { resumeId, jobId, force = false }) {
    // Both lookups are filtered by userId: users can only analyze their own data.
    const [resume, job] = await Promise.all([
      db.resume.findFirst({ where: { id: resumeId, userId } }),
      db.jobDescription.findFirst({ where: { id: jobId, userId } }),
    ]);
    if (!resume) throw new AppError('Resume not found.', 404, 'NOT_FOUND');
    if (!job) throw new AppError('Job description not found.', 404, 'NOT_FOUND');

    // The same resume and job are never sent to the AI twice, unless the user asks for a re-run.
    const existing = await db.analysis.findFirst({
      where: { userId, resumeId, jobDescriptionId: jobId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.aiProvider && !force) {
      return { analysis: shapeAnalysis(existing, resume, job), cached: true };
    }

    const requirements = job.parsedData?.version ? job.parsedData : analyzeJobDescription(job.description);
    const profile = resume.parsedData?.profile ?? buildResumeProfile(resume.rawText, resume.parsedData ?? {});

    const match = calculateMatch({ resume, job });
    if (match.overallScore === null) {
      throw new AppError(
        "This job description doesn't contain enough recognizable requirements to analyze. Try saving the full job posting.",
        422,
        'INSUFFICIENT_REQUIREMENTS'
      );
    }

    const aiResult = await runAiStages({ resume, job, match, requirements, profile });

    const weakSkills = buildWeakSkills(match.skills.matched, aiResult.gap?.weakSkills, profile.skills.map((s) => s.name));

    const data = {
      overallScore: match.overallScore,
      skillScore: match.skillScore,
      keywordScore: match.keywordScore,
      experienceScore: match.experienceScore,
      educationScore: match.educationScore,
      responsibilityScore: match.responsibilityScore,
      softSkillScore: match.softSkillScore,
      matchedSkills: match.skills.matched,
      missingSkills: aiResult.missing ?? buildMissingSkills(match.skills.missing, []),
      suggestions: aiResult.suggestions ?? fallbackSuggestions(match.skills.missing),
      matchDetails: {
        engineVersion: match.engineVersion,
        components: match.components,
        weights: match.weights,
        partial: match.skills.partial,
        additional: match.skills.additional,
        weakSkills,
        keywords: match.keywords,
        responsibilities: match.responsibilities,
        softSkills: match.softSkills,
      },
      aiMeta: aiResult.meta ?? { provider: null, error: aiResult.error },
      // The AI fields stay empty when the AI step failed, so a later request tries the AI again.
      ...(aiResult.gap && {
        aiAnalysis: { gap: aiResult.gap, improvements: aiResult.improvements, summary: aiResult.summary },
        aiProvider: aiResult.meta.provider,
      }),
    };

    // A score-only row left by an earlier AI failure is completed instead of duplicated.
    const reusable = existing && !existing.aiProvider ? existing : null;
    const row = reusable
      ? await db.analysis.update({ where: { id: reusable.id }, data })
      : await db.analysis.create({ data: { userId, resumeId, jobDescriptionId: jobId, ...data } });

    return { analysis: shapeAnalysis(row, resume, job), cached: false };
  }

  // Two identical requests at the same moment (a double click) share one run.
  function runAnalysis(userId, input) {
    const key = `${userId}:${input.resumeId}:${input.jobId}:${Boolean(input.force)}`;
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = execute(userId, input).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  return { runAnalysis };
}

// Loads one saved analysis for its owner. Filtering by userId means nobody can open someone else's report.
export async function getAnalysisForUser(db, userId, id) {
  const row = await db.analysis.findFirst({
    where: { id, userId },
    include: {
      resume: { select: { id: true, fileName: true } },
      jobDescription: { select: { id: true, title: true, company: true } },
    },
  });
  if (!row) throw new AppError('Analysis not found.', 404, 'NOT_FOUND');
  return shapeAnalysis(row, row.resume, row.jobDescription);
}
