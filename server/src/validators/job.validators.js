import { z } from 'zod';
import { cleanText } from '../utils/textCleaner.js';

export const MAX_JOB_DESCRIPTION_LENGTH = 20000;

export const createJobSchema = z.object({
  title: z.string().trim().min(2, 'Job title must be at least 2 characters').max(120, 'Job title is too long'),
  company: z
    .string()
    .trim()
    .max(120, 'Company name is too long')
    .optional()
    .transform((value) => value || null),
  // Normalize pasted text first, then check its length.
  description: z
    .string()
    .max(100000, 'Job description is too long')
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(1, 'Job description is required')
        .min(50, 'Job description is too short (at least 50 characters)')
        .max(MAX_JOB_DESCRIPTION_LENGTH, 'Job description is too long (maximum 20,000 characters)')
    ),
});
