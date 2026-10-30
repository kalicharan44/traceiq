# TraceIQ demo evidence

These three PDFs are fictional, watermarked examples for demonstrating document upload and extraction. They contain text-based tables so the local deterministic extractor can identify candidate supplier, lot, production, shipment, quantity, unit, and reference fields without an LLM key.

For the fastest walkthrough, open Traceability, choose **Upload evidence**, and select one PDF. The page uploads and processes it, then shows candidate fields with source evidence for review. Candidates remain unverified until an operator confirms them. The dashboard now opens on live backend data; choose **Demo** there only to view illustrative dashboard fixtures.

To add Gemini-generated candidate suggestions, set `GEMINI_API_KEY` in the backend environment and restart the API. This is optional; deterministic fields in these examples extract without it.
