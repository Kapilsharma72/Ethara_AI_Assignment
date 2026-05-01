import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z
    .string()
    .refine(
      (val) => new Date(val) >= new Date(new Date().toDateString()),
      { message: 'Due date must be today or a future date' }
    )
    .optional(),
  priority: z.enum(['Low', 'Medium', 'High']),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  status: z.enum(['To Do', 'In Progress', 'Done']).optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
