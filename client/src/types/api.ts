/**
 * Shared TypeScript API types matching all API response shapes.
 * These interfaces are used across the frontend to ensure type safety
 * when consuming the backend REST API.
 */

// Re-export User to keep it consistent with AuthContext
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

// Task summary used in project list and project detail
export interface TaskSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}

// Project list item (returned by GET /api/projects and POST /api/projects)
export interface Project {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  role: 'admin' | 'member';
  taskSummary: TaskSummary;
}

// Project member entry
export interface ProjectMember {
  userId: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

// Full project detail (returned by GET /api/projects/:projectId)
export interface ProjectDetail {
  id: number;
  name: string;
  description?: string;
  members: ProjectMember[];
  taskSummary: TaskSummary;
}

// Task (returned by task CRUD endpoints)
export interface Task {
  id: number;
  projectId: number;
  projectName?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'To Do' | 'In Progress' | 'Done';
  assigneeId?: number | null;
  assigneeName?: string | null;
  createdAt: string;
}

// Dashboard stats — tasks grouped by assignee
export interface ByAssignee {
  userId: number | null;
  name: string;
  count: number;
}

// Dashboard stats — overdue task entry
export interface OverdueTask {
  id: number;
  title: string;
  dueDate: string;
  assigneeName: string | null;
}

// Dashboard stats (returned by GET /api/projects/:projectId/dashboard)
export interface DashboardStats {
  totalTasks: number;
  byStatus: {
    'To Do': number;
    'In Progress': number;
    'Done': number;
  };
  byAssignee: ByAssignee[];
  overdueTasks: OverdueTask[];
}

// Field-level error detail within an API error response
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

// Standard API error envelope (all 4xx/5xx responses)
export interface ApiError {
  message: string;
  errors: ApiErrorDetail[];
}
