# ModelExplorerTS

React/TypeScript frontend for exploring model training runs, charting metric history, and managing queued training jobs.

## Highlights

- Vite + React 19 + TypeScript
- Sortable model and job tables
- Live model/job updates over WebSocket or SignalR
- Chart.js metric history with zoom support
- Job submission form with JSON validation

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

The default `.env.example` targets the FastAPI backend on `http://localhost:8000/api/`.
For the .NET SignalR backend, set:

```bash
VITE_API_URL=http://localhost:5071/api/
VITE_MESSAGING_TRANSPORT=signalr
```

## Checks

```bash
npm run lint
npm run build
```
