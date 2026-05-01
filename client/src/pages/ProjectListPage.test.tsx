import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import ProjectListPage from './ProjectListPage';
import type { Project } from '../types/api';

// Mock apiClient so we control all HTTP calls
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock useNavigate and Link to avoid router issues
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) =>
      React.createElement('a', { href: to, ...rest }, children),
  };
});

import apiClient from '../api/client';

const mockedGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as ReturnType<typeof vi.fn>;

const TEST_USER = { id: 1, name: 'Alice', email: 'alice@example.com' };
const TEST_TOKEN = 'test-token';

function renderProjectListPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProjectListPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

const sampleProjects: Project[] = [
  {
    id: 1,
    name: 'Website Redesign',
    description: 'Revamp the company website',
    createdAt: '2024-01-01T00:00:00Z',
    role: 'admin',
    taskSummary: { total: 5, todo: 2, inProgress: 2, done: 1 },
  },
  {
    id: 2,
    name: 'Mobile App',
    description: undefined,
    createdAt: '2024-01-02T00:00:00Z',
    role: 'member',
    taskSummary: { total: 3, todo: 1, inProgress: 1, done: 1 },
  },
];

describe('ProjectListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Pre-populate localStorage so AuthProvider considers the user logged in
    localStorage.setItem('token', TEST_TOKEN);
    localStorage.setItem('user', JSON.stringify(TEST_USER));
  });

  it('shows empty state message when no projects exist', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByText(/you don't belong to any projects yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/create one to get started/i)).toBeInTheDocument();
  });

  it('renders project cards correctly when projects are returned', async () => {
    mockedGet.mockResolvedValueOnce({ data: sampleProjects });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    // Project names
    expect(screen.getByText('Mobile App')).toBeInTheDocument();

    // Role badges
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();

    // Task summary pills — first project has todo:2, inProgress:2, done:1
    expect(screen.getByText('Todo: 2')).toBeInTheDocument();
    expect(screen.getByText('In Progress: 2')).toBeInTheDocument();
    // Both projects have done:1, so use getAllByText
    expect(screen.getAllByText('Done: 1').length).toBeGreaterThanOrEqual(1);

    // Description for first project
    expect(screen.getByText('Revamp the company website')).toBeInTheDocument();
  });

  it('shows loading spinner while projects are being fetched', async () => {
    // Return a promise that never resolves during this test to keep loading state
    let resolveGet!: (value: unknown) => void;
    mockedGet.mockReturnValueOnce(new Promise((res) => { resolveGet = res; }));

    renderProjectListPage();

    // Spinner should be visible while loading
    expect(screen.getByLabelText('Loading projects…')).toBeInTheDocument();

    // Resolve to avoid act() warnings
    resolveGet({ data: [] });
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading projects…')).not.toBeInTheDocument();
    });
  });

  it('shows error message when project fetch fails', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { data: { message: 'Server error occurred' } },
    });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error occurred');
    });
  });

  it('"New Project" button opens the modal', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ data: [] });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByText(/you don't belong to any projects yet/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ new project/i }));

    expect(screen.getByText('New Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
  });

  it('submitting the "New Project" form calls the create API and closes the modal on success', async () => {
    const user = userEvent.setup();
    const newProject: Project = {
      id: 3,
      name: 'New App',
      createdAt: '2024-01-03T00:00:00Z',
      role: 'admin',
    };

    // First call: initial fetchProjects, second call: refetch after create
    mockedGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [newProject] });
    mockedPost.mockResolvedValueOnce({ data: newProject });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByText(/you don't belong to any projects yet/i)).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getByRole('button', { name: /\+ new project/i }));
    expect(screen.getByText('New Project')).toBeInTheDocument();

    // Fill in the form
    await user.type(screen.getByLabelText(/project name/i), 'New App');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    // API should have been called with the project name
    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith('/api/projects', {
        name: 'New App',
        description: undefined,
      });
    });

    // Modal should close after success
    await waitFor(() => {
      expect(screen.queryByText('New Project')).not.toBeInTheDocument();
    });

    // The new project should appear after refetch
    await waitFor(() => {
      expect(screen.getByText('New App')).toBeInTheDocument();
    });
  });

  it('shows error in modal when project creation fails', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ data: [] });
    mockedPost.mockRejectedValueOnce({
      response: { data: { message: 'Project name already taken' } },
    });

    renderProjectListPage();

    await waitFor(() => {
      expect(screen.getByText(/you don't belong to any projects yet/i)).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getByRole('button', { name: /\+ new project/i }));

    // Fill in the form and submit
    await user.type(screen.getByLabelText(/project name/i), 'Duplicate Project');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    // Error message should appear inside the modal
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Project name already taken');
    });

    // Modal should remain open
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });
});
