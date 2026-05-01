import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import pool from '../db/pool';
import { AppError } from '../errors/AppError';

/**
 * Factory that returns an Express middleware enforcing project-scoped role access.
 *
 * Usage:
 *   router.get('/:projectId/...', authenticate, requireRole('member'), handler)
 *   router.post('/:projectId/members', authenticate, requireRole('admin'), handler)
 *
 * The middleware:
 *  1. Reads req.user.id (set by authenticate middleware)
 *  2. Reads req.params.projectId
 *  3. Queries project_members for the user's role in that project
 *  4. Returns 403 if the user is not a member
 *  5. Returns 403 if 'admin' is required but the user only has 'member' role
 *  6. Calls next() if all checks pass
 */
export function requireRole(role: 'admin' | 'member') {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { projectId } = req.params;

      const result = await pool.query<{ role: string }>(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (result.rows.length === 0) {
        return next(new AppError(403, 'Access denied: not a project member'));
      }

      const memberRole = result.rows[0].role;

      if (role === 'admin' && memberRole !== 'admin') {
        return next(new AppError(403, 'Access denied: admin role required'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
