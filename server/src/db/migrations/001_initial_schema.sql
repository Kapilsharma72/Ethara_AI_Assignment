-- Migration: 001_initial_schema
-- Creates the initial database schema for the Team Task Manager application.

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255)        NOT NULL,
    email         VARCHAR(255)        NOT NULL UNIQUE,
    password_hash VARCHAR(255)        NOT NULL,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Project membership + role
CREATE TABLE IF NOT EXISTS project_members (
    project_id  INT         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     INT         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    project_id  INT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by  INT          NOT NULL REFERENCES users(id),
    assignee_id INT          REFERENCES users(id) ON DELETE SET NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    due_date    DATE,
    priority    VARCHAR(10)  NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'To Do'
                             CHECK (status IN ('To Do', 'In Progress', 'Done')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
-- Used by "list my projects" query which filters by user_id
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- Every task query filters by project; this is the most-used index
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

-- Used by dashboard "tasks per user" aggregation
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);

-- Used by dashboard "tasks by status" aggregation and overdue filter
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Used by overdue task query (due_date < NOW())
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
