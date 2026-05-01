import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate';
import * as taskService from '../services/task.service';
import * as projectRepo from '../repositories/project.repository';

export async function listTasks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await taskService.listTasks(Number(req.params.projectId));
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await taskService.createTask(
      {
        projectId: Number(req.params.projectId),
        createdBy: req.user!.id,
        ...req.body,
      },
      req.user!.id
    );
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function getTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await taskService.getTask(
      Number(req.params.projectId),
      Number(req.params.taskId)
    );
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    const role = await projectRepo.getMemberRole(projectId, req.user!.id);
    const task = await taskService.updateTask(
      projectId,
      taskId,
      req.body,
      req.user!.id,
      role ?? 'member'
    );
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    const role = await projectRepo.getMemberRole(projectId, req.user!.id);
    await taskService.deleteTask(projectId, taskId, role ?? 'member');
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
