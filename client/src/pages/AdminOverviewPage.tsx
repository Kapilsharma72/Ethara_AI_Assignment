import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, PageWrapper } from '../components/layout';
import { Spinner } from '../components/common';
import apiClient from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectStat {
  id: number;
  name: string;
  memberCount: number;
  taskCount: number;
  doneCount: number;
}

interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}

interface RecentTask {
  id: number;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  projectName: string;
  assigneeName: string | null;
  dueDate: string | null;
}

interface OverviewData {
  projects: ProjectStat[];
  taskStats: TaskStats;
  recentTasks: RecentTask[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(d: string | null, status: string): boolean {
  if (!d || status === 'Done') return false;
  return new Date(d) < new Date(new Date().toDateString());
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: number; icon: string;
  bg: string; border: string; color: string;
}> = ({ label, value, icon, bg, border, color }) => (
  <div style={{
    backgroundColor: bg,
    border: `1px solid ${border}`,
    borderRadius: '10px',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }}>
    <div style={{ fontSize: '32px' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const MiniProgress: React.FC<{ done: number; total: number }> = ({ done, total }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = pct === 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '9999px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'To Do':       { bg: '#f3f4f6', color: '#374151' },
    'In Progress': { bg: '#dbeafe', color: '#1e40af' },
    'Done':        { bg: '#d1fae5', color: '#065f46' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.color }}>
      {status}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, { bg: string; color: string }> = {
    High:   { bg: '#fee2e2', color: '#991b1b' },
    Medium: { bg: '#fef3c7', color: '#92400e' },
    Low:    { bg: '#f0fdf4', color: '#166534' },
  };
  const s = map[priority] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.color }}>
      {priority}
    </span>
  );
};

// ─── Admin Overview Page ──────────────────────────────────────────────────────

function AdminOverviewPage(): React.JSX.Element {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OverviewData>('/api/users/me/overview');
      setData(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to load overview.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOverview(); }, [fetchOverview]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 16px 0',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '2px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'middle',
  };

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '26px', fontWeight: 800, color: '#111827' }}>
            Admin Overview
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            All your projects and task statistics at a glance
          </p>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Spinner size="lg" label="Loading overview…" />
          </div>
        )}

        {!isLoading && error && (
          <div style={{ padding: '16px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* ── Task Stats ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
              marginBottom: '28px',
            }}>
              <StatCard label="Total Tasks"  value={data.taskStats.total}      icon="📋" bg="#f8fafc" border="#e2e8f0" color="#111827" />
              <StatCard label="To Do"        value={data.taskStats.todo}       icon="📝" bg="#f8fafc" border="#e2e8f0" color="#374151" />
              <StatCard label="In Progress"  value={data.taskStats.inProgress} icon="⚡" bg="#eff6ff" border="#bfdbfe" color="#1e40af" />
              <StatCard label="Done"         value={data.taskStats.done}       icon="✅" bg="#f0fdf4" border="#bbf7d0" color="#065f46" />
              <StatCard label="Overdue"      value={data.taskStats.overdue}    icon="⚠️" bg="#fff7ed" border="#fed7aa" color="#9a3412" />
            </div>

            {/* ── Projects Table ── */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={sectionTitle}>My Projects</h2>
                <Link
                  to="/projects"
                  style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                >
                  Manage Projects →
                </Link>
              </div>

              {data.projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '15px' }}>No projects yet.</p>
                  <Link to="/projects" style={{ color: '#2563eb', fontSize: '14px' }}>Create your first project →</Link>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Project</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Members</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Tasks</th>
                        <th style={thStyle}>Progress</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map((p) => (
                        <tr key={p.id}>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#111827' }}>{p.name}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>{p.memberCount}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>{p.taskCount}</td>
                          <td style={{ ...tdStyle, minWidth: '140px' }}>
                            <MiniProgress done={p.doneCount} total={p.taskCount} />
                          </td>
                          <td style={tdStyle}>
                            <Link
                              to={`/projects/${p.id}`}
                              style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Recent Tasks ── */}
            <div style={cardStyle}>
              <h2 style={sectionTitle}>Recent Tasks</h2>
              {data.recentTasks.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>No tasks yet across your projects.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Task</th>
                        <th style={thStyle}>Project</th>
                        <th style={thStyle}>Assignee</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Priority</th>
                        <th style={thStyle}>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTasks.map((t) => {
                        const overdue = isOverdue(t.dueDate, t.status);
                        return (
                          <tr key={t.id} style={overdue ? { backgroundColor: '#fff7f7' } : {}}>
                            <td style={{ ...tdStyle, fontWeight: 500, color: '#111827', maxWidth: '200px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.title}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, color: '#6b7280' }}>{t.projectName}</td>
                            <td style={{ ...tdStyle, color: '#374151' }}>{t.assigneeName ?? '—'}</td>
                            <td style={tdStyle}><StatusBadge status={t.status} /></td>
                            <td style={tdStyle}><PriorityBadge priority={t.priority} /></td>
                            <td style={{
                              ...tdStyle,
                              color: overdue ? '#dc2626' : '#6b7280',
                              fontWeight: overdue ? 600 : 400,
                              whiteSpace: 'nowrap',
                            }}>
                              {formatDate(t.dueDate)}
                              {overdue && <span style={{ marginLeft: '4px', fontSize: '11px' }}>⚠</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </PageWrapper>
    </>
  );
}

export default AdminOverviewPage;
