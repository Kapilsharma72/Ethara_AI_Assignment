import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import pool from '../db/pool';
import { AppError } from '../errors/AppError';

/**
 * Middleware that checks the user's GLOBAL role (stored in users.role).
 * Used for actions like creating projects that require a global admin role.
 */
export function requireGlobalRole(role: 'admin' | 'member') {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      const result = await pool.query<{ role: string }>(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return next(new AppError(403, 'Access denied'));
      }

      const userRole = result.rows[0].role;

      if (role === 'admin' && userRole !== 'admin') {
        return next(new AppError(403, 'Access denied: only admins can create projects'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
