import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { requireGlobalRole } from '../middleware/requireGlobalRole';
import { Response, NextFunction } from 'express';
import * as taskRepo from '../repositories/task.repository';
import * as userRepo from '../repositories/user.repository';
import pool from '../db/pool';

const router = Router();

/**
 * GET /api/users/me/tasks
 * Returns all tasks assigned to the currently authenticated user across all projects.
 */
router.get(
  '/me/tasks',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tasks = await taskRepo.findAllForUser(req.user!.id);
      res.status(200).json(tasks);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/search?q=...&projectId=...
 * Search users by name or email, excluding existing project members.
 */
router.get(
  '/search',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = String(req.query.q ?? '').trim();
      const projectId = Number(req.query.projectId);

      if (!q || q.length < 1) {
        res.status(200).json([]);
        return;
      }

      if (!projectId || isNaN(projectId)) {
        res.status(400).json({ message: 'projectId is required' });
        return;
      }

      const users = await userRepo.searchUsers(q, projectId);
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me/overview
 * Admin-only: returns aggregate stats across all projects the admin owns.
 */
router.get(
  '/me/overview',
  authenticate,
  requireGlobalRole('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const [projectsResult, taskStatsResult, recentTasksResult] = await Promise.all([
        // All projects this admin owns
        pool.query<{ id: number; name: string; memberCount: string; taskCount: string; doneCount: string }>(
          `SELECT
             p.id,
             p.name,
             COUNT(DISTINCT pm.user_id) as "memberCount",
             COUNT(DISTINCT t.id) as "taskCount",
             COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done') as "doneCount"
           FROM projects p
           JOIN project_members pm_admin ON p.id = pm_admin.project_id
             AND pm_admin.user_id = $1 AND pm_admin.role = 'admin'
           LEFT JOIN project_members pm ON p.id = pm.project_id
           LEFT JOIN tasks t ON t.project_id = p.id
           GROUP BY p.id, p.name
           ORDER BY p.created_at DESC`,
          [userId]
        ),

        // Task stats across all admin's projects
        pool.query<{ total: string; todo: string; inProgress: string; done: string; overdue: string }>(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE t.status = 'To Do') as todo,
             COUNT(*) FILTER (WHERE t.status = 'In Progress') as "inProgress",
             COUNT(*) FILTER (WHERE t.status = 'Done') as done,
             COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'Done') as overdue
           FROM tasks t
           JOIN project_members pm ON t.project_id = pm.project_id
             AND pm.user_id = $1 AND pm.role = 'admin'`,
          [userId]
        ),

        // 5 most recent tasks across admin's projects
        pool.query<{
          id: number; title: string; status: string; priority: string;
          projectName: string; assigneeName: string | null; dueDate: string | null;
        }>(
          `SELECT
             t.id,
             t.title,
             t.status,
             t.priority,
             p.name as "projectName",
             u.name as "assigneeName",
             t.due_date as "dueDate"
           FROM tasks t
           JOIN projects p ON t.project_id = p.id
           JOIN project_members pm ON t.project_id = pm.project_id
             AND pm.user_id = $1 AND pm.role = 'admin'
           LEFT JOIN users u ON t.assignee_id = u.id
           ORDER BY t.created_at DESC
           LIMIT 10`,
          [userId]
        ),
      ]);

      const raw = taskStatsResult.rows[0];

      res.status(200).json({
        projects: projectsResult.rows.map((p) => ({
          id: p.id,
          name: p.name,
          memberCount: parseInt(p.memberCount, 10),
          taskCount: parseInt(p.taskCount, 10),
          doneCount: parseInt(p.doneCount, 10),
        })),
        taskStats: {
          total: parseInt(raw.total, 10),
          todo: parseInt(raw.todo, 10),
          inProgress: parseInt(raw.inProgress, 10),
          done: parseInt(raw.done, 10),
          overdue: parseInt(raw.overdue, 10),
        },
        recentTasks: recentTasksResult.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
