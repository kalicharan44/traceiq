"""FastAPI app entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import cors_origins, truthy_env
from app.controllers import router
from app.document_controller import router as document_router
from app.database import SessionLocal, initialize_schema
from app.services import seed_demo_data, seed_synthetic_dataset


def create_app(initialize_database: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if initialize_database and truthy_env("AUTO_CREATE_SCHEMA", default=True):
            initialize_schema()
        if initialize_database and (truthy_env("LOAD_FULL_DATASET") or truthy_env("LOAD_DEMO_DATA")):
            with SessionLocal() as db:
                try:
                    if truthy_env("LOAD_FULL_DATASET"):
                        seed_synthetic_dataset(db)
                    else:
                        seed_demo_data(db)
                except ValueError:
                    # Existing records mean this database has already been initialized.
                    db.rollback()
        yield

    app = FastAPI(
        title="TraceIQ Supply Chain API",
        version="1.0.0",
        description="Deterministic supply-chain traceability, quality, and recall workflows.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(document_router)

    @app.exception_handler(ValueError)
    async def value_error_handler(_: Request, exc: ValueError):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

