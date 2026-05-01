import * as projectRepo from '../repositories/project.repository';
import * as userRepo from '../repositories/user.repository';
import { AppError } from '../errors/AppError';
import type { ProjectSummary, ProjectDetail } from '../repositories/project.repository';

/**
 * Returns all projects the given user belongs to.
 */
export async function listProjects(userId: number): Promise<ProjectSummary[]> {
  return projectRepo.findAllForUser(userId);
}

/**
 * Returns a project by ID. Throws 404 if not found.
 */
export async function getProject(projectId: number): Promise<ProjectDetail> {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  return project;
}

/**
 * Creates a new project with the given user as admin.
 */
export async function createProject(
  data: { name: string; description?: string },
  creatorId: number
): Promise<ProjectSummary> {
  return projectRepo.create(data, creatorId);
}

/**
 * Adds a user to a project as a member.
 * Accepts either an email string or a numeric userId.
 * Throws:
 *   - 404 if the project is not found
 *   - 404 if no user exists with the given email/id
 *   - 409 if the user is already a member of the project
 */
export async function addMember(
  projectId: number,
  adminId: number,
  emailOrUserId: string | number
): Promise<void> {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  const user = typeof emailOrUserId === 'number'
    ? await userRepo.findById(emailOrUserId)
    : await userRepo.findByEmail(emailOrUserId);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const existingRole = await projectRepo.getMemberRole(projectId, user.id);
  if (existingRole !== null) {
    throw new AppError(409, 'User is already a member');
  }

  await projectRepo.addMember(projectId, user.id, 'member');
}

/**
 * Removes a member from a project.
 * Throws:
 *   - 404 if the project is not found
 *   - 403 if the admin tries to remove themselves
 *   - 404 if the target user is not a member of the project
 */
export async function removeMember(
  projectId: number,
  adminId: number,
  targetUserId: number
): Promise<void> {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (adminId === targetUserId) {
    throw new AppError(403, 'Cannot remove yourself from the project');
  }

  const targetRole = await projectRepo.getMemberRole(projectId, targetUserId);
  if (targetRole === null) {
    throw new AppError(404, 'User is not a member of this project');
  }

  await projectRepo.removeMember(projectId, targetUserId);
}

/**
 * Returns the project detail for the dashboard view.
 * Throws 404 if the project is not found.
 */
export async function getDashboard(projectId: number): Promise<ProjectDetail> {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  return project;
}
