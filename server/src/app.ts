import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // CORS — allow requests only from the configured client origin
  app.use(cors({ origin: env.CLIENT_ORIGIN }));

  // Parse JSON request bodies
  app.use(express.json());

  // Health-check route
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/users', userRoutes);

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
