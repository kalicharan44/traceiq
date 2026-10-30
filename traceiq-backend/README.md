# TraceIQ Backend

FastAPI API for deterministic supply-chain traceability, quality checks, recall workflows, audit history, and evidence-grounded AI assistance.

## Local development

Python 3.11+ is recommended.

```powershell
cd traceiq-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
```

The application defaults to a local SQLite file so the demo can start without a database server. Schema changes are versioned in `migrations/`; apply them with `alembic upgrade head` before starting the API. Set `DATABASE_URL` in `.env` to a PostgreSQL URL for PostgreSQL-backed development. Ensure PostgreSQL is running and the database exists before applying migrations.

```powershell
uvicorn app.main:app --reload --port 8000
```

The API is available under `/api/v1`; interactive OpenAPI docs are at `/docs`. Startup does not seed demo records. Set `LOAD_DEMO_DATA=true` on an empty database to explicitly load the illustrative RAW-1042 sample genealogy and its separate validation examples. Set `LOAD_FULL_DATASET=true` instead to load the deterministic larger illustrative dataset (seed 20261022).

`GET /api/v1/dashboard/summary?period=today|7d|30d|90d` returns the typed executive snapshot, count-based time series, recent audit activity, risk counts, document processing states, recall readiness, and recent validation findings. Period selection changes the UTC chart buckets; current totals remain a current-state snapshot because historical KPI snapshots are not stored.

## Documents and validation

Document endpoints provide private local file storage, checksums and duplicate detection, batch upload, bounded PDF/DOCX/XLSX/CSV/image parsing, provenance snippets, human review records, entity links, and versioned validation runs/findings. The upload ceiling defaults to 15 MB per file, 150 PDF pages, and 10 files per batch; set `MAX_DOCUMENT_BYTES`, `MAX_DOCUMENT_PAGES`, and `MAX_UPLOAD_BATCH` to adjust limits. Originals are saved under `PRIVATE_STORAGE_DIR` and should be backed up and access-controlled with the application host.

The Python OCR package is installed by requirements. Scanned PDF/image OCR also needs the Tesseract executable on `PATH`. The Docker image installs Tesseract; on a local machine without it, extraction reports that OCR is unavailable and requires manual review. When `GEMINI_API_KEY` is configured, document extraction adds schema-validated Gemini candidate fields to the deterministic fields; source snippets must match extracted text and all candidates remain unverified until reviewed by an operator. FastAPI `BackgroundTasks` is suitable for this local workflow, but is not a durable job queue.

For Gemini-backed investigations, set `GEMINI_API_KEY` in the backend `.env` file. `GEMINI_MODEL` defaults to `gemini-flash-latest`. The key is read only by FastAPI and is never sent to the browser. Without a key, traceability, quality, and recall workflows remain available and the AI route returns an explicit unavailable response.

## Tests

```powershell
pytest -q
```

The tests use an isolated SQLite database; external Gemini requests require a configured backend key and are not made by the deterministic workflow tests.

## Deployment boundary

Docker Compose provisions PostgreSQL, private document storage, and the API/UI services. Migrations run before the API starts. Demo actor names are audit values, not authenticated identities; authentication, organization/facility scoping, and RBAC are not implemented. Do not expose this prototype to untrusted users or use it as a regulated production system without the remaining security and deployment work.
