import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, PageWrapper } from '../components/layout';
import { Button, Input, Modal, Spinner, Badge } from '../components/common';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import type { TaskSummary } from '../types/api';

// ─── Task summary pill row ────────────────────────────────────────────────────

interface TaskSummaryRowProps {
  summary: TaskSummary;
}

const TaskSummaryRow: React.FC<TaskSummaryRowProps> = ({ summary }) => {
  const pillStyle = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: bg,
    color,
  });

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
      <span style={pillStyle('#f3f4f6', '#374151')}>
        Todo: {summary.todo}
      </span>
      <span style={pillStyle('#dbeafe', '#1e40af')}>
        In Progress: {summary.inProgress}
      </span>
      <span style={pillStyle('#d1fae5', '#065f46')}>
        Done: {summary.done}
      </span>
    </div>
  );
};

// ─── New Project Modal Form ───────────────────────────────────────────────────

interface NewProjectFormProps {
  onSubmit: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

const NewProjectForm: React.FC<NewProjectFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting,
  submitError,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Project name is required.');
      return;
    }
    setNameError('');
    await onSubmit(name.trim(), description.trim());
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: '16px' }}>
        <Input
          label="Project name"
          id="new-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Website Redesign"
          error={nameError}
          required
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '4px' }}>
        <label
          htmlFor="new-project-description"
          style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#374151' }}
        >
          Description <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
        </label>
        <textarea
          id="new-project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the project…"
          rows={3}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#111827',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {submitError && (
        <p
          role="alert"
          style={{ marginTop: '12px', fontSize: '13px', color: '#dc2626' }}
        >
          {submitError}
        </p>
      )}

      <div style={footerStyle}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          Create project
        </Button>
      </div>
    </form>
  );
};

// ─── Project List Page ────────────────────────────────────────────────────────

function ProjectListPage(): React.JSX.Element {
  const { projects, isLoading, error, fetchProjects, createProject } = useProjects();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleOpenModal = () => {
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSubmitError(null);
  };

  const handleCreateProject = async (name: string, description: string) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createProject({ name, description: description || undefined });
      setIsModalOpen(false);
      await fetchProjects();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response
        ? (axiosErr.response.data?.message ?? 'Failed to create project. Please try again.')
        : 'Network error. Please check your connection and try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const pageHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  };

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'box-shadow 0.15s',
  };

  const projectNameStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: '#2563eb',
    textDecoration: 'none',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '48px 16px',
    color: '#6b7280',
    fontSize: '15px',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '14px',
  };

  const spinnerWrapStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 0',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <PageWrapper>
        <div style={pageHeaderStyle}>
          <h1 style={headingStyle}>My Projects</h1>
          {isAdmin && (
            <Button variant="primary" onClick={handleOpenModal}>
              + New Project
            </Button>
          )}
        </div>

        {isLoading && (
          <div style={spinnerWrapStyle}>
            <Spinner size="lg" label="Loading projects…" />
          </div>
        )}

        {!isLoading && error && (
          <p role="alert" style={errorStyle}>
            {error}
          </p>
        )}

        {!isLoading && !error && projects.length === 0 && (
          <div style={emptyStyle}>
            {isAdmin ? (
              <>
                <p>You don't have any projects yet.</p>
                <p>Create one to get started!</p>
              </>
            ) : (
              <>
                <p>You haven't been added to any projects yet.</p>
                <p>Ask your admin to add you to a project.</p>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && projects.length > 0 && (
          <ul style={{ ...gridStyle, listStyle: 'none', margin: 0, padding: 0 }}>
            {projects.map((project) => (
              <li key={project.id}>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <Link
                      to={`/projects/${project.id}`}
                      style={projectNameStyle}
                      aria-label={`Open project: ${project.name}`}
                    >
                      {project.name}
                    </Link>
                    <Badge
                      variant="status"
                      value={project.role === 'admin' ? 'Admin' : 'Member'}
                    />
                  </div>

                  {project.description && (
                    <p style={descriptionStyle}>{project.description}</p>
                  )}

                  {project.taskSummary && (
                    <TaskSummaryRow summary={project.taskSummary} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="New Project">
        <NewProjectForm
          onSubmit={handleCreateProject}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </Modal>
    </>
  );
}

export default ProjectListPage;
