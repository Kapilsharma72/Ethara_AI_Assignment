import pool from '../db/pool';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  role: 'admin' | 'member';
  taskSummary: TaskSummary;
}

export interface ProjectMember {
  userId: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export interface TaskSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}

export interface ProjectDetail {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  members: ProjectMember[];
  taskSummary: TaskSummary;
}

// ── Repository functions ──────────────────────────────────────────────────────

/**
 * Returns all projects the user belongs to, along with their role and task summary in each.
 */
export async function findAllForUser(userId: number): Promise<ProjectSummary[]> {
  const result = await pool.query<{
    id: number;
    name: string;
    description: string | null;
    createdAt: Date;
    role: 'admin' | 'member';
    total: string;
    todo: string;
    inProgress: string;
    done: string;
  }>(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.created_at as "createdAt",
       pm.role,
       COUNT(t.id) as total,
       COUNT(t.id) FILTER (WHERE t.status = 'To Do') as todo,
       COUNT(t.id) FILTER (WHERE t.status = 'In Progress') as "inProgress",
       COUNT(t.id) FILTER (WHERE t.status = 'Done') as done
     FROM projects p
     JOIN project_members pm ON p.id = pm.project_id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE pm.user_id = $1
     GROUP BY p.id, p.name, p.description, p.created_at, pm.role
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    role: row.role,
    taskSummary: {
      total: parseInt(row.total, 10),
      todo: parseInt(row.todo, 10),
      inProgress: parseInt(row.inProgress, 10),
      done: parseInt(row.done, 10),
    },
  }));
}

/**
 * Returns a project with its members array and task summary counts.
 * Returns null if the project does not exist.
 */
export async function findById(projectId: number): Promise<ProjectDetail | null> {
  const projectResult = await pool.query<{
    id: number;
    name: string;
    description: string | null;
    createdAt: Date;
  }>(
    `SELECT id, name, description, created_at as "createdAt"
     FROM projects
     WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const project = projectResult.rows[0];

  const [membersResult, taskSummaryResult] = await Promise.all([
    pool.query<ProjectMember>(
      `SELECT u.id as "userId", u.name, u.email, pm.role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [projectId]
    ),
    pool.query<{
      total: string;
      todo: string;
      inProgress: string;
      done: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'To Do') as todo,
         COUNT(*) FILTER (WHERE status = 'In Progress') as "inProgress",
         COUNT(*) FILTER (WHERE status = 'Done') as done
       FROM tasks
       WHERE project_id = $1`,
      [projectId]
    ),
  ]);

  const rawSummary = taskSummaryResult.rows[0];

  return {
    ...project,
    members: membersResult.rows,
    taskSummary: {
      total: parseInt(rawSummary.total, 10),
      todo: parseInt(rawSummary.todo, 10),
      inProgress: parseInt(rawSummary.inProgress, 10),
      done: parseInt(rawSummary.done, 10),
    },
  };
}

/**
 * Creates a new project and adds the creator as an admin member in a transaction.
 * Returns the created project with role: 'admin'.
 */
export async function create(
  data: { name: string; description?: string },
  creatorId: number
): Promise<ProjectSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectResult = await client.query<{
      id: number;
      name: string;
      description: string | null;
      createdAt: Date;
    }>(
      `INSERT INTO projects (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at as "createdAt"`,
      [data.name, data.description ?? null]
    );

    const project = projectResult.rows[0];

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [project.id, creatorId]
    );

    await client.query('COMMIT');

    return {
      ...project,
      role: 'admin' as const,
      taskSummary: {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Adds a user to a project with the specified role.
 */
export async function addMember(
  projectId: number,
  userId: number,
  role: 'admin' | 'member'
): Promise<void> {
  await pool.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [projectId, userId, role]
  );
}

/**
 * Removes a user from a project.
 */
export async function removeMember(projectId: number, userId: number): Promise<void> {
  await pool.query(
    `DELETE FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
}

/**
 * Returns the user's role in the project, or null if they are not a member.
 */
export async function getMemberRole(
  projectId: number,
  userId: number
): Promise<string | null> {
  const result = await pool.query<{ role: string }>(
    `SELECT role
     FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result.rows[0]?.role ?? null;
}
