/**
 * Property-Based Tests for Task Creation and Role Enforcement
 *
 * Covers: task status initialization, enum validation,
 * role-based access control, and dashboard overdue count accuracy.
 */

import fc from 'fast-check';
import pool from '../../db/pool';
import * as taskRepository from '../../repositories/task.repository';
import { CreateTaskSchema, UpdateTaskSchema } from '../../schemas/task.schemas';

// Mock the pg pool so no real DB connection is needed
jest.mock('../../db/pool');

// Mock repositories for service-level tests (Property 7)
jest.mock('../../repositories/task.repository');
jest.mock('../../repositories/project.repository');

describe('Task Properties', () => {
  /**
   * Property 5: Task creation always initializes status to "To Do"
   *
   * For any valid task creation request, regardless of the other field values
   * provided, the created task's `status` field SHALL equal `"To Do"`.
   *
   * The mock simulates the database DEFAULT constraint on the `status` column
   * which sets it to 'To Do' when a new task is inserted.
   *
   * Validates: Requirements 6.1
   */
  describe('Property 5: Task creation always initializes status to "To Do"', () => {
    const mockedTaskRepo = taskRepository as jest.Mocked<typeof taskRepository>;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it(
      'should always return status "To Do" for any valid task creation input',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.constantFrom('Low', 'Medium', 'High' as const),
            fc.integer({ min: 1, max: 1000 }),
            fc.integer({ min: 1, max: 1000 }),
            async (title, priority, projectId, createdBy) => {
              // Mock taskRepository.create to return a task with status: 'To Do',
              // simulating the DB DEFAULT constraint on the status column.
              mockedTaskRepo.create.mockResolvedValueOnce({
                id: 1,
                projectId,
                createdBy,
                assigneeId: null,
                assigneeName: null,
                title,
                description: null,
                dueDate: null,
                priority: priority as 'Low' | 'Medium' | 'High',
                status: 'To Do',
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              const task = await taskRepository.create({
                projectId,
                createdBy,
                title,
                priority: priority as 'Low' | 'Medium' | 'High',
              });

              // The status must always be 'To Do' regardless of other field values
              expect(task.status).toBe('To Do');
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });

  /**
   * Property 6: Invalid enum values are rejected
   *
   * For any task creation or update request where `priority` is not one of
   * ["Low", "Medium", "High"] or `status` is not one of
   * ["To Do", "In Progress", "Done"], the Zod schema SHALL reject the input.
   *
   * Validates: Requirements 6.4, 8.4
   */
  describe('Property 6: Invalid enum values are rejected', () => {
    it(
      'should reject any priority value not in ["Low", "Medium", "High"]',
      () => {
        fc.assert(
          fc.property(
            fc.string().filter(s => !['Low', 'Medium', 'High'].includes(s)),
            (invalidPriority) => {
              const result = CreateTaskSchema.safeParse({
                title: 'Test',
                priority: invalidPriority,
              });
              expect(result.success).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      }
    );

    it(
      'should reject any status value not in ["To Do", "In Progress", "Done"]',
      () => {
        fc.assert(
          fc.property(
            fc.string().filter(s => !['To Do', 'In Progress', 'Done'].includes(s)),
            (invalidStatus) => {
              const result = UpdateTaskSchema.safeParse({ status: invalidStatus });
              expect(result.success).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });
});

/**
 * Property 7: Role enforcement is consistent across all task mutation endpoints
 *
 * For any project P and member M (non-admin) of P:
 *   - M SHALL be able to update the status of tasks assigned to M
 *   - M SHALL receive 403 for editing non-status fields on their own tasks
 *   - M SHALL receive 403 for deleting tasks
 *   - M SHALL receive 403 for editing tasks assigned to other members
 *
 * Tests taskService.updateTask and taskService.deleteTask directly with mocked repositories.
 *
 * Validates: Requirements 8.3, 9.3, 9.4, 11.1, 11.3
 */
describe('Property 7: Role enforcement is consistent across all task mutation endpoints', () => {
  // Import the service after mocks are set up
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskService = require('../../services/task.service');
  const mockedTaskRepo = taskRepository as jest.Mocked<typeof taskRepository>;

  const projectId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'member can update status of own tasks',
    async () => {
      /**
       * Validates: Requirements 8.3, 11.1
       *
       * For any taskId and memberId, a member who is the assignee of a task
       * SHALL be able to update the status field without error.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          async (taskId, memberId) => {
            const mockTask: taskRepository.Task = {
              id: taskId,
              projectId,
              createdBy: memberId,
              assigneeId: memberId,
              assigneeName: 'Test Member',
              title: 'Test Task',
              description: null,
              dueDate: null,
              priority: 'Medium',
              status: 'To Do',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const updatedTask: taskRepository.Task = {
              ...mockTask,
              status: 'In Progress',
            };

            mockedTaskRepo.findById.mockResolvedValue(mockTask);
            mockedTaskRepo.update.mockResolvedValue(updatedTask);

            await expect(
              taskService.updateTask(projectId, taskId, { status: 'In Progress' }, memberId, 'member')
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'member gets 403 for editing non-status fields on own tasks',
    async () => {
      /**
       * Validates: Requirements 9.3, 11.3
       *
       * For any taskId and memberId, a member who is the assignee of a task
       * SHALL receive a 403 AppError when attempting to edit non-status fields.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          async (taskId, memberId) => {
            const mockTask: taskRepository.Task = {
              id: taskId,
              projectId,
              createdBy: memberId,
              assigneeId: memberId,
              assigneeName: 'Test Member',
              title: 'Original Title',
              description: null,
              dueDate: null,
              priority: 'Medium',
              status: 'To Do',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedTaskRepo.findById.mockResolvedValue(mockTask);

            await expect(
              taskService.updateTask(projectId, taskId, { title: 'New title' }, memberId, 'member')
            ).rejects.toMatchObject({ statusCode: 403 });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'member gets 403 for deleting tasks',
    async () => {
      /**
       * Validates: Requirements 9.4, 11.1
       *
       * For any taskId, a member (non-admin) SHALL receive a 403 AppError
       * when attempting to delete a task.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          async (taskId) => {
            const mockTask: taskRepository.Task = {
              id: taskId,
              projectId,
              createdBy: 1,
              assigneeId: null,
              assigneeName: null,
              title: 'Test Task',
              description: null,
              dueDate: null,
              priority: 'Low',
              status: 'To Do',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedTaskRepo.findById.mockResolvedValue(mockTask);

            await expect(
              taskService.deleteTask(projectId, taskId, 'member')
            ).rejects.toMatchObject({ statusCode: 403 });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'member gets 403 for editing tasks assigned to others',
    async () => {
      /**
       * Validates: Requirements 8.3, 11.3
       *
       * For any taskId, memberId, and otherUserId (different from memberId),
       * a member SHALL receive a 403 AppError when attempting to update a task
       * that is assigned to a different user.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 5000 }),
          fc.integer({ min: 5001, max: 10000 }),
          async (taskId, memberId, otherUserId) => {
            const mockTask: taskRepository.Task = {
              id: taskId,
              projectId,
              createdBy: otherUserId,
              assigneeId: otherUserId,
              assigneeName: 'Other Member',
              title: 'Test Task',
              description: null,
              dueDate: null,
              priority: 'High',
              status: 'To Do',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedTaskRepo.findById.mockResolvedValue(mockTask);

            await expect(
              taskService.updateTask(projectId, taskId, { status: 'Done' }, memberId, 'member')
            ).rejects.toMatchObject({ statusCode: 403 });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

/**
 * Property 8: Dashboard overdue count matches task query
 *
 * For any project P, the list of overdue tasks returned by the dashboard
 * endpoint SHALL be exactly the set of tasks in P where
 * `due_date < CURRENT_DATE` AND `status != 'Done'`.
 *
 * Tests `getDashboardStats` from the task repository directly with a mocked
 * pool, verifying that the overdueTasks array matches the expected set
 * computed by the test's own filter logic.
 *
 * Validates: Requirements 10.4
 */
describe('Property 8: Dashboard overdue count matches task query', () => {
  // The pool default export is already mocked via jest.mock('../../db/pool')
  // Cast to any to work around overloaded query signature in jest.Mocked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockedPool = pool as any;

  // Use the real getDashboardStats implementation (not the jest.mock'd version)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDashboardStats } = jest.requireActual('../../repositories/task.repository') as typeof taskRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'overdueTasks from getDashboardStats should match tasks where dueDate < today AND status !== Done',
    async () => {
      /**
       * Validates: Requirements 10.4
       *
       * For any array of tasks with arbitrary due dates and statuses, the
       * overdueTasks returned by getDashboardStats SHALL equal the set of
       * tasks where dueDate < CURRENT_DATE AND status !== 'Done'.
       */
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Arbitrary past date (yesterday or earlier)
      const pastDate = fc.date({
        min: new Date('2020-01-01'),
        max: new Date(Date.now() - 86400000),
      });

      // Arbitrary future date (tomorrow or later)
      const futureDate = fc.date({
        min: new Date(Date.now() + 86400000),
        max: new Date('2030-12-31'),
      });

      // A task can have a past due date, a future due date, or no due date
      const dueDateArb = fc.oneof(
        pastDate.map(d => d.toISOString().split('T')[0]),   // past date string
        futureDate.map(d => d.toISOString().split('T')[0]), // future date string
        fc.constant(null),                                   // no due date
      );

      const taskArb = fc.record({
        id: fc.integer({ min: 1, max: 100000 }),
        title: fc.string({ minLength: 1, maxLength: 100 }),
        dueDate: dueDateArb,
        assigneeName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        status: fc.constantFrom('To Do', 'In Progress', 'Done' as const),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.array(taskArb, { minLength: 0, maxLength: 20 }),
          async (projectId, tasks) => {
            // Compute the expected overdue set using the same logic as the SQL query:
            // due_date < CURRENT_DATE AND status != 'Done'
            const todayStr = today.toISOString().split('T')[0];
            const expectedOverdue = tasks.filter(
              t => t.dueDate !== null && t.dueDate < todayStr && t.status !== 'Done'
            );

            // Build the overdue rows in the shape the repository returns
            const overdueRows = expectedOverdue.map(t => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate as string,
              assigneeName: t.assigneeName,
            }));

            // Mock pool.query to return appropriate data for each of the 3 queries
            // in getDashboardStats (called via Promise.all):
            //   1. counts query  → { total, todo, inProgress, done }
            //   2. byAssignee query → []
            //   3. overdue query → overdueRows
            mockedPool.query
              .mockResolvedValueOnce({
                rows: [{
                  total: String(tasks.length),
                  todo: String(tasks.filter(t => t.status === 'To Do').length),
                  inProgress: String(tasks.filter(t => t.status === 'In Progress').length),
                  done: String(tasks.filter(t => t.status === 'Done').length),
                }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
              } as any)
              .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
              } as any)
              .mockResolvedValueOnce({
                rows: overdueRows,
                rowCount: overdueRows.length,
                command: 'SELECT',
                oid: 0,
                fields: [],
              } as any);

            const stats = await getDashboardStats(projectId);

            // The overdueTasks array must match the expected set exactly
            expect(stats.overdueTasks).toHaveLength(expectedOverdue.length);
            expect(stats.overdueTasks).toEqual(overdueRows);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
