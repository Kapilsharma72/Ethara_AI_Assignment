import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar, PageWrapper } from '../components/layout';
import { Button, Input, Badge, Modal, Spinner } from '../components/common';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import apiClient from '../api/client';
import type { ProjectDetail, ProjectMember, Task } from '../types/api';
import type { CreateTaskData, UpdateTaskData } from '../hooks/useTasks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { message?: string } } };
  if (!axiosErr?.response) {
    return 'Network error. Please check your connection and try again.';
  }
  return axiosErr.response.data?.message ?? fallback;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#111827',
  margin: '0 0 16px 0',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '32px',
};

const errorAlertStyle: React.CSSProperties = {
  padding: '10px 14px',
  backgroundColor: '#fee2e2',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  color: '#991b1b',
  fontSize: '13px',
  marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#374151',
};

const selectStyle: React.CSSProperties = {
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
};

const formGroupStyle: React.CSSProperties = { marginBottom: '16px' };

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface UserSearchResult {
  id: number;
  name: string;
  email: string;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userId: number) => Promise<void>;
  projectId: number;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onSubmit, projectId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searched, setSearched] = useState(false); // true after at least one search completes
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input after modal animation settles — avoids fighting with Modal's focus trap
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const reset = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setSelected(null);
    setSubmitError(null);
    setShowDropdown(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 1) {
      setResults([]);
      setSearched(false);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get<UserSearchResult[]>(
          `/api/users/search?q=${encodeURIComponent(val.trim())}&projectId=${projectId}`
        );
        setResults(res.data);
        setSearched(true);
        setShowDropdown(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelect = (user: UserSearchResult) => {
    setSelected(user);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleClearSelected = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(selected.id);
      handleClose();
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Failed to add member.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    zIndex: 200,
    maxHeight: '220px',
    overflowY: 'auto',
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Member">
      <form onSubmit={handleSubmit} noValidate>

        {/* Search input */}
        <div style={{ ...formGroupStyle, position: 'relative' }}>
          <label htmlFor="add-member-search" style={labelStyle}>
            Search by name or email
          </label>
          <input
            ref={inputRef}
            id="add-member-search"
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (query.trim().length > 0) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Type a name or email…"
            autoComplete="off"
            style={inputStyle}
          />

          {/* Dropdown */}
          {showDropdown && !selected && (
            <div style={dropdownStyle}>
              {isSearching && (
                <div style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>
                  Searching…
                </div>
              )}
              {!isSearching && searched && results.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>
                  No users found for "{query}"
                </div>
              )}
              {!isSearching && results.map((user) => (
                <div
                  key={user.id}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(user); }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f4f6'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected user chip */}
        {selected && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            marginBottom: '16px',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{selected.name}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{selected.email}</div>
            </div>
            <button
              type="button"
              onMouseDown={handleClearSelected}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '18px',
                lineHeight: 1,
                padding: '4px',
              }}
              aria-label="Clear selection"
            >
              ✕
            </button>
          </div>
        )}

        {submitError && (
          <p role="alert" style={{ ...errorAlertStyle, marginBottom: '12px' }}>
            {submitError}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!selected}>
            Add Member
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── New Task Modal ───────────────────────────────────────────────────────────

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskData) => Promise<void>;
  members: ProjectMember[];
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onSubmit, members }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [titleError, setTitleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('Medium');
    setAssigneeId('');
    setTitleError('');
    setSubmitError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Title is required.');
      return;
    }
    setTitleError('');
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      });
      resetForm();
      onClose();
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Failed to create task.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Task">
      <form onSubmit={handleSubmit} noValidate>
        <div style={formGroupStyle}>
          <Input
            label="Title"
            id="new-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            error={titleError}
            required
            autoFocus
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="new-task-description" style={labelStyle}>
            Description{' '}
            <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
          </label>
          <textarea
            id="new-task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description…"
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

        <div style={formGroupStyle}>
          <Input
            label="Due date"
            id="new-task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="new-task-priority" style={labelStyle}>
            Priority
          </label>
          <select
            id="new-task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High')}
            style={selectStyle}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="new-task-assignee" style={labelStyle}>
            Assignee{' '}
            <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
          </label>
          <select
            id="new-task-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {submitError && (
          <p role="alert" style={errorAlertStyle}>
            {submitError}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Members Section ──────────────────────────────────────────────────────────

interface MembersSectionProps {
  members: ProjectMember[];
  isAdmin: boolean;
  projectId: number;
  onAddMember: (userId: number) => Promise<void>;
  onRemoveMember: (userId: number) => Promise<void>;
}

const MembersSection: React.FC<MembersSectionProps> = ({
  members,
  isAdmin,
  projectId,
  onAddMember,
  onRemoveMember,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleRemove = async (userId: number) => {
    setRemovingId(userId);
    setRemoveError(null);
    try {
      await onRemoveMember(userId);
    } catch (err) {
      setRemoveError(extractErrorMessage(err, 'Failed to remove member.'));
    } finally {
      setRemovingId(null);
    }
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
    gap: '12px',
  };

  const memberInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  };

  const memberNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const memberEmailStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <h2 style={sectionHeadingStyle}>Members</h2>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            + Add Member
          </Button>
        )}
      </div>

      {removeError && (
        <p role="alert" style={errorAlertStyle}>
          {removeError}
        </p>
      )}

      {members.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>No members yet.</p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {members.map((member) => (
          <li key={member.userId} style={rowStyle}>
            <div style={memberInfoStyle}>
              <span style={memberNameStyle}>{member.name}</span>
              <span style={memberEmailStyle}>{member.email}</span>
            </div>
            <Badge
              variant="status"
              value={member.role === 'admin' ? 'Admin' : 'Member'}
            />
            {isAdmin && member.role !== 'admin' && (
              <Button
                variant="danger"
                size="sm"
                isLoading={removingId === member.userId}
                onClick={() => void handleRemove(member.userId)}
                aria-label={`Remove ${member.name}`}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={onAddMember}
        projectId={projectId}
      />
    </div>
  );
};

// ─── Assignee Cell ────────────────────────────────────────────────────────────

interface AssigneeCellProps {
  task: Task;
  members: ProjectMember[];
  onUpdate: (assigneeId: number | null) => void;
}

const AssigneeCell: React.FC<AssigneeCellProps> = ({ task, members, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(task.assigneeId ? String(task.assigneeId) : '');
  const selectRef = React.useRef<HTMLSelectElement>(null);

  // Sync if task changes externally
  React.useEffect(() => {
    setValue(task.assigneeId ? String(task.assigneeId) : '');
  }, [task.assigneeId]);

  const handleOpen = () => {
    setEditing(true);
    setTimeout(() => selectRef.current?.focus(), 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setValue(val);
    setEditing(false);
    onUpdate(val ? Number(val) : null);
  };

  const handleBlur = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{
          padding: '4px 8px',
          fontSize: '13px',
          color: '#111827',
          backgroundColor: '#ffffff',
          border: '1px solid #2563eb',
          borderRadius: '6px',
          outline: 'none',
          cursor: 'pointer',
          minWidth: '130px',
        }}
        aria-label={`Assign task: ${task.title}`}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
    );
  }

  if (task.assigneeName) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#374151' }}>{task.assigneeName}</span>
        <button
          type="button"
          onClick={handleOpen}
          title="Change assignee"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9ca3af',
            fontSize: '13px',
            padding: '2px 4px',
            borderRadius: '4px',
            lineHeight: 1,
          }}
          aria-label={`Change assignee for ${task.title}`}
        >
          ✎
        </button>
      </div>
    );
  }

  // Unassigned — show Assign button
  return (
    <button
      type="button"
      onClick={handleOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#2563eb',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '9999px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
      aria-label={`Assign task: ${task.title}`}
    >
      + Assign
    </button>
  );
};

// ─── Tasks Section ────────────────────────────────────────────────────────────

interface TasksSectionProps {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  currentUserId: number;
  members: ProjectMember[];
  onCreateTask: (data: CreateTaskData) => Promise<void>;
  onUpdateTask: (taskId: number, data: UpdateTaskData) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
}

const TasksSection: React.FC<TasksSectionProps> = ({
  tasks,
  isLoading,
  error,
  isAdmin,
  currentUserId,
  members,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const handleDelete = async (taskId: number) => {
    setDeletingId(taskId);
    setDeleteError(null);
    try {
      await onDeleteTask(taskId);
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Failed to delete task.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: 'To Do' | 'In Progress' | 'Done') => {
    setStatusUpdatingId(task.id);
    try {
      await onUpdateTask(task.id, { status: newStatus });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Table styles
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
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
  };

  const statusSelectStyle: React.CSSProperties = {
    ...selectStyle,
    width: 'auto',
    padding: '4px 8px',
    fontSize: '13px',
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <h2 style={sectionHeadingStyle}>Tasks</h2>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setIsNewTaskModalOpen(true)}>
            + New Task
          </Button>
        )}
      </div>

      {deleteError && (
        <p role="alert" style={errorAlertStyle}>
          {deleteError}
        </p>
      )}

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner size="md" label="Loading tasks…" />
        </div>
      )}

      {!isLoading && error && (
        <p role="alert" style={errorAlertStyle}>
          {error}
        </p>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          {isAdmin ? 'No tasks yet. Create one to get started!' : 'No tasks assigned to you in this project.'}
        </p>
      )}

      {!isLoading && !error && tasks.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle} aria-label="Project tasks">
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Assignee</th>
                {(isAdmin || tasks.some((t) => t.assigneeId === currentUserId)) && (
                  <th style={thStyle}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isAssignee = task.assigneeId === currentUserId;
                const showActions = isAdmin || isAssignee;

                return (
                  <tr key={task.id}>
                    <td style={{ ...tdStyle, fontWeight: 500, color: '#111827' }}>
                      {task.title}
                    </td>
                    <td style={tdStyle}>
                      {isAssignee ? (
                        <select
                          value={task.status}
                          onChange={(e) =>
                            void handleStatusChange(
                              task,
                              e.target.value as 'To Do' | 'In Progress' | 'Done'
                            )
                          }
                          disabled={statusUpdatingId === task.id}
                          style={statusSelectStyle}
                          aria-label={`Status for ${task.title}`}
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                        </select>
                      ) : (
                        <Badge variant="status" value={task.status} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <Badge variant="priority" value={task.priority} />
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {formatDate(task.dueDate)}
                    </td>
                    <td style={{ ...tdStyle, color: '#374151' }}>
                      {isAdmin ? (
                        <AssigneeCell
                          task={task}
                          members={members}
                          onUpdate={(assigneeId) => void onUpdateTask(task.id, { assigneeId })}
                        />
                      ) : (
                        task.assigneeName ?? '—'
                      )}
                    </td>
                    {showActions && (
                      <td style={tdStyle}>
                        {isAdmin && (
                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={deletingId === task.id}
                            onClick={() => void handleDelete(task.id)}
                            aria-label={`Delete task: ${task.title}`}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onSubmit={onCreateTask}
        members={members}
      />
    </div>
  );
};

// ─── Project Detail Page ──────────────────────────────────────────────────────

function ProjectDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user } = useAuth();

  const { fetchProjectDetail, addMember, removeMember } = useProjects();
  const { tasks, isLoading: tasksLoading, error: tasksError, fetchTasks, createTask, updateTask, deleteTask } =
    useTasks();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Determine if current user is admin of this project
  const isAdmin = project?.members.some(
    (m) => m.userId === user?.id && m.role === 'admin'
  ) ?? false;

  // Members only see their own assigned tasks; admins see all
  const visibleTasks = isAdmin
    ? tasks
    : tasks.filter((t) => t.assigneeId === user?.id);

  const loadProject = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const detail = await fetchProjectDetail(projectId);
      setProject(detail);
    } catch (err) {
      setPageError(extractErrorMessage(err, 'Failed to load project.'));
    } finally {
      setPageLoading(false);
    }
  }, [fetchProjectDetail, projectId]);

  useEffect(() => {
    void loadProject();
    void fetchTasks(projectId);
  }, [loadProject, fetchTasks, projectId]);

  const handleAddMember = async (userId: number) => {
    await addMember(projectId, userId);
    await loadProject();
  };

  const handleRemoveMember = async (userId: number) => {
    await removeMember(projectId, userId);
    await loadProject();
  };

  const handleCreateTask = async (data: CreateTaskData) => {
    await createTask(projectId, data);
  };

  const handleUpdateTask = async (taskId: number, data: UpdateTaskData) => {
    await updateTask(projectId, taskId, data);
  };

  const handleDeleteTask = async (taskId: number) => {
    await deleteTask(projectId, taskId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageHeaderStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const headingStyle: React.CSSProperties = {
    margin: '0 0 4px 0',
    fontSize: '26px',
    fontWeight: 700,
    color: '#111827',
  };

  const descriptionStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  };

  const spinnerWrapStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: '80px 0',
  };

  const fullErrorStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '14px',
    marginTop: '24px',
  };

  return (
    <>
      <Navbar />
      <PageWrapper>
        {pageLoading && (
          <div style={spinnerWrapStyle}>
            <Spinner size="lg" label="Loading project…" />
          </div>
        )}

        {!pageLoading && pageError && (
          <p role="alert" style={fullErrorStyle}>
            {pageError}
          </p>
        )}

        {!pageLoading && !pageError && project && (
          <>
            <div style={pageHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={headingStyle}>{project.name}</h1>
                  {project.description && (
                    <p style={descriptionStyle}>{project.description}</p>
                  )}
                </div>
                {/* Dashboard link — admin only */}
                {isAdmin && (
                  <Link
                    to={`/projects/${projectId}/dashboard`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      color: '#1e293b',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    📊 Dashboard
                  </Link>
                )}
              </div>
            </div>

            <MembersSection
              members={project.members}
              isAdmin={isAdmin}
              projectId={projectId}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
            />

            <TasksSection
              tasks={visibleTasks}
              isLoading={tasksLoading}
              error={tasksError}
              isAdmin={isAdmin}
              currentUserId={user?.id ?? -1}
              members={project.members}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          </>
        )}
      </PageWrapper>
    </>
  );
}

export default ProjectDetailPage;
