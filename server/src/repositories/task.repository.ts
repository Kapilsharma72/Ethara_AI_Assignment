import pool from '../db/pool';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Task {
  id: number;
  projectId: number;
  createdBy: number;
  assigneeId: number | null;
  assigneeName: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'Low' | 'Medium' | 'High';
  status: 'To Do' | 'In Progress' | 'Done';
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalTasks: number;
  byStatus: {
    'To Do': number;
    'In Progress': number;
    'Done': number;
  };
  byAssignee: Array<{
    userId: number | null;
    name: string;
    count: number;
  }>;
  overdueTasks: Array<{
    id: number;
    title: string;
    dueDate: string;
    assigneeName: string | null;
  }>;
}

// ── Repository functions ──────────────────────────────────────────────────────

/**
 * Returns all tasks for a project, with assignee name joined.
 */
export async function findAllByProject(projectId: number): Promise<Task[]> {
  const result = await pool.query<Task>(
    `SELECT
       t.id,
       t.project_id as "projectId",
       t.created_by as "createdBy",
       t.assignee_id as "assigneeId",
       t.title,
       t.description,
       t.due_date as "dueDate",
       t.priority,
       t.status,
       t.created_at as "createdAt",
       t.updated_at as "updatedAt",
       u.name as "assigneeName"
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = $1
     ORDER BY t.created_at DESC`,
    [projectId]
  );
  return result.rows;
}

/**
 * Returns a single task by project and task ID, or null if not found.
 */
export async function findById(projectId: number, taskId: number): Promise<Task | null> {
  const result = await pool.query<Task>(
    `SELECT
       t.id,
       t.project_id as "projectId",
       t.created_by as "createdBy",
       t.assignee_id as "assigneeId",
       t.title,
       t.description,
       t.due_date as "dueDate",
       t.priority,
       t.status,
       t.created_at as "createdAt",
       t.updated_at as "updatedAt",
       u.name as "assigneeName"
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = $1 AND t.id = $2`,
    [projectId, taskId]
  );
  return result.rows[0] ?? null;
}

/**
 * Creates a new task. Status defaults to 'To Do' via the database default.
 */
export async function create(data: {
  projectId: number;
  createdBy: number;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  assigneeId?: number;
}): Promise<Task> {
  const result = await pool.query<Task>(
    `INSERT INTO tasks (project_id, created_by, title, description, due_date, priority, assignee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id,
       project_id as "projectId",
       created_by as "createdBy",
       assignee_id as "assigneeId",
       title,
       description,
       due_date as "dueDate",
       priority,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [
      data.projectId,
      data.createdBy,
      data.title,
      data.description ?? null,
      data.dueDate ?? null,
      data.priority,
      data.assigneeId ?? null,
    ]
  );

  const task = result.rows[0];

  // Fetch assignee name if an assignee was set
  if (task.assigneeId !== null) {
    const userResult = await pool.query<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [task.assigneeId]
    );
    task.assigneeName = userResult.rows[0]?.name ?? null;
  } else {
    task.assigneeName = null;
  }

  return task;
}

const TASK_SELECT_WITH_ASSIGNEE = `
  SELECT
    t.id,
    t.project_id as "projectId",
    t.created_by as "createdBy",
    t.assignee_id as "assigneeId",
    t.title,
    t.description,
    t.due_date as "dueDate",
    t.priority,
    t.status,
    t.created_at as "createdAt",
    t.updated_at as "updatedAt",
    u.name as "assigneeName"
  FROM tasks t
  LEFT JOIN users u ON t.assignee_id = u.id
`;

/**
 * Partially updates a task. Only provided fields are updated.
 * Always sets updated_at = NOW(). Returns the updated task with assignee name,
 * or null if the task does not exist.
 */
export async function update(
  taskId: number,
  fields: Partial<{
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: 'Low' | 'Medium' | 'High';
    status: 'To Do' | 'In Progress' | 'Done';
    assigneeId: number | null;
  }>
): Promise<Task | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if ('title' in fields && fields.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(fields.title);
  }
  if ('description' in fields) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(fields.description ?? null);
  }
  if ('dueDate' in fields) {
    setClauses.push(`due_date = $${paramIndex++}`);
    values.push(fields.dueDate ?? null);
  }
  if ('priority' in fields && fields.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    values.push(fields.priority);
  }
  if ('status' in fields && fields.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(fields.status);
  }
  if ('assigneeId' in fields) {
    setClauses.push(`assignee_id = $${paramIndex++}`);
    values.push(fields.assigneeId ?? null);
  }

  if (setClauses.length === 0) {
    // Nothing to update — fetch and return the current task as-is
    const result = await pool.query<Task>(
      TASK_SELECT_WITH_ASSIGNEE + ' WHERE t.id = $1',
      [taskId]
    );
    return result.rows[0] ?? null;
  }

  setClauses.push('updated_at = NOW()');
  values.push(taskId);

  const updateResult = await pool.query<{ id: number }>(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
    values
  );

  if (updateResult.rows.length === 0) {
    return null;
  }

  // Fetch the full updated task with assignee name joined
  const result = await pool.query<Task>(
    TASK_SELECT_WITH_ASSIGNEE + ' WHERE t.id = $1',
    [taskId]
  );

  return result.rows[0] ?? null;
}

/**
 * Deletes a task by ID.
 */
export async function deleteTask(taskId: number): Promise<void> {
  await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
}

/**
 * Returns dashboard statistics for a project:
 * - Total tasks and counts by status
 * - Task counts grouped by assignee
 * - List of overdue tasks (due_date < CURRENT_DATE AND status != 'Done')
 */
export async function getDashboardStats(projectId: number): Promise<DashboardStats> {
  const [countsResult, byAssigneeResult, overdueResult] = await Promise.all([
    // Total and by-status counts
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

    // Tasks grouped by assignee
    pool.query<{ userId: number | null; name: string; count: string }>(
      `SELECT
         t.assignee_id as "userId",
         COALESCE(u.name, 'Unassigned') as name,
         COUNT(*) as count
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.project_id = $1
       GROUP BY t.assignee_id, u.name
       ORDER BY count DESC`,
      [projectId]
    ),

    // Overdue tasks
    pool.query<{ id: number; title: string; dueDate: string; assigneeName: string | null }>(
      `SELECT
         t.id,
         t.title,
         t.due_date as "dueDate",
         u.name as "assigneeName"
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.project_id = $1
         AND t.due_date < CURRENT_DATE
         AND t.status != 'Done'
       ORDER BY t.due_date ASC`,
      [projectId]
    ),
  ]);

  const rawCounts = countsResult.rows[0];

  return {
    totalTasks: parseInt(rawCounts.total, 10),
    byStatus: {
      'To Do': parseInt(rawCounts.todo, 10),
      'In Progress': parseInt(rawCounts.inProgress, 10),
      'Done': parseInt(rawCounts.done, 10),
    },
    byAssignee: byAssigneeResult.rows.map(row => ({
      userId: row.userId,
      name: row.name,
      count: parseInt(row.count, 10),
    })),
    overdueTasks: overdueResult.rows,
  };
}

/**
 * Returns all tasks assigned to a specific user across all projects they belong to.
 */
export async function findAllForUser(userId: number): Promise<(Task & { projectName: string })[]> {
  const result = await pool.query<Task & { projectName: string }>(
    `SELECT
       t.id,
       t.project_id as "projectId",
       t.created_by as "createdBy",
       t.assignee_id as "assigneeId",
       t.title,
       t.description,
       t.due_date as "dueDate",
       t.priority,
       t.status,
       t.created_at as "createdAt",
       t.updated_at as "updatedAt",
       u.name as "assigneeName",
       p.name as "projectName"
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     JOIN projects p ON t.project_id = p.id
     WHERE t.assignee_id = $1
     ORDER BY
       CASE t.status WHEN 'To Do' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
       t.due_date ASC NULLS LAST,
       t.created_at DESC`,
    [userId]
  );
  return result.rows;
}
