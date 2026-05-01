import React, { useEffect, useState, useCallback } from 'react';
import { Navbar, PageWrapper } from '../components/layout';
import { Badge, Spinner } from '../components/common';
import apiClient from '../api/client';
import type { Task } from '../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(dateStr?: string | null, status?: string): boolean {
  if (!dateStr || status === 'Done') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  done: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ done, total }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = pct === 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Progress</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>
          {done}/{total} done ({pct}%)
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '9999px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  borderBottom: '2px solid #e5e7eb',
  whiteSpace: 'nowrap' as const,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
  fontSize: '14px',
};

const statusSelectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '13px',
  color: '#111827',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  outline: 'none',
  cursor: 'pointer',
};

const errorAlertStyle: React.CSSProperties = {
  padding: '12px 16px',
  backgroundColor: '#fee2e2',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  color: '#991b1b',
  fontSize: '14px',
};

// ─── My Tasks Page ────────────────────────────────────────────────────────────

function MyTasksPage(): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchMyTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Task[]>('/api/users/me/tasks');
      setTasks(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response
        ? (axiosErr.response.data?.message ?? 'Failed to load tasks.')
        : 'Network error. Please check your connection and try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyTasks();
  }, [fetchMyTasks]);

  const handleStatusChange = async (task: Task, newStatus: 'To Do' | 'In Progress' | 'Done') => {
    setUpdatingId(task.id);
    try {
      const response = await apiClient.patch<Task>(
        `/api/projects/${task.projectId}/tasks/${task.id}`,
        { status: newStatus }
      );
      setTasks((prev) => prev.map((t) => (t.id === task.id ? response.data : t)));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTasks =
    filterStatus === 'all' ? tasks : tasks.filter((t) => t.status === filterStatus);

  // Summary counts
  const counts = {
    todo: tasks.filter((t) => t.status === 'To Do').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    done: tasks.filter((t) => t.status === 'Done').length,
    overdue: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
  };

  // Group tasks by project for progress section
  const byProject = tasks.reduce<Record<string, { name: string; tasks: Task[] }>>((acc, task) => {
    const key = String(task.projectId);
    if (!acc[key]) {
      acc[key] = { name: task.projectName ?? `Project #${task.projectId}`, tasks: [] };
    }
    acc[key].tasks.push(task);
    return acc;
  }, {});

  return (
    <>
      <Navbar />
      <PageWrapper>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '26px', fontWeight: 700, color: '#111827' }}>
            My Tasks
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            All tasks assigned to you across your projects
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Spinner size="lg" label="Loading your tasks…" />
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <p role="alert" style={errorAlertStyle}>{error}</p>
        )}

        {/* Empty state */}
        {!isLoading && !error && tasks.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
            <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>📋</p>
            <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', color: '#374151' }}>
              No tasks assigned to you yet
            </p>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Ask your project admin to assign tasks to you.
            </p>
          </div>
        )}

        {!isLoading && !error && tasks.length > 0 && (
          <>
            {/* Summary cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}>
              {[
                { label: 'To Do', count: counts.todo, bg: '#f8fafc', border: '#e2e8f0', color: '#374151', icon: '📝' },
                { label: 'In Progress', count: counts.inProgress, bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: '⚡' },
                { label: 'Done', count: counts.done, bg: '#f0fdf4', border: '#bbf7d0', color: '#065f46', icon: '✅' },
                { label: 'Overdue', count: counts.overdue, bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', icon: '⚠️' },
              ].map(({ label, count, bg, border, color, icon }) => (
                <div
                  key={label}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: bg,
                    border: `1px solid ${border}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Progress per project */}
            {Object.keys(byProject).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 12px 0' }}>
                  Progress by Project
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                }}>
                  {Object.entries(byProject).map(([projectId, { name, tasks: ptasks }]) => {
                    const done = ptasks.filter((t) => t.status === 'Done').length;
                    const inProgress = ptasks.filter((t) => t.status === 'In Progress').length;
                    const todo = ptasks.filter((t) => t.status === 'To Do').length;
                    return (
                      <div key={projectId} style={{ ...cardStyle, marginBottom: 0, padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                          {name}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                          <span>📝 {todo} To Do</span>
                          <span>⚡ {inProgress} In Progress</span>
                          <span>✅ {done} Done</span>
                        </div>
                        <ProgressBar done={done} total={ptasks.length} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="status-filter" style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                Filter:
              </label>
              {['all', 'To Do', 'In Progress', 'Done'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: '1px solid',
                    cursor: 'pointer',
                    backgroundColor: filterStatus === s ? '#1e293b' : '#ffffff',
                    color: filterStatus === s ? '#ffffff' : '#374151',
                    borderColor: filterStatus === s ? '#1e293b' : '#d1d5db',
                  }}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>

            {/* Tasks table */}
            {filteredTasks.length > 0 ? (
              <div style={cardStyle}>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}
                    aria-label="My assigned tasks"
                  >
                    <thead>
                      <tr>
                        <th style={thStyle}>Task</th>
                        <th style={thStyle}>Project</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Priority</th>
                        <th style={thStyle}>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const overdue = isOverdue(task.dueDate, task.status);
                        return (
                          <tr
                            key={task.id}
                            style={overdue ? { backgroundColor: '#fff7f7' } : {}}
                          >
                            <td style={{ ...tdStyle, fontWeight: 500, color: '#111827', maxWidth: '240px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {task.description}
                                </div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, color: '#374151', fontWeight: 500 }}>
                              {task.projectName ?? `Project #${task.projectId}`}
                            </td>
                            <td style={tdStyle}>
                              {/* Members can only update status */}
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  void handleStatusChange(task, e.target.value as 'To Do' | 'In Progress' | 'Done')
                                }
                                disabled={updatingId === task.id}
                                style={statusSelectStyle}
                                aria-label={`Status for ${task.title}`}
                              >
                                <option value="To Do">To Do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Done">Done</option>
                              </select>
                            </td>
                            <td style={tdStyle}>
                              <Badge variant="priority" value={task.priority} />
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                color: overdue ? '#dc2626' : '#6b7280',
                                fontWeight: overdue ? 600 : 400,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDate(task.dueDate)}
                              {overdue && (
                                <span style={{ marginLeft: '4px', fontSize: '11px' }}>⚠ Overdue</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                No tasks with status "{filterStatus}".
              </div>
            )}
          </>
        )}
      </PageWrapper>
    </>
  );
}

export default MyTasksPage;
