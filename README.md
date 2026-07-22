# Model Explorer Frontend

React and TypeScript browser interface for comparing model-training runs and managing training jobs. It combines REST snapshots with live updates from either the [FastAPI/WebSocket backend](https://github.com/justinlee76/model-explorer-api-fastapi) or the [ASP.NET Core/SignalR backend](https://github.com/justinlee76/model-explorer-api-aspnet).

## Features

### Model exploration

- Browse runs by tag and sort the model table by any displayed column.
- Compare any combination of models and metrics on an epoch-history chart.
- Zoom with the mouse wheel or pinch gesture and pan along the epoch axis.
- Receive new models, status changes, and metric points while training is in progress.
- Delete selected trained models while protecting active runs.

### Training jobs

- Submit jobs using the tasks stored in the shared database and exposed by the API.
- Edit positional `args` as a JSON array and keyword `kwargs` as a JSON object, with validation before submission.
- Follow job status and logs in real time.
- Stop running jobs and delete submitted, completed, failed, or stopped jobs.

## How it fits together

```mermaid
flowchart LR
    F[Model Explorer frontend] <-->|REST + WebSocket or SignalR| A[Model Explorer API]
    A <--> D[(MongoDB)]
    W[Training service] <--> D
```

The API supplies model and job data to this frontend. The optional [training service](https://github.com/justinlee76/model-explorer-training-service) consumes submitted jobs and writes their logs, metrics, and results to the same MongoDB database. You can browse existing data without the worker, but submitted jobs remain `Submitted` until a worker processes them.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- One compatible Model Explorer API:
  - [FastAPI](https://github.com/justinlee76/model-explorer-api-fastapi#quick-start) for native WebSockets
  - [ASP.NET Core](https://github.com/justinlee76/model-explorer-api-aspnet#quick-start) for SignalR

Executing jobs also requires the [training service](https://github.com/justinlee76/model-explorer-training-service#quick-start) and at least one registered training task. The backend documentation covers its MongoDB and CORS requirements.

## Quick start

Start the selected API first. Then run:

```bash
git clone https://github.com/justinlee76/model-explorer-frontend.git
cd model-explorer-frontend
npm ci
```

The checked-in development configuration targets the ASP.NET Core API at `http://localhost:5071/api/` using SignalR. To use that default, start the frontend:

```bash
npm run dev
```

To use the FastAPI backend instead, create a mode-specific local override before starting Vite:

```bash
cp .env.fastapi.example .env.development.local
npm run dev
```

Open the address printed by Vite, normally <http://localhost:5173>. Use `.env.development.local` rather than `.env` for overrides because the checked-in `.env.development` takes precedence over generic environment files.

If Vite selects another port, add that exact origin to the backend's CORS allowlist and restart the backend.

## Backend configuration

Choose the environment values that match the running API.

The repository's checked-in mode defaults are:

| Mode | Used by | API URL | Live-update transport |
| --- | --- | --- | --- |
| Development | `npm run dev` | `http://localhost:5071/api/` | SignalR |
| Production | `npm run build` | Same-origin `/api/` | SignalR |

### FastAPI and WebSockets (`.env.fastapi.example`)

```dotenv
VITE_API_URL=http://localhost:8000/api/
VITE_MESSAGING_TRANSPORT=websocket
```

### ASP.NET Core and SignalR (`.env.aspnet.example`)

```dotenv
VITE_API_URL=http://localhost:5071/api/
VITE_MESSAGING_TRANSPORT=signalr
```

Copy the matching template to `.env.development.local` for development overrides or `.env.production.local` for production overrides. Replace the template's localhost URL when the API runs elsewhere.

| Variable | Code fallback | Description |
| --- | --- | --- |
| `VITE_API_URL` | Same-origin `/api/` | Base URL used for REST requests and live-update connections. When set, it must be an absolute URL and retain the trailing `/`; omit it for the same-origin fallback. |
| `VITE_MESSAGING_TRANSPORT` | `websocket` | Live-update transport. Supported values are `websocket` and `signalr`. |

Existing process environment variables have highest priority. For environment files, the relevant priority from highest to lowest is `.env.[mode].local`, `.env.[mode]`, `.env.local`, then `.env`. The `.env`, `.env.local`, and `.env.*.local` files are ignored by Git; `.env.development` and `.env.production` are checked in.

Vite reads these values when the development server starts and embeds them in production builds. Restart `npm run dev` after changing development values and rebuild after changing production values; `npm run preview` cannot change an existing bundle. Every `VITE_*` value is exposed to browser code, so never put secrets in these variables.

## Using the interface

### Models

1. Select a tag to load its model runs.
2. Tick one or more models and metric names to add their histories to the chart. On initial load, the newest run and all available metrics are selected.
3. Click a table heading to sort by that column. Runs still training are visually emphasized and receive live metric points.
4. Use the chart's wheel or pinch zoom and drag horizontally to inspect an epoch range.
5. Select completed runs and click **Delete** to remove them after confirmation. Runs currently training are left intact.

### Training

1. Click **Add job** and choose a registered task.
2. Enter positional arguments as a JSON array and keyword arguments as a JSON object.
3. Submit the form. The new job and subsequent status changes appear live.
4. Select a job row to load its existing messages and follow new log output.
5. Use the action icon to stop a running job or delete a submitted, completed, failed, or stopped job.

## npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot reload. |
| `npm run build` | Type-check the project and create a production build in `dist/`. |
| `npm run lint` | Run ESLint across the project. |
| `npm run preview` | Serve the production build locally for verification. |

There is currently no automated test suite. Before submitting changes, run:

```bash
npm run lint
npm run build
```

## Production deployment

The checked-in `.env.production` creates a SignalR build that uses the same-origin `/api/` fallback. For a FastAPI deployment, or for either API on another origin, create the appropriate ignored production override and edit its URL before building:

```bash
# FastAPI
cp .env.fastapi.example .env.production.local

# Or ASP.NET Core on another origin
cp .env.aspnet.example .env.production.local
```

Create the static bundle after selecting the production configuration:

```bash
npm ci
npm run build
```

CI may set `VITE_API_URL` and `VITE_MESSAGING_TRANSPORT` in the process environment instead; those values override the environment files.

Deploy the generated `dist/` directory with a static web server at the origin root. `npm run preview` is intended for local verification, not as a production server.

For a separate API origin, set its absolute URL before building and allow the frontend's exact origin in the API's CORS configuration. For a same-origin deployment, omit `VITE_API_URL` and proxy `/api/` to the backend. The proxy must also support the selected live-update transport:

- WebSocket: upgrade connections for `/api/ws/models` and `/api/ws/jobs`.
- SignalR: route `/ModelHub` and `/JobHub`, including their HTTP negotiation and WebSocket traffic.

> **Security:** This interface can submit and stop jobs and delete data. The companion APIs do not provide authentication, so protect shared deployments with HTTPS, authentication, and authorization.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Model and job data do not load | Confirm that the API is running, `VITE_API_URL` is absolute and ends in `/` (or is omitted for same-origin use), and the browser console has no failed requests. |
| The browser reports a CORS error | Add the exact frontend origin, including its port, to the API's CORS allowlist. |
| Initial data loads but live updates do not | Match `websocket` with FastAPI or `signalr` with ASP.NET Core, then check that any reverse proxy permits the corresponding live connection. |
| A job remains `Submitted` | Start the training service and confirm that the task is registered in the same MongoDB database used by the API and worker. |
| Environment changes have no effect | Use the matching `.env.[mode].local` file, check for a higher-priority process variable, then restart Vite or rebuild. Previewing an existing bundle does not re-read these values. |

Most request and connection errors are logged in the browser developer console.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Top-level Models and Training tab navigation. |
| `src/ModelsTab/` | Model filtering, comparison table, deletion, and metric chart. |
| `src/TrainingTab/` | Job submission, status/actions table, and live logs. |
| `src/messaging/` | Transport-neutral messaging contract plus WebSocket and SignalR implementations. |
| `src/dataUtils.ts` | API URL handling, JSON requests, and transport selection. |
| `src/types.ts` | Shared model, metric, task, job, and log types. |
| `.env.development` | Checked-in ASP.NET Core/SignalR defaults for `npm run dev`. |
| `.env.production` | Checked-in same-origin/SignalR defaults for production builds. |
| `.env.fastapi.example` | Local FastAPI/WebSocket configuration template. |
| `.env.aspnet.example` | Local ASP.NET Core/SignalR configuration template. |

## Companion projects

| Repository | Role |
| --- | --- |
| [`model-explorer-api-fastapi`](https://github.com/justinlee76/model-explorer-api-fastapi) | Python REST API and native WebSocket updates. |
| [`model-explorer-api-aspnet`](https://github.com/justinlee76/model-explorer-api-aspnet) | ASP.NET Core REST API and SignalR updates. |
| [`model-explorer-training-service`](https://github.com/justinlee76/model-explorer-training-service) | Python/PyTorch worker that executes queued jobs. |
