"""Small environment-backed settings module."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def database_url() -> str:
    # SQLite keeps the demo easy to start; production and Docker use PostgreSQL.
    return os.getenv("DATABASE_URL", "sqlite:///./traceiq.db")


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def gemini_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip() or "gemini-flash-latest"


def truthy_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def document_limits() -> tuple[int, int, int]:
    return (
        max(1024, int(os.getenv("MAX_DOCUMENT_BYTES", str(15 * 1024 * 1024)))),
        max(1, int(os.getenv("MAX_DOCUMENT_PAGES", "150"))),
        max(1, int(os.getenv("MAX_UPLOAD_BATCH", "10"))),
    )


def private_storage_path() -> Path:
    configured = Path(os.getenv("PRIVATE_STORAGE_DIR", "./private_uploads")).expanduser()
    if not configured.is_absolute():
        configured = Path(__file__).resolve().parent.parent / configured
    return configured.resolve()


def configured_document_categories() -> set[str]:
    defaults = {
        "PURCHASE_ORDER", "SUPPLIER_INVOICE", "GOODS_RECEIPT_NOTE", "DELIVERY_CHALLAN", "PACKING_LIST", "SUPPLIER_QUOTATION",
        "CERTIFICATE_OF_ANALYSIS", "MATERIAL_INSPECTION_REPORT", "FINISHED_PRODUCT_INSPECTION_REPORT", "SUPPLIER_QUALITY_CERTIFICATE",
        "CALIBRATION_CERTIFICATE", "NON_CONFORMANCE_REPORT", "BILL_OF_MATERIALS", "PRODUCTION_ORDER_REPORT",
        "BATCH_MANUFACTURING_RECORD", "MATERIAL_CONSUMPTION_REPORT", "REWORK_REPORT", "SCRAP_REPORT", "INVENTORY_REPORT",
        "WAREHOUSE_TRANSFER_NOTE", "DISPATCH_NOTE", "BILL_OF_LADING", "SHIPMENT_RECORD", "PROOF_OF_DELIVERY", "RETURN_RECEIPT",
        "CUSTOMER_COMPLAINT", "RECALL_NOTICE", "CAPA_REPORT", "CUSTOMER_NOTIFICATION", "CUSTOMER_ACKNOWLEDGEMENT",
        "RECOVERY_RECORD", "DISPOSAL_CERTIFICATE", "OTHER", "AUTO",
    }
    custom = {item.strip().upper() for item in os.getenv("DOCUMENT_CATEGORIES", "").split(",") if item.strip()}
    return defaults | custom

