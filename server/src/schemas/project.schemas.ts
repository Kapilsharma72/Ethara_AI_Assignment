import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
});

export const AddMemberSchema = z.object({
  email: z.string().email().optional(),
  userId: z.number().int().positive().optional(),
}).refine((data) => data.email || data.userId, {
  message: 'Either email or userId is required',
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
