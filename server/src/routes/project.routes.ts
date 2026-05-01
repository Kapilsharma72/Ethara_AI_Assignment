import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { requireGlobalRole } from '../middleware/requireGlobalRole';
import { validate } from '../middleware/validate';
import { CreateProjectSchema, AddMemberSchema } from '../schemas/project.schemas';
import {
  listProjects,
  createProject,
  getProject,
  addMember,
  removeMember,
  getDashboard,
} from '../controllers/project.controller';
import taskRoutes from './task.routes';

const router = Router();

router.use('/:projectId/tasks', taskRoutes);

// Any authenticated user can list their projects
router.get('/', authenticate, listProjects);

// Only global admins can create projects
router.post('/', authenticate, requireGlobalRole('admin'), validate(CreateProjectSchema), createProject);

// Any project member can view project detail
router.get('/:projectId', authenticate, requireRole('member'), getProject);

// Only project admins can manage members
router.post('/:projectId/members', authenticate, requireRole('admin'), validate(AddMemberSchema), addMember);
router.delete('/:projectId/members/:userId', authenticate, requireRole('admin'), removeMember);

// Only project admins can view dashboard stats
router.get('/:projectId/dashboard', authenticate, requireRole('admin'), getDashboard);

export default router;
