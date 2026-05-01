/**
 * Unit Tests for Project Service
 *
 * Tests project creation, member management, and access control logic.
 */

import { AppError } from '../../errors/AppError';

// Mock repositories before importing the service
jest.mock('../../repositories/project.repository');
jest.mock('../../repositories/user.repository');

// Mock env config to avoid needing real environment variables
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars',
    PORT: '3000',
    DATABASE_URL: 'postgres://localhost/test',
    CLIENT_ORIGIN: 'http://localhost:5173',
  },
}));

import * as projectRepo from '../../repositories/project.repository';
import * as userRepo from '../../repositories/user.repository';
import * as projectService from '../../services/project.service';

const mockProjectRepo = projectRepo as jest.Mocked<typeof projectRepo>;
const mockUserRepo = userRepo as jest.Mocked<typeof userRepo>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

const mockProjectDetail: projectRepo.ProjectDetail = {
  id: 42,
  name: 'Test Project',
  description: null,
  createdAt: new Date(),
  members: [
    { userId: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  ],
  taskSummary: { total: 0, todo: 0, inProgress: 0, done: 0 },
};

const mockUser = {
  id: 2,
  name: 'Bob',
  email: 'bob@example.com',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date(),
};

const PROJECT_ID = 42;
const ADMIN_ID = 1;
const MEMBER_ID = 2;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getProject() ─────────────────────────────────────────────────────────────

describe('projectService.getProject()', () => {
  it('throws AppError 404 when project does not exist', async () => {
    // Arrange: findById returns null (project not found)
    mockProjectRepo.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(projectService.getProject(999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Project not found',
    });

    expect(mockProjectRepo.findById).toHaveBeenCalledWith(999);
  });

  it('returns project detail when project exists', async () => {
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);

    const result = await projectService.getProject(PROJECT_ID);

    expect(result).toEqual(mockProjectDetail);
    expect(mockProjectRepo.findById).toHaveBeenCalledWith(PROJECT_ID);
  });
});

// ─── addMember() ──────────────────────────────────────────────────────────────

describe('projectService.addMember()', () => {
  it('throws AppError 409 when user is already a member of the project', async () => {
    // Arrange: project exists, user exists, getMemberRole returns an existing role
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    mockProjectRepo.getMemberRole.mockResolvedValue('member');

    // Act & Assert
    await expect(
      projectService.addMember(PROJECT_ID, ADMIN_ID, mockUser.email)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'User is already a member',
    });

    expect(mockProjectRepo.getMemberRole).toHaveBeenCalledWith(PROJECT_ID, mockUser.id);
    // addMember on the repo should never be called when user is already a member
    expect(mockProjectRepo.addMember).not.toHaveBeenCalled();
  });

  it('throws AppError 404 when the email does not match any user', async () => {
    // Arrange: project exists, but userRepo.findByEmail returns null
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);
    mockUserRepo.findByEmail.mockResolvedValue(null);

    // Act & Assert
    await expect(
      projectService.addMember(PROJECT_ID, ADMIN_ID, 'unknown@test.com')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('unknown@test.com');
    expect(mockProjectRepo.getMemberRole).not.toHaveBeenCalled();
    expect(mockProjectRepo.addMember).not.toHaveBeenCalled();
  });

  it('throws AppError 404 when the project does not exist', async () => {
    mockProjectRepo.findById.mockResolvedValue(null);

    await expect(
      projectService.addMember(999, ADMIN_ID, mockUser.email)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Project not found',
    });

    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('successfully adds a new member when all conditions are met', async () => {
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    mockProjectRepo.getMemberRole.mockResolvedValue(null);
    mockProjectRepo.addMember.mockResolvedValue(undefined);

    await expect(
      projectService.addMember(PROJECT_ID, ADMIN_ID, mockUser.email)
    ).resolves.toBeUndefined();

    expect(mockProjectRepo.addMember).toHaveBeenCalledWith(PROJECT_ID, mockUser.id, 'member');
  });
});

// ─── removeMember() ───────────────────────────────────────────────────────────

describe('projectService.removeMember()', () => {
  it('throws AppError 404 when target user is not a member of the project', async () => {
    // Arrange: project exists, getMemberRole returns null for the target
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);
    mockProjectRepo.getMemberRole.mockResolvedValue(null);

    // Act & Assert
    await expect(
      projectService.removeMember(PROJECT_ID, ADMIN_ID, MEMBER_ID)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User is not a member of this project',
    });

    expect(mockProjectRepo.getMemberRole).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(mockProjectRepo.removeMember).not.toHaveBeenCalled();
  });

  it('throws AppError 403 when admin tries to remove themselves', async () => {
    // Arrange: project exists, adminId === targetUserId
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);

    // Act & Assert: pass adminId as both adminId and targetUserId
    await expect(
      projectService.removeMember(PROJECT_ID, ADMIN_ID, ADMIN_ID)
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Cannot remove yourself from the project',
    });

    // Self-removal check happens before the member role lookup
    expect(mockProjectRepo.removeMember).not.toHaveBeenCalled();
  });

  it('throws AppError 404 when the project does not exist', async () => {
    mockProjectRepo.findById.mockResolvedValue(null);

    await expect(
      projectService.removeMember(999, ADMIN_ID, MEMBER_ID)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Project not found',
    });

    expect(mockProjectRepo.getMemberRole).not.toHaveBeenCalled();
  });

  it('successfully removes a member when all conditions are met', async () => {
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);
    mockProjectRepo.getMemberRole.mockResolvedValue('member');
    mockProjectRepo.removeMember.mockResolvedValue(undefined);

    await expect(
      projectService.removeMember(PROJECT_ID, ADMIN_ID, MEMBER_ID)
    ).resolves.toBeUndefined();

    expect(mockProjectRepo.removeMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
  });

  it('throws AppError with correct type for self-removal', async () => {
    mockProjectRepo.findById.mockResolvedValue(mockProjectDetail);

    try {
      await projectService.removeMember(PROJECT_ID, ADMIN_ID, ADMIN_ID);
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });
});
