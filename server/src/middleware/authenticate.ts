import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

interface JwtPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required');
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
    } catch {
      throw new AppError(401, 'Invalid or expired token');
    }

    req.user = {
      id: decoded.sub as number,
      email: decoded.email as string,
    };

    next();
  } catch (error) {
    next(error);
  }
}
