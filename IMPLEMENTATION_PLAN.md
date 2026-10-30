# TraceIQ Implementation Plan

## Expanded master prompt: status and execution plan (2026-10-29)

This section reflects the latest master prompt and supersedes the smaller first-milestone scope below. The existing application is a working foundation, not yet the enterprise handover defined by the master prompt.

### Confirmed working foundation

- React/TypeScript includes an executive dashboard with three summary KPIs, four hoverable charts in a two-column layout (operational throughput, document processing, inventory positions, and recall work), plus concise activity/risk panels. It opens in an explicitly labeled client-side Demo Preview and can switch to live API data. Demo fixtures are illustrative and never written to business records. The sidebar collapses on desktop and opens as a drawer on mobile; users can switch between persistent dark teal and light themes from the header.
- FastAPI/SQLAlchemy has versioned Alembic migrations, Docker Compose wiring, private document intake and deterministic extraction, human review records, record links, validation runs/findings, plus the supply-chain and recall workflows.
- The dashboard uses `GET /api/v1/dashboard/summary?period=...` for a typed operational snapshot and time series. Inventory totals are grouped by unit; chart series share a count scale, and unavailable historical trends are not fabricated.
- Document handling supports checksum duplicate detection, bounded uploads, PDF/DOCX/XLSX/CSV/image parsers, text provenance, and an OCR attempt when the Tesseract executable is available. A review decision is required before document checks can run.
- Current verification (2026-10-30): npm run lint and npm run build pass; backend pytest passes 17 tests; all 3 Playwright tests pass on isolated E2E ports. Browser coverage checks theme persistence, the dashboard title/source controls and chart layout, and human-approved recall activation. Alembic upgrade/check was clean on the working migration database.

### Material gaps against the master prompt

| Area | Current status |
|---|---|
| Documents center, private uploads, checksums, processing history, human review, source linking | Implemented for the current local workflow; storage is local filesystem and the user interface supports upload, preview, correction, review, and linking |
| PDF/DOCX/XLSX/CSV extraction and provenance | Deterministic parsers are implemented. Scanned-page OCR is attempted, but Tesseract is absent on this host; Docker installs it. Extraction is not LLM-based. |
| Alembic migrations | Initial and document/validation migrations exist. Compose runs migrations before API start; the local `.env.example` quickstart uses Alembic. |
| Authentication, organizations, users, RBAC, facility scoping | Not implemented; current actor fields are operator-entered demo values |
| Registry-driven persisted validation runs/findings | Implemented for document requirements and existing lot/supplier quality checks; not every workflow transition is yet guarded by a configurable registry. |
| Full procurement/receipt/delivery/return/BOM/event domain | Partial; current model is narrower than the requested domain |
| Task-routed LLM gateway, usage budgets, model allowlist, request/usage ledger | Partial; Gemini investigations use one configurable model, with no task routing, budgets, allowlist, or usage ledger |
| Durable background workers, S3-compatible storage, import jobs | Not implemented; document processing uses FastAPI in-process background tasks and private local filesystem storage. |
| CSV/PDF evidence reports, admin model settings, complete requested screen catalog | Partial or not implemented; the dashboard and current operational route catalog are implemented, but there are no authenticated settings/admin screens. |
| Docker Compose, production migrations, deployment security hardening | Compose and versioned migrations are implemented; identity, secret management, tenant isolation, durable jobs, object storage, and production hardening remain. |

### Prerequisites and safe local defaults

- Local work can proceed with SQLite and private local file storage; PostgreSQL and object storage credentials are not needed for development.
- Live Gemini investigations require a backend-only `GEMINI_API_KEY`. Deterministic operations and tests must not depend on it.
- Scanned-page OCR requires the Tesseract executable in addition to the Python wrapper. The current host does not have that executable; the Docker image/setup instructions must install or explain it before OCR can be claimed verified.
- Production deployment requires a PostgreSQL URL, strong secret values, an identity provider or configured account bootstrap, and private object-storage credentials if using S3.

### Ordered implementation phases

1. **Foundation hardening:** Alembic migrations, Compose, and local migration instructions are implemented. Next: request IDs/structured logs and authentication/RBAC foundation. Keep local quickstart explicit and separate from production mode.
2. **Document pipeline:** private storage, bounded upload, checksums, batch API, state transitions, deterministic PDF/DOCX/XLSX/CSV/image extraction, OCR availability reporting, provenance, human review, record links, and the Documents Center are implemented. Next: durable processing and object storage; document workflow browser coverage; optional LLM extraction behind strict structured validation.
3. **Validation engine:** persisted versioned rules/runs/findings, linked evidence, document checks, existing lot/supplier quality-check adapters, and the Validation Center are implemented. Next: move remaining transition gates behind configurable rules and add broader finding/retest coverage.
4. **LLM gateway:** basic Gemini investigation calls with structured response validation and mocked tests are implemented. Add task model routing, allowlist, redacted usage/latency records, limits, retries, and provider fallback. LLM content remains untrusted and advisory.
5. **Domain and workflow coverage:** expand procurement, BOM, receipt, delivery, returns, inventory movements, genealogy events, role-scoped records, and the remaining requested screens.
6. **Handover hardening:** transaction/concurrency/idempotency tests, CSV/PDF reports, retention, responsive/accessibility checks, Docker clean-start validation, and explicit feature-completion matrix.

Implementation is being advanced phase by phase. No area above marked “not implemented” is represented as complete.

## Baseline findings at start of implementation

- The workspace has `traceiq-frontend/` and an empty `traceiq-backend/` directory.
- The frontend is a Vite + React + TypeScript app with a Tailwind-based control-center UI.
- `src/App.tsx` selects screens through `activeTab` from `NexusContext`; browser URLs do not represent the selected screen.
- `src/screens/` mostly re-exports large implementations from `src/pages/`. A number of pages use `NexusContext`; some use `SupplyChainContext`.
- `NexusContext` and `SupplyChainContext` each store business data in local storage and use incompatible domain models (`nexusChain.ts` and `supplyChain.ts`).
- `src/services/api/` has a small API client and traceability methods, but the traceability fallback imports business logic from the UI context and seed data.
- The frontend package currently includes server-side dependencies. The backend has no application, database setup, API, or tests yet.
- The current prototype contains useful workflow UI and synthetic fixtures. Preserve them while migrating to backend-owned state.

## Implementation status (2026-10-29)

- **Foundation and structure:** implemented a route-based React app with app shell, reusable UI, screen modules, API resource clients, shared TypeScript contracts, environment configuration, Alembic migrations, Docker Compose, and root/frontend/backend setup guides. Prototype UI and the retired Node API are retained under `traceiq-frontend/src/legacy/` and `traceiq-backend/legacy/node-prototype/`; neither is an active data source.
- **Supply-chain records:** implemented FastAPI/SQLAlchemy models and endpoints for suppliers, products, lots, production orders, inventory, shipments, and customers. Added deterministic demo records and an opt-in synthetic dataset generator.
- **Quality and traceability:** implemented supplier/lot checks, evidence references, corrective actions, lot genealogy, quantity findings, anomaly detection, and generic trace navigation from shipment/order/inventory/supplier/customer records.
- **Documents and validation:** added guarded file parsing and private storage, batch upload, file hashes, provenance snippets, recorded processing steps, human extraction review, entity links, document rules, and persisted validation runs/findings. The two React screens expose upload, preview, review, linked evidence, findings, and check-run history.
- **Recall workflows:** implemented impact simulation, explicit named approval, containment, action tracking, reconciliation, closure blockers, audit events, and report retrieval.
- **AI and reports:** implemented backend-only Gemini integration with validated response shape and explicit unavailable behavior when credentials are absent. AI output is advisory; provider usage budgets and a request ledger are not yet implemented.
- **Validation:** npm run lint, npm run build, all 17 backend pytest tests, and all 3 Playwright tests pass as of 2026-10-30. Browser checks cover theme persistence, the dashboard, and human-approved recall activation. Document workflow browser coverage remains to be added. Alembic upgrade/check completed cleanly.
- **Prototype constraints:** SQLite is the local quickstart; PostgreSQL is supported through `DATABASE_URL`, and Docker Compose runs Alembic migrations. Actor names are workflow evidence, not authenticated identities. Document parsing is deterministic; scanned OCR needs Tesseract. Processing uses in-process tasks and local disk, not a durable queue or object storage. Notifications are recorded as recall actions; no external messages are sent.

## Target architecture

### Frontend

Keep `traceiq-frontend/` and organize `src/` into `app/`, `components/layout/`, `components/common/`, `components/features/`, `screens/`, `hooks/`, `services/api/`, `types/`, `data/demo/`, `utils/`, and `styles/`. Screens are route-level compositions. Feature components render domain UI. Hooks coordinate loading and user actions. API services own HTTP communication. FastAPI Pydantic contracts and TypeScript API types must agree. Retire duplicate legacy pages, contexts, and model types only after each workflow has moved.

Routes: dashboard, suppliers, traceability, quality, inventory, recalls, AI investigation, anomalies, audit, reports, document intelligence, and validation. Keep the existing design where useful; make it responsive and provide loading, empty, validation, and error states.

### Backend

Keep `traceiq-backend/` and use the compact layout:

```text
app/main.py
app/config.py
app/database.py
app/controllers.py
app/services.py
app/models.py
app/ai.py
tests/test_app.py
.env.example
Dockerfile
requirements.txt
README.md
```

Use FastAPI, Pydantic, SQLAlchemy, and PostgreSQL. Controllers are thin HTTP handlers; services own deterministic business rules and workflows; database access uses transactions; models contain clearly separated ORM entities and API schemas; Gemini calls run only from the backend. Add modules only when the compact layout becomes difficult to maintain.

## API contract outline

Version APIs under `/api/v1`. Support dashboard metrics; supplier/product records; lots, production orders, inventory, shipments, and customers; quality checks and corrective actions; genealogy and quantity validation; recall impact, approval, activation, action tracking, reconciliation, and closure; anomalies; audit events; reports; and AI investigations. Paginate/filter large collections, return consistent errors, document endpoints through FastAPI OpenAPI, and align TypeScript types to Pydantic schemas.

## Product rules

- Backend records and deterministic rules define traceability, quality outcomes, quantities, anomaly findings, and recall scope.
- Trace both upstream sources and downstream products, stock, shipments, and customers. Return missing links and uncertainty explicitly.
- Quality checks are versioned and return `PASS`, `FAIL`, `PENDING`, or `INCOMPLETE`. Failed or incomplete checks open corrective actions; transitions require all configured gates to pass. Preserve each check run and its evidence.
- Quantity reconciliation accounts for units, production, consumption, inventory, quarantine, shipments, delivery, returns, destruction, and documented process losses.
- Recall activation requires explicit human approval. Containment, holds, and reconciliation must be transactional. Closure requires configured actions and quantities to reconcile; unresolved exceptions block closure.
- Audit history records important mutations and transitions and is append-only.
- AI may explain authorized evidence, identify gaps, and draft reports. It cannot determine scope, bypass rules, mutate recall state, or approve execution. Clearly report when Gemini is unavailable.
- Do not add graph database, machine-learning pipeline, Redis, or background workers to the first milestone. Notifications are recorded as events; do not send real email.

## Implementation phases

1. **Foundation:** finish inventory of current code; retain useful UI; create this plan; establish FastAPI configuration, PostgreSQL session handling, app startup, frontend routes, shared app shell, API client, environment examples, and local setup documentation.
2. **Supply-chain records:** define one canonical domain/API model; add suppliers, lots, products, production orders, inventory, shipments, customers, database initialization/migrations as needed, and deterministic dataset loading; connect the corresponding frontend screens.
3. **Quality and traceability:** implement versioned checks, check runs, corrective actions, upstream/downstream genealogy, explicit missing links, quantity validation, and deterministic anomaly findings; expose results in the UI.
4. **Recall command center:** implement simulation, scope review, explicit approval, transactional quarantine and shipment holds, notification/action tracking, recovery, reconciliation, closure blockers, and audit-linked report.
5. **AI and reporting:** keep the implemented server-side Gemini adapter with structured validated responses, evidence references, uncertainties, and mocked tests; add usage controls and report drafts.
6. **Hardening:** document configuration and startup, remove obsolete frontend contexts/pages/types and unused server dependencies, handle responsive/error states, and check dataset performance and audit/transaction coverage.

## Dataset and validation

Use deterministic seed `20261022` and target approximately 500 suppliers, 10,000 raw lots, 5,000 production orders, 8,000 finished lots, and 20,000 deliveries. Keep ground-truth labels separate from operational records. Verify detection of: a missing input lot, shipped/delivered quantity exceeding production, a missed downstream recall customer, and recalled inventory remaining saleable.

Add pytest coverage for API behavior, deterministic rule outcomes, reconciliation, transaction behavior, audit history, and the four planted scenarios. Add one Playwright end-to-end path for investigating and simulating a recall, with explicit human approval before activation. Mock Gemini so tests require no credentials or external requests. Run relevant checks after implementation and report exact command results.
### Business-guide dataset compliance audit (2026-10-30)

The supplied synthetic-data guide is **partially followed**, not complete. The current generator is useful for exercising the implemented workflows, but it is not yet the guide's full validated/exportable benchmark dataset.

| Guide requirement | Current implementation | Status / next step |
|---|---|---|
| Document the entity data dictionary and relationships | Models and API contracts describe current entities; no dedicated generated-dataset dictionary | Missing; publish field definitions, units, nullable rules, and relationship cardinalities before expanding the generator |
| Generate records parent-first across suppliers, materials, BOM, production, finished goods, shipments, and deliveries | Seed generator creates suppliers, raw lots, orders, finished lots, and shipments with links; there is no BOM or Delivery entity | Partial; add material/BOM consumption and delivery/return records before claiming full chain coverage |
| Required scale and fixed seed | Seed 20261022 generates 500 suppliers, 10,000 raw lots, 5,000 production orders, 8,000 finished lots, and 20,000 shipment records | Partial; sizes match except the final records are shipments, not deliveries; add a configurable scale parameter |
| Required deterministic IDs | Existing IDs use prefixes such as SUP-0001, RAW-0001, PO-00001, FG-00001, and SHP-00001 | Partial; align IDs to the guide's year-prefixed formats and document uniqueness rules |
| Derive dependent quantities and values from parent records | Existing links and several quantity checks are generated/validated; no complete BOM, delivery, returns, or loss reconciliation model | Partial; derive all child quantities from source consumption and record transformations explicitly |
| Separate ground truth from operational data | No dedicated ground-truth labels/export | Missing; keep planted scenario labels in test/benchmark metadata, outside operational tables and API responses |
| Four planted edge cases | Existing seed includes missing input, over-allocation, and missing shipment recipient examples; no verified missed-recall-customer and saleable-recalled-stock pair | Partial; implement and assert all four exact scenarios |
| Integrity checks, exports, manifest/report, repeat-run checksum comparison | Existing pytest checks counts and selected workflows; no dataset export/manifest or repeat-generation checksum report | Missing; add validation summary, versioned manifest, deterministic export, and two-run checksum verification |

Recommended dataset completion order: data dictionary and canonical entity links; BOM/material consumption and delivery/return entities; scale-aware deterministic generation with prescribed IDs; isolated ground truth and all four planted cases; integrity/reconciliation checks; then exports, manifest, and reproducibility checksum tests.

## Decisions to validate during implementation

- PostgreSQL connection configuration and local provisioning method.
- How to initialize schema and apply future schema changes without overbuilding migrations.
- Whether the large synthetic dataset is loaded into PostgreSQL or generated at first run; the browser must never receive the entire dataset.
- How a demo approver is represented until role-based access is implemented.
- Which React routing and graph packages are already available or should be added; avoid adding dependencies when the existing stack can meet the need.
- Whether reports export as CSV/PDF in the first milestone or begin as a browser view with audit-linked records.
