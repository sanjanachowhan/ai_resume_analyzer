import { z } from 'zod';

// Validation for what the AI sends back. Lenient on extras, strict on the parts the app depends on.
const strings = z.array(z.string()).default([]);

// "high", "HIGH" and "High" are all accepted.
const importance = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase() : v),
  z.enum(['High', 'Medium', 'Low'])
);

export const pingSchema = z.object({ ok: z.boolean(), message: z.string() });

export const resumeParsingSchema = z.object({
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  skills: strings,
  education: z.array(z.object({ degree: z.string(), institution: z.string().nullable().default(null), year: z.string().nullable().default(null) })).default([]),
  experience: z
    .array(z.object({ title: z.string(), company: z.string().nullable().default(null), duration: z.string().nullable().default(null), highlights: strings }))
    .default([]),
  projects: z.array(z.object({ name: z.string(), description: z.string().nullable().default(null), technologies: strings })).default([]),
  certifications: strings,
});

export const jobParsingSchema = z.object({
  requiredSkills: strings,
  preferredSkills: strings,
  softSkills: strings,
  responsibilities: strings,
  yearsExperience: z.number().nullable().default(null),
  education: z.string().nullable().default(null),
  certifications: strings,
  keywords: strings,
});

export const gapAnalysisSchema = z.object({
  summary: z.string().min(1),
  strengths: strings,
  missingSkills: z
    .array(z.object({ skill: z.string(), importance, reason: z.string(), recommendation: z.string().default('') }))
    .default([]),
  weakSkills: z.array(z.object({ skill: z.string(), reason: z.string() })).default([]),
  missingQualifications: strings,
  missingExperienceAreas: strings,
  missingSoftSkills: strings,
  sectionsToImprove: z.array(z.object({ section: z.string(), reason: z.string() })).default([]),
  projectIdeas: strings,
  suggestions: strings,
});

export const improvementSchema = z.object({
  rewrites: z
    .array(z.object({ section: z.string(), current: z.string(), suggested: z.string(), note: z.string().default('') }))
    .default([]),
  summarySuggestion: z.string().nullable().default(null),
});

export const finalSummarySchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  topPriorities: strings,
});
