/**
 * Integration Tests for Project Lifecycle
 *
 * Tests project creation, member management, and access control.
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

(SKIP_INTEGRATION ? describe.skip : describe)('Project Integration Tests', () => {
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
    await pool.query(`DELETE FROM users WHERE email LIKE 'proj-integration-test-%'`);
    // Also clean up any projects created by those users (cascade should handle it,
    // but projects have no direct FK to users — clean up explicitly)
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
        email: `proj-integration-test-${suffix}@example.com`,
        password: 'securepassword123',
      })
      .expect(201);

    return { token: res.body.token, user: res.body.user };
  }

  // ─── Test cases ───────────────────────────────────────────────────────────

  /**
   * Test 1: Create project → add member → list projects (scoped to each user)
   *
   * Validates the full project membership flow:
   *   1. Admin creates a project → 201
   *   2. Admin adds member by email → 200
   *   3. Admin lists projects → project appears with role 'admin'
   *   4. Member lists projects → project appears with role 'member'
   */
  it('create project → add member → list projects scoped to each user', async () => {
    const admin = await registerUser('admin-1');
    const member = await registerUser('member-1');

    // Step 1: Admin creates a project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Integration Test Project', description: 'A test project' })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body.name).toBe('Integration Test Project');
    expect(createRes.body.role).toBe('admin');

    const projectId = createRes.body.id;

    // Step 2: Admin adds member by email
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: member.user.email })
      .expect(200);

    // Step 3: Admin lists projects → project appears with role 'admin'
    const adminListRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(Array.isArray(adminListRes.body)).toBe(true);
    const adminProject = adminListRes.body.find((p: { id: number }) => p.id === projectId);
    expect(adminProject).toBeDefined();
    expect(adminProject.role).toBe('admin');

    // Step 4: Member lists projects → project appears with role 'member'
    const memberListRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);

    expect(Array.isArray(memberListRes.body)).toBe(true);
    const memberProject = memberListRes.body.find((p: { id: number }) => p.id === projectId);
    expect(memberProject).toBeDefined();
    expect(memberProject.role).toBe('member');
  });

  /**
   * Test 2: Remove member → verify 403
   *
   * After adding a member, admin removes them.
   * The removed member should then receive 403 when accessing the project.
   */
  it('remove member → removed member gets 403 on project access', async () => {
    const admin = await registerUser('admin-2');
    const member = await registerUser('member-2');

    // Create project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Remove Member Test Project' })
      .expect(201);

    const projectId = createRes.body.id;

    // Add member
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: member.user.email })
      .expect(200);

    // Confirm member can access the project
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);

    // Admin removes the member
    await request(app)
      .delete(`/api/projects/${projectId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    // Removed member tries to GET the project → 403
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);
  });

  /**
   * Test 3: 403 for non-member access
   *
   * A user who is not a member of a project should receive 403
   * when trying to access any project-scoped endpoint.
   */
  it('returns 403 for non-member (outsider) accessing a project', async () => {
    const admin = await registerUser('admin-3');
    const outsider = await registerUser('outsider-3');

    // Admin creates a project (outsider is never added)
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Outsider Test Project' })
      .expect(201);

    const projectId = createRes.body.id;

    // Outsider tries to GET the project → 403
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(403);
  });

  /**
   * Test 4: 409 for duplicate member
   *
   * Adding the same member twice should return 409 Conflict on the second attempt.
   */
  it('returns 409 when adding the same member twice', async () => {
    const admin = await registerUser('admin-4');
    const member = await registerUser('member-4');

    // Create project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Duplicate Member Test Project' })
      .expect(201);

    const projectId = createRes.body.id;

    // First add — should succeed
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: member.user.email })
      .expect(200);

    // Second add with the same email — should return 409
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: member.user.email })
      .expect(409);

    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 5: 404 for unknown email when adding member
   *
   * Attempting to add a member by an email that does not exist in the system
   * should return 404.
   */
  it('returns 404 when adding a member with an unknown email', async () => {
    const admin = await registerUser('admin-5');

    // Create project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Unknown Email Test Project' })
      .expect(201);

    const projectId = createRes.body.id;

    // Try to add a non-existent user by email → 404
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'nonexistent@example.com' })
      .expect(404);

    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
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
