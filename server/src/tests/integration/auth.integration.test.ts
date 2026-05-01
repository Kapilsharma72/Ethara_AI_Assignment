/**
 * Integration Tests for Auth Flow
 *
 * Tests registration, login, JWT validation, and duplicate email handling.
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

(SKIP_INTEGRATION ? describe.skip : describe)('Auth Integration Tests', () => {
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
    // Clean up test users created during each test to keep tests isolated.
    // Cascade deletes handle project_members and tasks via FK constraints.
    await pool.query(`DELETE FROM users WHERE email LIKE 'integration-test-%'`);
  });

  afterAll(async () => {
    await pool.end();
  });

  // ─── Test cases ───────────────────────────────────────────────────────────

  /**
   * Test 1: Register → Login → Access protected route
   *
   * Validates the full happy-path auth flow:
   *   1. Register returns 201 with a JWT token
   *   2. Login with the same credentials returns 200 with a JWT token
   *   3. The token grants access to a protected route (GET /api/projects → 200)
   */
  it('register → login → access protected route', async () => {
    const credentials = {
      name: 'Integration User',
      email: 'integration-test-happy@example.com',
      password: 'securepassword123',
    };

    // Step 1: Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    expect(registerRes.body).toHaveProperty('token');
    expect(typeof registerRes.body.token).toBe('string');
    expect(registerRes.body.user).toMatchObject({
      name: credentials.name,
      email: credentials.email,
    });

    // Step 2: Login with the same credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    expect(loginRes.body).toHaveProperty('token');
    expect(typeof loginRes.body.token).toBe('string');
    expect(loginRes.body.user).toMatchObject({
      email: credentials.email,
    });

    const token = loginRes.body.token;

    // Step 3: Access a protected route with the token
    await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  /**
   * Test 2: 409 on duplicate email
   *
   * Registering the same email twice must return 409 Conflict on the second attempt.
   */
  it('returns 409 when registering with a duplicate email', async () => {
    const credentials = {
      name: 'Duplicate User',
      email: 'integration-test-duplicate@example.com',
      password: 'securepassword123',
    };

    // First registration — should succeed
    await request(app)
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    // Second registration with the same email — should fail with 409
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, name: 'Another User' })
      .expect(409);

    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 3: 401 on wrong password
   *
   * After registering a user, logging in with the wrong password must return 401.
   */
  it('returns 401 when logging in with the wrong password', async () => {
    const credentials = {
      name: 'Wrong Password User',
      email: 'integration-test-wrongpw@example.com',
      password: 'correctpassword123',
    };

    // Register the user first
    await request(app)
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    // Attempt login with wrong password
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrongpassword123' })
      .expect(401);

    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 4: 401 on missing token
   *
   * Accessing a protected route without an Authorization header must return 401.
   */
  it('returns 401 when accessing a protected route without a token', async () => {
    const res = await request(app)
      .get('/api/projects')
      .expect(401);

    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  /**
   * Test 5: 401 on expired/malformed token
   *
   * Accessing a protected route with a malformed token must return 401.
   */
  it('returns 401 when accessing a protected route with a malformed token', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(401);

    expect(res.body).toHaveProperty('message');
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
