import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { CreateTaskSchema, UpdateTaskSchema } from '../schemas/task.schemas';
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
} from '../controllers/task.controller';

const router = Router({ mergeParams: true });

// Admin-only: create, delete tasks
router.post('/', authenticate, requireRole('admin'), validate(CreateTaskSchema), createTask);
router.delete('/:taskId', authenticate, requireRole('admin'), deleteTask);

// Both admin and member can list/view tasks in their project
router.get('/', authenticate, requireRole('member'), listTasks);
router.get('/:taskId', authenticate, requireRole('member'), getTask);

// Both can update — service enforces that members can only update status of their own tasks
router.patch('/:taskId', authenticate, requireRole('member'), validate(UpdateTaskSchema), updateTask);

export default router;
