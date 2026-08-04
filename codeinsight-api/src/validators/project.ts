import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').trim(),
  githubUrl: z
    .string()
    .trim()
    .url('Invalid GitHub repository URL')
    .or(z.literal(''))
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
  isDemoRepository: z.boolean().optional().default(false),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
