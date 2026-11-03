import { z } from 'zod';

const ids = {
  resumeId: z.string().min(1, 'Choose a resume'),
  jobId: z.string().min(1, 'Choose a job description'),
};

export const previewSchema = z.object(ids);

export const analyzeSchema = z.object({
  ...ids,
  force: z.boolean().optional().default(false), // true = run the AI again even if a saved result exists
});
