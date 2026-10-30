# TraceIQ Frontend

React, TypeScript, and Vite application for supply-chain operations. Business records and deterministic workflow decisions come from the FastAPI backend; the browser does not keep a second authoritative business dataset. The dashboard's clearly labeled Demo Preview uses local illustrative fixtures and never writes those values to the backend.

## Run locally

Prerequisites: Node.js 20+ and the FastAPI backend running on port 8000.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_BACKEND_URL` in `.env.local` to change the backend origin. The matching backend setup is in `../traceiq-backend/README.md`.

## Frontend structure

- `src/app/` — route selection and app-wide providers.
- `src/components/layout/` — sidebar, header, and application shell.
- `src/components/common/` — shared controls, tables, status, and loading/error states.
- `src/components/features/` — domain-specific visual components, including the four-panel dashboard chart grid, activity feed, risk list, and genealogy graph.
- `src/screens/` — route-level pages, including Documents and Validation centers.
- `src/services/api/` — typed FastAPI resource clients and shared HTTP handling.
- `src/hooks/` — reusable data-loading behavior.
- `src/types/` — API and domain contracts.
- `src/data/demo/` — illustrative frontend fixtures for dashboard preview only; never used as persisted business records.
- `src/legacy/` — retained prototype components/data during migration; not used as an operational data source.

## Checks

```powershell
npm run lint
npm run build
npx playwright install chromium # once per development machine
npm run test:e2e
```

The Playwright workflow starts the backend and frontend against an isolated SQLite file. Set `PYTHON_EXECUTABLE` if Python is not available as `python` in your shell. The theme button in the application header switches between dark teal and light themes and remembers the choice in this browser.
