/**
 * Unit Tests for Task Service
 *
 * Tests task creation, role-based update restrictions, deletion, and dashboard stats.
 */

import { AppError } from '../../errors/AppError';

// Mock repositories before importing the service
jest.mock('../../repositories/task.repository');
jest.mock('../../repositories/project.repository');

// Mock env config to avoid needing real environment variables
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars',
    PORT: '3000',
    DATABASE_URL: 'postgres://localhost/test',
    CLIENT_ORIGIN: 'http://localhost:5173',
  },
}));

import * as taskRepo from '../../repositories/task.repository';
import * as projectRepo from '../../repositories/project.repository';
import * as taskService from '../../services/task.service';
import type { Task } from '../../repositories/task.repository';

const mockTaskRepo = taskRepo as jest.Mocked<typeof taskRepo>;
const mockProjectRepo = projectRepo as jest.Mocked<typeof projectRepo>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

const PROJECT_ID = 42;
const TASK_ID = 101;
const ADMIN_ID = 1;
const MEMBER_ID = 2;
const OTHER_USER_ID = 999;

const mockTask: Task = {
  id: TASK_ID,
  projectId: PROJECT_ID,
  createdBy: ADMIN_ID,
  assigneeId: MEMBER_ID,
  assigneeName: 'Bob',
  title: 'Design homepage mockup',
  description: 'Create Figma wireframes',
  dueDate: '2024-12-01',
  priority: 'High',
  status: 'To Do',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createTask() ─────────────────────────────────────────────────────────────

describe('taskService.createTask()', () => {
  it('throws AppError 422 when assignee is not a project member', async () => {
    // Arrange: getMemberRole returns null for the assignee (not a member)
    mockProjectRepo.getMemberRole.mockResolvedValue(null);

    // Act & Assert
    await expect(
      taskService.createTask(
        {
          projectId: PROJECT_ID,
          createdBy: ADMIN_ID,
          title: 'New Task',
          priority: 'Medium',
          assigneeId: OTHER_USER_ID,
        },
        ADMIN_ID
      )
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'Assignee must be a project member',
    });

    expect(mockProjectRepo.getMemberRole).toHaveBeenCalledWith(PROJECT_ID, OTHER_USER_ID);
    // taskRepo.create should never be called when assignee is not a member
    expect(mockTaskRepo.create).not.toHaveBeenCalled();
  });

  it('creates task successfully when assignee is a project member', async () => {
    // Arrange: getMemberRole returns a role for the assignee
    mockProjectRepo.getMemberRole.mockResolvedValue('member');
    mockTaskRepo.create.mockResolvedValue(mockTask);

    // Act
    const result = await taskService.createTask(
      {
        projectId: PROJECT_ID,
        createdBy: ADMIN_ID,
        title: 'New Task',
        priority: 'Medium',
        assigneeId: MEMBER_ID,
      },
      ADMIN_ID
    );

    // Assert
    expect(result).toEqual(mockTask);
    expect(mockProjectRepo.getMemberRole).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(mockTaskRepo.create).toHaveBeenCalled();
  });

  it('creates task without assignee without checking membership', async () => {
    // Arrange: no assigneeId provided
    const taskWithoutAssignee: Task = { ...mockTask, assigneeId: null, assigneeName: null };
    mockTaskRepo.create.mockResolvedValue(taskWithoutAssignee);

    // Act
    const result = await taskService.createTask(
      {
        projectId: PROJECT_ID,
        createdBy: ADMIN_ID,
        title: 'Unassigned Task',
        priority: 'Low',
      },
      ADMIN_ID
    );

    // Assert
    expect(result).toEqual(taskWithoutAssignee);
    // getMemberRole should NOT be called when there is no assignee
    expect(mockProjectRepo.getMemberRole).not.toHaveBeenCalled();
    expect(mockTaskRepo.create).toHaveBeenCalled();
  });

  it('throws AppError with correct type for non-member assignee', async () => {
    mockProjectRepo.getMemberRole.mockResolvedValue(null);

    try {
      await taskService.createTask(
        {
          projectId: PROJECT_ID,
          createdBy: ADMIN_ID,
          title: 'Task',
          priority: 'Low',
          assigneeId: OTHER_USER_ID,
        },
        ADMIN_ID
      );
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(422);
    }
  });
});

// ─── updateTask() ─────────────────────────────────────────────────────────────

describe('taskService.updateTask()', () => {
  it('throws AppError 403 when member tries to edit a non-status field on their assigned task', async () => {
    // Arrange: task exists and assigneeId === memberId
    mockTaskRepo.findById.mockResolvedValue(mockTask); // mockTask.assigneeId === MEMBER_ID

    // Act & Assert: member tries to update title (non-status field)
    await expect(
      taskService.updateTask(
        PROJECT_ID,
        TASK_ID,
        { title: 'New Title' },
        MEMBER_ID,
        'member'
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Members can only update the status of their assigned tasks',
    });

    // taskRepo.update should never be called when access is denied
    expect(mockTaskRepo.update).not.toHaveBeenCalled();
  });

  it('throws AppError 403 when member tries to edit a task not assigned to them', async () => {
    // Arrange: task exists but assigneeId !== requesterId
    const taskAssignedToOther: Task = { ...mockTask, assigneeId: ADMIN_ID };
    mockTaskRepo.findById.mockResolvedValue(taskAssignedToOther);

    // Act & Assert: member (MEMBER_ID) tries to update a task assigned to ADMIN_ID
    await expect(
      taskService.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'In Progress' },
        MEMBER_ID,
        'member'
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Access denied: you can only update tasks assigned to you',
    });

    expect(mockTaskRepo.update).not.toHaveBeenCalled();
  });

  it('allows member to update only status on their assigned task', async () => {
    // Arrange: task exists and assigneeId === MEMBER_ID
    mockTaskRepo.findById.mockResolvedValue(mockTask);
    const updatedTask: Task = { ...mockTask, status: 'In Progress' };
    mockTaskRepo.update.mockResolvedValue(updatedTask);

    // Act
    const result = await taskService.updateTask(
      PROJECT_ID,
      TASK_ID,
      { status: 'In Progress' },
      MEMBER_ID,
      'member'
    );

    // Assert
    expect(result).toEqual(updatedTask);
    expect(mockTaskRepo.update).toHaveBeenCalledWith(TASK_ID, { status: 'In Progress' });
  });

  it('allows admin to update any field', async () => {
    // Arrange: task exists
    mockTaskRepo.findById.mockResolvedValue(mockTask);
    const updatedTask: Task = { ...mockTask, title: 'New Title', priority: 'Low' };
    mockTaskRepo.update.mockResolvedValue(updatedTask);

    // Act
    const result = await taskService.updateTask(
      PROJECT_ID,
      TASK_ID,
      { title: 'New Title', priority: 'Low' },
      ADMIN_ID,
      'admin'
    );

    // Assert
    expect(result).toEqual(updatedTask);
    expect(mockTaskRepo.update).toHaveBeenCalledWith(TASK_ID, { title: 'New Title', priority: 'Low' });
  });

  it('throws AppError 403 with correct type for member editing non-status field', async () => {
    mockTaskRepo.findById.mockResolvedValue(mockTask);

    try {
      await taskService.updateTask(
        PROJECT_ID,
        TASK_ID,
        { title: 'New' },
        MEMBER_ID,
        'member'
      );
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });
});

// ─── deleteTask() ─────────────────────────────────────────────────────────────

describe('taskService.deleteTask()', () => {
  it('throws AppError 403 when a member tries to delete a task', async () => {
    // Arrange: task exists
    mockTaskRepo.findById.mockResolvedValue(mockTask);

    // Act & Assert: member role → 403
    await expect(
      taskService.deleteTask(PROJECT_ID, TASK_ID, 'member')
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only admins can delete tasks',
    });

    // taskRepo.deleteTask should never be called when access is denied
    expect(mockTaskRepo.deleteTask).not.toHaveBeenCalled();
  });

  it('allows admin to delete a task', async () => {
    // Arrange: task exists
    mockTaskRepo.findById.mockResolvedValue(mockTask);
    mockTaskRepo.deleteTask.mockResolvedValue(undefined);

    // Act & Assert: no error thrown
    await expect(
      taskService.deleteTask(PROJECT_ID, TASK_ID, 'admin')
    ).resolves.toBeUndefined();

    expect(mockTaskRepo.deleteTask).toHaveBeenCalledWith(TASK_ID);
  });

  it('throws AppError 403 with correct type for member deletion', async () => {
    mockTaskRepo.findById.mockResolvedValue(mockTask);

    try {
      await taskService.deleteTask(PROJECT_ID, TASK_ID, 'member');
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });
});

// ─── getTask() ────────────────────────────────────────────────────────────────

describe('taskService.getTask()', () => {
  it('throws AppError 404 when task does not exist', async () => {
    // Arrange: findById returns null (task not found)
    mockTaskRepo.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(
      taskService.getTask(PROJECT_ID, 999)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Task not found',
    });

    expect(mockTaskRepo.findById).toHaveBeenCalledWith(PROJECT_ID, 999);
  });

  it('returns the task when it exists', async () => {
    // Arrange: findById returns a task
    mockTaskRepo.findById.mockResolvedValue(mockTask);

    // Act
    const result = await taskService.getTask(PROJECT_ID, TASK_ID);

    // Assert
    expect(result).toEqual(mockTask);
    expect(mockTaskRepo.findById).toHaveBeenCalledWith(PROJECT_ID, TASK_ID);
  });

  it('throws AppError with correct type for missing task', async () => {
    mockTaskRepo.findById.mockResolvedValue(null);

    try {
      await taskService.getTask(PROJECT_ID, 999);
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });
});
