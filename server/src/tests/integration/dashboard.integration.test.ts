/**
 * Integration Tests for Dashboard Endpoint
 *
 * Tests task count accuracy, status breakdowns, and overdue task detection.
 * Requires a real PostgreSQL database — skipped automatically when DATABASE_URL is not set.
 */

import request from 'supertest';
import { Application } from 'express';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ─── Skip guard ──────────────────────────────────────────────────────────────
// Skip all integration tests when no database is available.
const SKIP_INTEGRATION = !process.env.DATABASE_URL;

// ─── Lazy imports (only resolved when DATABASE_URL is present) ────────────────
// We import lazily inside the describe block so that env.ts does not call
// process.exit(1) when DATABASE_URL is absent.

(SKIP_INTEGRATION ? describe.skip : describe)('Dashboard Integration Tests', () => {
  let app: Application;
  let pool: Pool;

  // ─── Setup ────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Ensure required env vars are present for the app factory
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'integration-test-secret-key-at-least-32-chars!!';
    }
    if (!process.env.CLIENT_ORIGIN) {
      process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    }
    if (!process.env.PORT) {
      process.env.PORT = '3001';
    }

    // Import app and pool after env vars are set
    const appModule = await import('../../app');
    const poolModule = await import('../../db/pool');

    app = appModule.createApp();
    pool = poolModule.default as unknown as Pool;

    // Run migrations against the test database
    await runMigrations(pool);
  }, 30_000);

  afterEach(async () => {
    // Clean up test data created during each test to keep tests isolated.
    // Cascade deletes handle project_members and tasks via FK constraints.
    await pool.query(`DELETE FROM users WHERE email LIKE 'dashboard-integration-test-%'`);
    // Clean up any orphaned projects (no members left after user deletion)
    await pool.query(`
      DELETE FROM projects
      WHERE id NOT IN (SELECT DISTINCT project_id FROM project_members)
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Register a user and return their token and user object.
   */
  async function registerUser(suffix: string): Promise<{ token: string; user: { id: number; name: string; email: string } }> {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: `Test User ${suffix}`,
        email: `dashboard-integration-test-${suffix}@example.com`,
        password: 'securepassword123',
      })
      .expect(201);

    return { token: res.body.token, user: res.body.user };
  }

  /**
   * Create a project as the given user and return the project ID.
   */
  async function createProject(token: string, name: string): Promise<number> {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);

    return res.body.id;
  }

  /**
   * Add a member to a project by email.
   */
  async function addMember(adminToken: string, projectId: number, email: string): Promise<void> {
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email })
      .expect(200);
  }

  /**
   * Create a task in a project and return the task ID.
   */
  async function createTask(
    token: string,
    projectId: number,
    title: string,
    priority: 'Low' | 'Medium' | 'High' = 'Low',
    dueDate?: string
  ): Promise<number> {
    const body: Record<string, unknown> = { title, priority };
    if (dueDate) {
      body.dueDate = dueDate;
    }

    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    return res.body.id;
  }

  /**
   * Update a task's status as admin.
   */
  async function updateTaskStatus(
    adminToken: string,
    projectId: number,
    taskId: number,
    status: 'To Do' | 'In Progress' | 'Done'
  ): Promise<void> {
    await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status })
      .expect(200);
  }

  /**
   * Returns a date string in the future (safe for task creation validation).
   */
  function futureDueDate(daysFromNow = 7): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // ─── Test cases ───────────────────────────────────────────────────────────

  /**
   * Test 1: Dashboard counts match expected values
   *
   * Create a project with an admin and a member.
   * Create tasks with known statuses: 2 'To Do', 1 'In Progress', 1 'Done'.
   * Assert totalTasks === 4 and byStatus counts match exactly.
   *
   * Validates: Requirements 10.1, 10.2, 10.3
   */
  it('dashboard counts match expected values for known task statuses', async () => {
    const admin = await registerUser('admin-counts-1');
    const member = await registerUser('member-counts-1');

    const projectId = await createProject(admin.token, 'Dashboard Counts Project');
    await addMember(admin.token, projectId, member.user.email);

    // Create 4 tasks — all start as 'To Do'
    const task1Id = await createTask(admin.token, projectId, 'Task 1 - To Do');
    const task2Id = await createTask(admin.token, projectId, 'Task 2 - To Do');
    const task3Id = await createTask(admin.token, projectId, 'Task 3 - In Progress');
    const task4Id = await createTask(admin.token, projectId, 'Task 4 - Done');

    // Update statuses to reach the desired distribution:
    // task1 and task2 remain 'To Do' (no update needed)
    await updateTaskStatus(admin.token, projectId, task3Id, 'In Progress');
    await updateTaskStatus(admin.token, projectId, task4Id, 'Done');

    // GET dashboard
    const res = await request(app)
      .get(`/api/projects/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const dashboard = res.body;

    // Assert total task count
    expect(dashboard.totalTasks).toBe(4);

    // Assert by-status breakdown
    expect(dashboard.byStatus['To Do']).toBe(2);
    expect(dashboard.byStatus['In Progress']).toBe(1);
    expect(dashboard.byStatus['Done']).toBe(1);

    // Assert the response has the expected shape
    expect(dashboard).toHaveProperty('byAssignee');
    expect(Array.isArray(dashboard.byAssignee)).toBe(true);
    expect(dashboard).toHaveProperty('overdueTasks');
    expect(Array.isArray(dashboard.overdueTasks)).toBe(true);

    // Suppress unused variable warnings — task IDs are used implicitly via status updates
    void task1Id;
    void task2Id;
  });

  /**
   * Test 2: Overdue tasks list contains exactly tasks where due_date < today AND status !== 'Done'
   *
   * Creates:
   *   - 2 tasks with past due dates and non-Done statuses → should appear in overdueTasks
   *   - 1 task with a past due date but status 'Done' → should NOT appear
   *   - 1 task with a future due date → should NOT appear
   *
   * Validates: Requirements 10.4, 10.5
   */
  it('overdueTasks contains exactly tasks with past due dates that are not Done', async () => {
    const admin = await registerUser('admin-overdue-1');

    const projectId = await createProject(admin.token, 'Overdue Tasks Project');

    const pastDate = '2020-01-01';
    const futureDate = futureDueDate(30);

    // Task A: past due date, status 'To Do' → OVERDUE
    const taskAId = await createTask(admin.token, projectId, 'Overdue Task A - To Do', 'Low', pastDate);

    // Task B: past due date, status 'In Progress' → OVERDUE
    const taskBId = await createTask(admin.token, projectId, 'Overdue Task B - In Progress', 'Medium', pastDate);
    await updateTaskStatus(admin.token, projectId, taskBId, 'In Progress');

    // Task C: past due date, status 'Done' → NOT overdue
    const taskCId = await createTask(admin.token, projectId, 'Past Due Task C - Done', 'Low', pastDate);
    await updateTaskStatus(admin.token, projectId, taskCId, 'Done');

    // Task D: future due date, status 'To Do' → NOT overdue
    const taskDId = await createTask(admin.token, projectId, 'Future Task D - To Do', 'High', futureDate);

    // GET dashboard
    const res = await request(app)
      .get(`/api/projects/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const { overdueTasks } = res.body;

    expect(Array.isArray(overdueTasks)).toBe(true);

    // Extract IDs from the overdue list for easy assertion
    const overdueIds: number[] = overdueTasks.map((t: { id: number }) => t.id);

    // Task A and Task B must be in the overdue list
    expect(overdueIds).toContain(taskAId);
    expect(overdueIds).toContain(taskBId);

    // Task C (Done) must NOT be in the overdue list
    expect(overdueIds).not.toContain(taskCId);

    // Task D (future date) must NOT be in the overdue list
    expect(overdueIds).not.toContain(taskDId);

    // Exactly 2 overdue tasks
    expect(overdueTasks).toHaveLength(2);

    // Each overdue task entry has the expected shape
    for (const overdueTask of overdueTasks) {
      expect(overdueTask).toHaveProperty('id');
      expect(overdueTask).toHaveProperty('title');
      expect(overdueTask).toHaveProperty('dueDate');
      // assigneeName may be null (unassigned) — just check the key exists
      expect(overdueTask).toHaveProperty('assigneeName');
    }
  });
});

// ─── Migration helper ─────────────────────────────────────────────────────────
// Runs migrations inline (without importing migrate.ts which calls pool.end()).

async function runMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.join(__dirname, '../../db/migrations');
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const result = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (result.rowCount && result.rowCount > 0) {
        continue; // already applied
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
