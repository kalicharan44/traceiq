# TraceIQ

TraceIQ is a supply-chain traceability and AI-assisted recall command center. It pairs a React/TypeScript frontend with a FastAPI backend. Deterministic backend rules own genealogy, quality outcomes, quantity reconciliation, anomaly findings, recall scope, and workflow gates. AI can explain authorized evidence, but only a named human approver can activate a recall.

## Repository layout

```text
traceiq-frontend/   React, TypeScript, Vite UI
traceiq-backend/    FastAPI, SQLAlchemy, Pydantic API and business workflows
IMPLEMENTATION_PLAN.md
```

## Start locally

Start the API in one terminal:

```powershell
cd traceiq-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Start the UI in a second terminal:

```powershell
cd traceiq-frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`; the API docs are at `http://localhost:8000/docs`. The local backend defaults to SQLite. Apply its versioned schema before starting the API with `alembic upgrade head`. Set `DATABASE_URL` to a PostgreSQL connection string to use PostgreSQL. Gemini credentials are optional and must stay in the backend environment as GEMINI_API_KEY; never put the key in frontend environment variables or source files. Docker Compose starts PostgreSQL, the API, and frontend together with `docker compose up --build`.

The Documents Center supports private uploads, deterministic extraction, source review, record links, and persisted checks. Scanned-page OCR requires Tesseract (included in the backend Docker image). Authentication/RBAC and durable background jobs are still future work; the demo is not production-secure.

See the component READMEs for backend configuration, seeded scenarios, and test commands.
