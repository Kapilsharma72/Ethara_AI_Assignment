import * as taskRepo from '../repositories/task.repository';
import * as projectRepo from '../repositories/project.repository';
import { AppError } from '../errors/AppError';
import type { Task } from '../repositories/task.repository';
import type { UpdateTaskInput } from '../schemas/task.schemas';

/**
 * Returns all tasks for a project.
 */
export async function listTasks(projectId: number): Promise<Task[]> {
  return taskRepo.findAllByProject(projectId);
}

/**
 * Returns a single task by project and task ID.
 * Throws 404 if not found.
 */
export async function getTask(projectId: number, taskId: number): Promise<Task> {
  const task = await taskRepo.findById(projectId, taskId);
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  return task;
}

/**
 * Creates a new task.
 * If assigneeId is provided, verifies the assignee is a project member (422 if not).
 */
export async function createTask(
  data: {
    projectId: number;
    createdBy: number;
    title: string;
    description?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
    assigneeId?: number | null;
  },
  requesterId: number
): Promise<Task> {
  if (data.assigneeId != null) {
    const role = await projectRepo.getMemberRole(data.projectId, data.assigneeId);
    if (role === null) {
      throw new AppError(422, 'Assignee must be a project member');
    }
  }

  return taskRepo.create({
    ...data,
    assigneeId: data.assigneeId ?? undefined,
  });
}

/**
 * Updates a task with role-based field restrictions.
 *
 * Role rules:
 *   - admin: can update any field
 *   - member + assignee: can ONLY update `status`; other fields → 403
 *   - member + not assignee: 403
 *
 * If assigneeId is being updated, verifies the new assignee is a project member (422 if not).
 * Throws 404 if the task is not found.
 */
export async function updateTask(
  projectId: number,
  taskId: number,
  fields: UpdateTaskInput,
  requesterId: number,
  requesterRole: string
): Promise<Task> {
  const task = await getTask(projectId, taskId);

  if (requesterRole === 'admin') {
    // Admin can update any field — no restrictions
  } else if (requesterRole === 'member' && task.assigneeId === requesterId) {
    // Member who is the assignee: can only update status
    const nonStatusKeys = Object.keys(fields).filter(k => k !== 'status');
    if (nonStatusKeys.length > 0) {
      throw new AppError(403, 'Members can only update the status of their assigned tasks');
    }
  } else {
    // Member who is not the assignee
    throw new AppError(403, 'Access denied: you can only update tasks assigned to you');
  }

  // If assigneeId is being changed, verify the new assignee is a project member
  if ('assigneeId' in fields && fields.assigneeId != null) {
    const role = await projectRepo.getMemberRole(projectId, fields.assigneeId);
    if (role === null) {
      throw new AppError(422, 'Assignee must be a project member');
    }
  }

  const updated = await taskRepo.update(taskId, fields);
  if (!updated) {
    throw new AppError(404, 'Task not found');
  }
  return updated;
}

/**
 * Deletes a task.
 * Only admins can delete tasks (403 for non-admins).
 * Throws 404 if the task is not found.
 */
export async function deleteTask(
  projectId: number,
  taskId: number,
  requesterRole: string
): Promise<void> {
  await getTask(projectId, taskId);

  if (requesterRole !== 'admin') {
    throw new AppError(403, 'Only admins can delete tasks');
  }

  await taskRepo.deleteTask(taskId);
}

/**
 * Returns dashboard statistics for a project.
 */
export async function getDashboardStats(projectId: number) {
  return taskRepo.getDashboardStats(projectId);
}
