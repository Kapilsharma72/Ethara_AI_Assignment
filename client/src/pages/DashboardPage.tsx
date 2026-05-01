import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar, PageWrapper } from '../components/layout';
import { Spinner } from '../components/common';
import apiClient from '../api/client';
import type { DashboardStats, OverdueTask } from '../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { message?: string } } };
  if (!axiosErr?.response) {
    return 'Network error. Please check your connection and try again.';
  }
  return axiosErr.response.data?.message ?? fallback;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#374151',
  margin: '0 0 16px 0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const errorAlertStyle: React.CSSProperties = {
  padding: '16px',
  backgroundColor: '#fee2e2',
  border: '1px solid #fca5a5',
  borderRadius: '8px',
  color: '#991b1b',
  fontSize: '14px',
};

// ─── Status bar chart colors (matching Badge colors) ─────────────────────────

const statusBarColors: Record<string, { bar: string; label: string }> = {
  'To Do':       { bar: '#d1d5db', label: '#374151' },   // grey
  'In Progress': { bar: '#93c5fd', label: '#1e40af' },   // blue
  'Done':        { bar: '#6ee7b7', label: '#065f46' },   // green
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  totalTasks: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ totalTasks }) => (
  <div
    style={{
      ...cardStyle,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
    }}
  >
    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      Total Tasks
    </p>
    <p
      style={{ margin: 0, fontSize: '56px', fontWeight: 800, color: '#111827', lineHeight: 1 }}
      aria-label={`${totalTasks} total tasks`}
    >
      {totalTasks}
    </p>
  </div>
);

// ─── Tasks by Status (CSS horizontal bar chart) ───────────────────────────────

interface StatusChartProps {
  byStatus: DashboardStats['byStatus'];
  totalTasks: number;
}

const StatusChart: React.FC<StatusChartProps> = ({ byStatus, totalTasks }) => {
  const statuses: Array<'To Do' | 'In Progress' | 'Done'> = ['To Do', 'In Progress', 'Done'];

  return (
    <div style={cardStyle}>
      <h2 style={sectionHeadingStyle}>Tasks by Status</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {statuses.map((status) => {
          const count = byStatus[status] ?? 0;
          const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
          const colors = statusBarColors[status];

          return (
            <div key={status}>
              {/* Label row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: colors.label }}>
                  {status}
                </span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  {count} ({pct}%)
                </span>
              </div>
              {/* Bar track */}
              <div
                style={{
                  width: '100%',
                  height: '12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${status}: ${count} tasks (${pct}%)`}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: colors.bar,
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tasks per Assignee ───────────────────────────────────────────────────────

interface AssigneeTableProps {
  byAssignee: DashboardStats['byAssignee'];
}

const AssigneeTable: React.FC<AssigneeTableProps> = ({ byAssignee }) => {
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #e5e7eb',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
  };

  return (
    <div style={cardStyle}>
      <h2 style={sectionHeadingStyle}>Tasks per Assignee</h2>
      {byAssignee.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>No assignee data available.</p>
      ) : (
        <table style={tableStyle} aria-label="Tasks per assignee">
          <thead>
            <tr>
              <th style={thStyle}>Member</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {byAssignee.map((entry) => (
              <tr key={entry.userId ?? `unassigned-${entry.name}`}>
                <td style={tdStyle}>{entry.name}</td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  {entry.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// ─── Overdue Tasks ────────────────────────────────────────────────────────────

interface OverdueListProps {
  overdueTasks: OverdueTask[];
}

const OverdueList: React.FC<OverdueListProps> = ({ overdueTasks }) => (
  <div style={cardStyle}>
    <h2 style={{ ...sectionHeadingStyle, color: '#991b1b' }}>Overdue Tasks</h2>
    {overdueTasks.length === 0 ? (
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
        ✓ No overdue tasks — great work!
      </p>
    ) : (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {overdueTasks.map((task) => (
          <li
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 0',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            {/* Left: title + assignee */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: '0 0 2px 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.title}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {task.assigneeName ?? 'Unassigned'}
              </p>
            </div>
            {/* Right: due date */}
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#dc2626',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Due {formatDate(task.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<DashboardStats>(
          `/api/projects/${projectId}/dashboard`
        );
        if (!cancelled) {
          setStats(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Failed to load dashboard data.'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <PageWrapper>
        {/* Page heading */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            to={`/projects/${projectId}`}
            style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
          >
            ← Back to Project
          </Link>
          <h1
            style={{
              margin: '0 0 4px 0',
              fontSize: '26px',
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Project overview and statistics
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}
          >
            <Spinner size="lg" label="Loading dashboard…" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <p role="alert" style={errorAlertStyle}>
            {error}
          </p>
        )}

        {/* Dashboard content */}
        {!isLoading && !error && stats && (
          <>
            {/* Row 1: Summary */}
            <SummaryCard totalTasks={stats.totalTasks} />

            {/* Row 2: Status chart + Assignee table side by side on wider screens */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                marginBottom: '0',
              }}
            >
              <StatusChart byStatus={stats.byStatus} totalTasks={stats.totalTasks} />
              <AssigneeTable byAssignee={stats.byAssignee} />
            </div>

            {/* Row 3: Overdue tasks */}
            <OverdueList overdueTasks={stats.overdueTasks} />
          </>
        )}
      </PageWrapper>
    </>
  );
}

export default DashboardPage;
