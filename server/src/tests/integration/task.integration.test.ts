/**
 * Integration Tests for Task Lifecycle
 *
 * Tests task creation, assignment, status updates, role enforcement, and deletion.
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

(SKIP_INTEGRATION ? describe.skip : describe)('Task Integration Tests', () => {
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
    await pool.query(`DELETE FROM users WHERE email LIKE 'task-integration-test-%'`);
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
        email: `task-integration-test-${suffix}@example.com`,
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
   * Returns a due date string that is today or in the future (safe for task creation).
   */
  function futureDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // ─── Test cases ───────────────────────────────────────────────────────────

  /**
   * Test 1: Full task lifecycle
   *
   * Create task → assign → update status (as assignee) → edit fields (as admin) → delete (as admin)
   *
   * Validates: Requirements 6.1, 7.1, 8.1, 8.2, 9.1, 9.2
   */
  it('full task lifecycle: create → assign → update status → edit fields → delete', async () => {
    const admin = await registerUser('admin-lifecycle-1');
    const member = await registerUser('member-lifecycle-1');

    // Set up project with member
    const projectId = await createProject(admin.token, 'Task Lifecycle Project');
    await addMember(admin.token, projectId, member.user.email);

    // Step 1: Admin creates task with member as assignee → 201, status === 'To Do'
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Lifecycle Task',
        description: 'A task for lifecycle testing',
        dueDate: futureDueDate(),
        priority: 'Medium',
        assigneeId: member.user.id,
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body.status).toBe('To Do');
    expect(createRes.body.title).toBe('Lifecycle Task');
    expect(createRes.body.priority).toBe('Medium');
    expect(createRes.body.assigneeId).toBe(member.user.id);

    const taskId = createRes.body.id;

    // Step 2: Member (assignee) updates task status to 'In Progress' → 200
    const statusRes = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'In Progress' })
      .expect(200);

    expect(statusRes.body.status).toBe('In Progress');

    // Step 3: Admin edits task title and priority → 200
    const editRes = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Updated Lifecycle Task', priority: 'High' })
      .expect(200);

    expect(editRes.body.title).toBe('Updated Lifecycle Task');
    expect(editRes.body.priority).toBe('High');
    // Status should remain unchanged
    expect(editRes.body.status).toBe('In Progress');

    // Step 4: Admin deletes task → 204
    await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    // Confirm task is gone — GET should return 404
    await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  /**
   * Test 2: 403 for member editing non-status fields
   *
   * A member who is the assignee can update status, but cannot change other fields
   * such as title, description, priority, or assigneeId.
   *
   * Validates: Requirements 8.3, 9.3, 11.1, 11.3
   */
  it('returns 403 when member tries to edit non-status fields', async () => {
    const admin = await registerUser('admin-403-edit-1');
    const member = await registerUser('member-403-edit-1');

    const projectId = await createProject(admin.token, 'Member Edit Restriction Project');
    await addMember(admin.token, projectId, member.user.email);

    // Admin creates task assigned to member
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Restricted Task',
        priority: 'Low',
        assigneeId: member.user.id,
      })
      .expect(201);

    const taskId = createRes.body.id;

    // Member tries to PATCH with { title: 'New title' } → 403
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ title: 'New title' })
      .expect(403);

    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 3: 403 for member deleting a task
   *
   * Only admins can delete tasks; members must receive 403.
   *
   * Validates: Requirements 9.4, 11.1
   */
  it('returns 403 when member tries to delete a task', async () => {
    const admin = await registerUser('admin-403-delete-1');
    const member = await registerUser('member-403-delete-1');

    const projectId = await createProject(admin.token, 'Member Delete Restriction Project');
    await addMember(admin.token, projectId, member.user.email);

    // Admin creates task assigned to member
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Task To Not Delete',
        priority: 'Low',
        assigneeId: member.user.id,
      })
      .expect(201);

    const taskId = createRes.body.id;

    // Member tries to DELETE → 403
    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);

    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 4: 422 for invalid enum values
   *
   * POST task with priority: 'Critical' → 422
   * PATCH task with status: 'Blocked' → 422
   *
   * Validates: Requirements 6.4, 8.4
   */
  it('returns 422 for invalid enum values on create and update', async () => {
    const admin = await registerUser('admin-422-enum-1');

    const projectId = await createProject(admin.token, 'Enum Validation Project');

    // POST task with invalid priority 'Critical' → 422
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Invalid Priority Task',
        priority: 'Critical',
      })
      .expect(422);

    expect(createRes.body).toHaveProperty('message');
    expect(typeof createRes.body.message).toBe('string');
    expect(createRes.body).toHaveProperty('errors');
    expect(Array.isArray(createRes.body.errors)).toBe(true);

    // Create a valid task first so we can test PATCH validation
    const validCreateRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Valid Task For Enum Test',
        priority: 'Low',
      })
      .expect(201);

    const taskId = validCreateRes.body.id;

    // PATCH task with invalid status 'Blocked' → 422
    const patchRes = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'Blocked' })
      .expect(422);

    expect(patchRes.body).toHaveProperty('message');
    expect(typeof patchRes.body.message).toBe('string');
    expect(patchRes.body).toHaveProperty('errors');
    expect(Array.isArray(patchRes.body.errors)).toBe(true);
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
