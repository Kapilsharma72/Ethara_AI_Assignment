import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate';
import * as projectService from '../services/project.service';
import * as taskService from '../services/task.service';

export async function listProjects(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projects = await projectService.listProjects(req.user!.id);
    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.createProject(req.body, req.user!.id);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.getProject(Number(req.params.projectId));
    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Accept either { email } or { userId } in the request body
    const emailOrUserId: string | number = req.body.userId
      ? Number(req.body.userId)
      : req.body.email;
    await projectService.addMember(Number(req.params.projectId), req.user!.id, emailOrUserId);
    res.status(200).json({ message: 'Member added successfully' });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.removeMember(
      Number(req.params.projectId),
      req.user!.id,
      Number(req.params.userId)
    );
    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verify the project exists (throws 404 if not)
    await projectService.getProject(Number(req.params.projectId));
    const stats = await taskService.getDashboardStats(Number(req.params.projectId));
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}
