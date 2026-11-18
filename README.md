# Navigate: AI-Powered Assessment & Adaptive Learning

https://github.com/user-attachments/assets/0da1f349-d2b1-4282-90f7-f40f75e68950

Navigate is a multi-tenant SaaS for institutions (colleges, training institutes, corporate learning teams). Each customer gets a private workspace where instructors build assessments (with AI help from a syllabus), students take them under a server-kept timer with optional proctoring, and the results feed grading, analytics and a personal adaptive learning path for every student.

## Feature highlights

- **Workspaces and roles**: owner, admin, instructor and student; invite links, course join codes, plans with seat/student/AI limits.
- **Assessments**: five question types, question bank, AI question generation from a syllabus, autosave, server-side timer and attempts.
- **Exam integrity**: full-screen, tab, shortcut, paste and camera monitoring with a violation limit; similarity check on written answers.
- **Grading and results**: automatic grading, manual review and overrides, results-release control, gradebook with CSV export.
- **Analytics**: staff dashboard, topic-mastery heatmap, question (item) analysis, at-risk students.
- **Adaptive learning**: per-course study plan with AI recommendations and one-click practice quizzes on weak topics.
- **Operations**: audit log, notifications, rate limits, health checks, light and dark themes.

Every feature is described in plain English in [docs/FEATURES.md](docs/FEATURES.md), including its known limitations (demo billing, no email provider, no SSO).

## Architecture

```
Browser ──▶ frontend (React 18 + MUI 5, served by nginx in Docker, CRA dev server locally)
               │  /api  (proxied)
               ▼
            backend (Node.js + Express + Mongoose) ──▶ MongoDB
               │  require('../ai_services/...')
               ▼
            ai_services (Gemini calls, syllabus analysis, similarity detection)
```

- **frontend**: React 18, Material UI, React Router, Chart.js. One API layer in `src/api`.
- **backend**: Express 4 REST API under `/api`, Mongoose models, JWT access and refresh tokens, Jest + Supertest tests.
- **ai_services**: plain Node modules loaded in-process by the backend (not a separate server). They need their own `npm install`.
- **MongoDB**: one database; every document carries its workspace.

The API contract, data model and business rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Per-area engineering notes are in [docs/notes](docs/notes).

## Prerequisites

- Node.js 20 or newer (and npm 9+)
- MongoDB 6 or newer running locally, or a MongoDB Atlas connection string (Docker users get MongoDB from Compose)
- A Google Gemini API key (optional locally: without it AI features fall back to templates)
- Docker with Compose v2 (only for the Docker deployment)

## Local setup

Run all commands from the repository root. Windows commands are for PowerShell; macOS/Linux commands are for bash or zsh.

### 1. Install dependencies

The backend loads `../ai_services`, which resolves its own `node_modules`, so install in all three folders.

```bash
cd backend && npm install && cd ..
cd ai_services && npm install && cd ..
cd frontend && npm install && cd ..
```

On PowerShell use `;` instead of `&&`, for example `cd backend; npm install; cd ..`.

### 2. Configure the backend

```bash
# macOS / Linux
cp backend/.env.example backend/.env
```

```powershell
# Windows PowerShell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env`. For local development the defaults work; add `GEMINI_API_KEY` to enable real AI output.

### 3. Start MongoDB

Use an existing local install, or start one with Docker:

```bash
docker run -d --name navigate-mongo -p 27017:27017 mongo:7
```

On Windows with MongoDB installed as a service it is usually already running. The default URI is `mongodb://127.0.0.1:27017/navigate`.

### 4. Load demo data (optional but recommended)

```bash
cd backend
npm run seed
```

This rebuilds only the demo workspace "Northwind Institute of Technology" (1 owner, 2 instructors, 25 students, 3 courses, 11 assessments, about 110 graded submissions) and prints the logins. It is safe to run repeatedly.

### 5. Start the backend (port 5000)

```bash
cd backend
npm start          # or: npm run dev   (restarts on file changes)
```

### 6. Start the frontend (port 3000)

In a second terminal:

```bash
cd frontend
npm start
```

Open http://localhost:3000. The frontend dev server proxies `/api` to http://localhost:5000.

## Demo logins

Created by `npm run seed`. The password for every account is `Navigate123`.

| Role | Email | Notes |
|---|---|---|
| Owner | `owner@northwind.edu` | Margaret Chen; billing, members, audit log |
| Instructor | `priya.sharma@northwind.edu` | Teaches Data Structures & Algorithms, Database Systems |
| Instructor | `daniel.okafor@northwind.edu` | Teaches Web Development, Database Systems |
| Student | `aarav.patel@northwind.edu` | Strong student |
| Student | `noah.johnson@northwind.edu` | At-risk student, one terminated attempt |
| Students | `firstname.lastname@northwind.edu` | 25 students in total |

The seed also prints a pending instructor invite code. To try the sign-up flow yourself, choose "Create a workspace" on the register page.

## Running tests

Backend tests use Jest and Supertest against a real MongoDB. The target database must have "test" in its name because the tests wipe it.

```bash
cd backend
npm test
```

Set `MONGO_URI_TEST` to point somewhere else, for example `MONGO_URI_TEST=mongodb://127.0.0.1:27017/navigate_test npm test` (bash) or `$env:MONGO_URI_TEST="mongodb://127.0.0.1:27017/navigate_test"; npm test` (PowerShell). Without it, each suite falls back to its own `navigate_test_*` database on localhost.

Frontend checks used by CI:

```bash
cd frontend
npx eslint --max-warnings 0 src
npm run build
```

## Environment variables

Configured in `backend/.env` (template: [backend/.env.example](backend/.env.example)). The frontend needs none.

| Variable | Default | Production | Purpose |
|---|---|---|---|
| `NODE_ENV` | `development` | set to `production` | Enables production safety checks and strict defaults |
| `PORT` | `5000` | optional | API port |
| `MONGO_URI` | local MongoDB | **required** | MongoDB connection string. In production there is no fallback |
| `MONGO_URI_FALLBACK` | local MongoDB | not used | Used outside production if `MONGO_URI` is unreachable |
| `MONGO_URI_TEST` | local `navigate_test*` | n/a | Database wiped by `npm test` (name must contain "test") |
| `JWT_SECRET` | dev-only value | **required**, 32+ random characters | Signs access tokens. The server refuses to start in production without it |
| `REFRESH_TOKEN_SECRET` | derived from `JWT_SECRET` | recommended | Signs refresh tokens |
| `APP_URL` | `http://localhost:3000` | **required** | Public URL of the web app, used in invite and reset links |
| `CORS_ORIGINS` | `http://localhost:3000` | **required** | Comma-separated browser origins allowed to call the API |
| `TRUST_PROXY` | empty | set to the number of proxy hops | So rate limits and the audit log see client IPs behind a load balancer |
| `LOG_LEVEL` | `info` | optional | `debug`, `info`, `warn`, `error` or `silent` (JSON logs) |
| `BILLING_MODE` | `demo` (dev), `contact-sales` (prod) | decide explicitly | `demo` applies plan changes instantly with no payment; `contact-sales` records a request |
| `RATE_LIMIT_AUTH_MAX` | `20` | optional | Auth attempts per 15 min per IP |
| `RATE_LIMIT_GENERAL_MAX` | `600` | optional | API calls per 15 min per IP |
| `RATE_LIMIT_AI_MAX` | `20` | optional | AI calls per minute per user |
| `GEMINI_API_KEY` | none | **recommended** (paid key) | Google Gemini for syllabus analysis, question generation and recommendations |
| `GEMINI_MODEL` | `gemini-1.5-flash` | optional | Preferred model; retired names are skipped automatically and fallbacks are tried |
| `HUGGINGFACE_API_KEY` | none | optional | Optional embeddings for the similarity check and an extra AI fallback |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | optional | Embedding model used with the Hugging Face key |
| `SMTP_*` | none | reserved | Present in the template but **not used yet**: emails are written to the server log |

`.env.example` also lists legacy keys (`OPENAI_API_KEY`, `GPTZERO_API_KEY`, `TURNITIN_API_KEY`, `AWS_*`, `ENABLE_MOCK_DATA`) that only optional or old integration code reads. Leave them unset.

## Deployment

### Docker Compose

Compose runs three containers: MongoDB (named volume), the API, and nginx serving the web app and proxying `/api`.

```bash
cp backend/.env.example backend/.env     # Windows: Copy-Item backend\.env.example backend\.env
# edit backend/.env: set JWT_SECRET (32+ random chars), GEMINI_API_KEY,
# APP_URL=http://localhost:8080 and CORS_ORIGINS=http://localhost:8080
docker compose up -d --build
docker compose exec backend npm run seed   # optional demo data
```

Open http://localhost:8080. Compose sets `NODE_ENV=production`, `MONGO_URI=mongodb://mongo:27017/navigate` and `TRUST_PROXY=1` itself. Useful commands: `docker compose logs -f backend`, `docker compose down` (keeps data), `docker compose down -v` (deletes the database volume).

Files: [docker-compose.yml](docker-compose.yml), [backend/Dockerfile](backend/Dockerfile) (built from the repository root so it can include `ai_services`), [frontend/Dockerfile](frontend/Dockerfile), [frontend/nginx.conf](frontend/nginx.conf). These have not been run on the authoring machine; see the checklist below before relying on them.

### Production checklist

The full go-live list is in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md). The essentials:

- [ ] `JWT_SECRET` is a random string of at least 32 characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), and `REFRESH_TOKEN_SECRET` is set. Do not keep the placeholder from `.env.example`.
- [ ] `MONGO_URI` points to a managed, authenticated, backed-up cluster (for example MongoDB Atlas). The Compose MongoDB has no authentication.
- [ ] `APP_URL` and `CORS_ORIGINS` are your real https URL(s).
- [ ] `BILLING_MODE` is set deliberately. Payments are not integrated; `contact-sales` records upgrade requests.
- [ ] A **paid** Gemini API key is configured. The free tier is rate limited (about 5 requests per minute) and slow, so AI features will often fall back to templates.
- [ ] An email provider is integrated. Reset and invite emails are currently only written to the log.
- [ ] HTTPS terminates in front of the app (load balancer or reverse proxy), and `TRUST_PROXY` matches the number of proxy hops.
- [ ] MongoDB backups are scheduled and a restore has been tested.
- [ ] Running more than one backend instance needs a shared rate-limit store (limits and the AI recommendation cache are per process today) and shared storage for uploads.
- [ ] Privacy policy, terms and a data-processing agreement are in place before real student data is loaded.

## Project structure

```
.
├── backend/
│   ├── api/                 # Express routers: auth, workspace, notifications, courses, assessments,
│   │                        #   submissions, analytics, learningPath, questionBank, assessment (AI tools)
│   ├── config/              # env.js (boot checks), plans.js (plan catalog)
│   ├── middlewares/         # auth, rate limits, request context, error handler
│   ├── models/              # Mongoose models (Organization, User, Course, Assessment, Submission, ...)
│   ├── services/            # grading, attempts, analytics, learning path, plans, notify, audit, plagiarism, ...
│   ├── scripts/seed.js      # demo workspace
│   ├── tests/               # Jest suites: platform/ and learning/
│   ├── utils/               # errors, validation, logger, serialisation
│   ├── Dockerfile
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/             # axios client and one module per backend area
│   │   ├── auth/            # route guards and role helpers
│   │   ├── components/      # common, layout, auth, learner, staff
│   │   ├── contexts/        # auth, theme, notifications
│   │   ├── pages/           # public, auth, settings, staff, learner
│   │   └── theme.js
│   ├── Dockerfile
│   └── nginx.conf
├── ai_services/             # assessment/, models/ (Gemini), plagiarism/
├── docs/                    # ARCHITECTURE.md, FEATURES.md, LAUNCH_CHECKLIST.md, notes/
├── .github/workflows/ci.yml
└── docker-compose.yml
```

## Scripts

| Where | Command | What it does |
|---|---|---|
| `backend` | `npm start` | Start the API (`node server.js`) |
| `backend` | `npm run dev` | Start the API with nodemon |
| `backend` | `npm test` | Jest + Supertest suites (needs MongoDB) |
| `backend` | `npm run seed` | Rebuild the demo workspace |
| `frontend` | `npm start` | Dev server on port 3000 |
| `frontend` | `npm run build` | Production bundle in `frontend/build` |
| `frontend` | `npm test` | React test runner (the project currently has no frontend unit tests) |

Continuous integration (`.github/workflows/ci.yml`) runs the backend tests against MongoDB 7 and lints and builds the frontend on every push and pull request.

## Documentation

- [docs/FEATURES.md](docs/FEATURES.md): what every feature is, why it exists and how it works, in plain English
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, API contract, security and operations
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): go-live checklist
- [docs/notes](docs/notes): engineering notes per area
