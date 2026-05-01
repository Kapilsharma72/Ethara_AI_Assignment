# Team Task Manager

A full-stack web application for managing team projects and tasks. Built with React, Node.js, Express, and PostgreSQL.

Think of it as a lightweight version of Trello or Asana — admins create projects, invite team members, assign tasks, and track progress. Members log in and see exactly what's been assigned to them.


LIVE LINK:👇👇👇
https://ethara-ai-assignment-client.vercel.app/

---

## What it does

**For Admins:**
- Create and manage projects
- Add or remove team members from projects
- Create tasks with title, description, due date, and priority
- Assign tasks to specific team members
- View a project dashboard with task stats, progress by assignee, and overdue tasks
- See an overview of all projects and recent activity

**For Members:**
- Log in and land directly on their personal task list
- See all tasks assigned to them across every project
- Update task status (To Do → In Progress → Done)
- Track their own progress with visual progress bars per project

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Auth | JWT (JSON Web Tokens) |
| Validation | Zod |
| Password hashing | bcrypt |

---

## Project Structure

```
team-task-manager/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/   # AdminOverviewPage, ProjectListPage, ProjectDetailPage, DashboardPage, MyTasksPage
│       ├── components/
│       ├── hooks/
│       ├── contexts/
│       └── types/
├── server/          # Express REST API
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       ├── middleware/
│       ├── schemas/
│       └── db/
│           └── migrations/
└── package.json     # Root workspace config
```

---

## Running Locally

### What you need

- Node.js 18 or later
- npm 9 or later
- PostgreSQL 14 or later running locally

### Steps

**1. Clone the repo**

```bash
git clone <your-repo-url>
cd team-task-manager
```

**2. Install all dependencies**

```bash
npm install
```

**3. Set up the server environment**

Copy the example file and fill in your values:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/team_task_manager
JWT_SECRET=pick-any-random-string-that-is-at-least-32-characters-long
CLIENT_ORIGIN=http://localhost:5173
PORT=3000
```

**4. Set up the client environment**

```bash
cp client/.env.example client/.env
```

The default value (`http://localhost:3000`) works for local development.

**5. Create the database**

```bash
createdb team_task_manager
```

Or create it through pgAdmin / any PostgreSQL client.

**6. Run database migrations**

```bash
npm run db:migrate --workspace=server
```

This creates all the tables (users, projects, project_members, tasks).

**7. Start the servers**

Open two terminals:

```bash
# Terminal 1 — API server on http://localhost:3000
npm run dev --workspace=server

# Terminal 2 — React app on http://localhost:5173
npm run dev --workspace=client
```

Open `http://localhost:5173` in your browser.

---

## How to use it

1. **Register as Admin** — go to `/register`, pick the Admin role, fill in your details
2. **Create a project** — from the Projects page, click "+ New Project"
3. **Add a team member** — register a second account as Member, then from the project page click "+ Add Member" and search by name or email
4. **Create a task** — click "+ New Task", fill in the details, and assign it to the member
5. **Log in as the member** — they'll land on "My Tasks" and see the assigned task
6. **Update status** — the member can change the task status from To Do → In Progress → Done

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get a JWT token |

### Projects
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/projects` | Any member | List all projects for the logged-in user |
| POST | `/api/projects` | Admin only | Create a new project |
| GET | `/api/projects/:id` | Project member | Get project details and members |
| POST | `/api/projects/:id/members` | Project admin | Add a member to the project |
| DELETE | `/api/projects/:id/members/:userId` | Project admin | Remove a member |
| GET | `/api/projects/:id/dashboard` | Project admin | Get task statistics |

### Tasks
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/projects/:id/tasks` | Project member | List all tasks in a project |
| POST | `/api/projects/:id/tasks` | Project admin | Create a new task |
| PATCH | `/api/projects/:id/tasks/:taskId` | Admin (any field) / Member (status only) | Update a task |
| DELETE | `/api/projects/:id/tasks/:taskId` | Project admin | Delete a task |

### Users
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/users/me/tasks` | Any user | Get all tasks assigned to the logged-in user |
| GET | `/api/users/me/overview` | Admin only | Get aggregate stats across all admin's projects |
| GET | `/api/users/search` | Any user | Search users by name or email |

---

## Deploying to Railway

Railway is the recommended platform. You'll deploy three services: a PostgreSQL database, the API, and the frontend.

### 1. Create a Railway project

Sign up at [railway.app](https://railway.app) and create a new project.

### 2. Add PostgreSQL

Click **New → Database → Add PostgreSQL**. Railway provisions it automatically and gives you a `DATABASE_URL`.

### 3. Deploy the API

1. Click **New → GitHub Repo**, connect your repository
2. Set **Root Directory** to `server`
3. Set **Build Command** to `npm run build`
4. Set **Start Command** to `node dist/server.js`
5. Add these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference the Postgres service: `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | A random string, at least 32 characters |
| `CLIENT_ORIGIN` | The public URL of your frontend (set after deploying the frontend) |

6. Under **Deploy → Pre-deploy Command**, set: `npm run db:migrate`

   This runs migrations automatically before each deployment.

### 4. Deploy the Frontend

1. Click **New → GitHub Repo**, connect the same repository
2. Set **Root Directory** to `client`
3. Set **Build Command** to `npm run build`
4. Set **Start Command** to `node serve.js`
5. Add this environment variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | The public URL of your API service |

### 5. Connect the two services

After both are deployed:
1. Copy the public URL of the frontend service
2. Set it as `CLIENT_ORIGIN` on the API service
3. Redeploy the API

That's it — your app is live.

---

## Running Tests

```bash
# Server tests
npm test --workspace=server

# Client tests
npm test --workspace=client
```

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (min 32 chars) |
| `CLIENT_ORIGIN` | Yes | Frontend URL for CORS |
| `PORT` | No | Server port (default: 3000) |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL |
