import pool from '../db/pool';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
  passwordHash: string;
  createdAt: Date;
}

export interface UserPublic {
  id: number;
  name: string;
  email: string;
}

export async function findById(id: number): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, name, email, role, password_hash as "passwordHash", created_at as "createdAt"
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, name, email, role, password_hash as "passwordHash", created_at as "createdAt"
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

/**
 * Search users by name or email (case-insensitive partial match).
 * Excludes users already in the given project.
 * Returns up to 10 results.
 */
export async function searchUsers(query: string, excludeProjectId: number): Promise<UserPublic[]> {
  const result = await pool.query<UserPublic>(
    `SELECT u.id, u.name, u.email
     FROM users u
     WHERE (
       u.name ILIKE $1 OR u.email ILIKE $1
     )
     AND u.id NOT IN (
       SELECT user_id FROM project_members WHERE project_id = $2
     )
     ORDER BY u.name ASC
     LIMIT 10`,
    [`%${query}%`, excludeProjectId]
  );
  return result.rows;
}

export async function create(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'member';
}): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, password_hash as "passwordHash", created_at as "createdAt"`,
    [data.name, data.email, data.passwordHash, data.role]
  );
  return result.rows[0];
}
