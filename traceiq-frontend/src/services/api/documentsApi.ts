import { API_BASE_URL, apiRequest } from './client';
import type { DocumentBatchResult, DocumentDetail, DocumentListPage, DocumentProcessingEvent, DocumentRecord, DocumentExtraction, DocumentLink, ValidationFinding, ValidationRun } from '../../types/api';

export interface UploadProgress { loaded: number; total: number; percent: number }

function requestError(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { detail?: string };
    return new Error(parsed.detail ?? `Upload failed with status ${status}.`);
  } catch {
    return new Error(body || `Upload failed with status ${status}.`);
  }
}

function uploadBatch(files: File[], category: string, onProgress?: (progress: UploadProgress) => void): Promise<DocumentBatchResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE_URL}/documents/batch`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) });
    };
    request.onerror = () => reject(new Error('Upload connection failed. Check that the API is running and retry.'));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return reject(requestError(request.responseText, request.status));
      try { resolve(JSON.parse(request.responseText) as DocumentBatchResult); }
      catch { reject(new Error('The API returned an unreadable upload response.')); }
    };
    const form = new FormData();
    files.forEach((file) => form.append('files', file, file.name));
    form.append('category', category);
    form.append('uploaded_by', 'TraceIQ Operator');
    request.send(form);
  });
}

export const documentsApi = {
  list(params: { q?: string; category?: string; status?: string; offset?: number; limit?: number } = {}, signal?: AbortSignal) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return apiRequest<DocumentListPage>(`/documents?${query}`, { signal });
  },
  uploadBatch,
  detail(id: string, signal?: AbortSignal) { return apiRequest<DocumentDetail>(`/documents/${encodeURIComponent(id)}`, { signal }); },
  extraction(id: string, signal?: AbortSignal) { return apiRequest<DocumentExtraction>(`/documents/${encodeURIComponent(id)}/extraction`, { signal }); },
  processingStatus(id: string, signal?: AbortSignal) {
    return apiRequest<{ document_id: string; status: string; processing_error: string | null; events: DocumentProcessingEvent[] }>(`/documents/${encodeURIComponent(id)}/processing-status`, { signal });
  },
  contentUrl(id: string, download = false) { return `${API_BASE_URL}/documents/${encodeURIComponent(id)}/content${download ? '?download=true' : ''}`; },
  process(id: string) { const form = new FormData(); form.append('actor', 'TraceIQ Operator'); return apiRequest<DocumentRecord>(`/documents/${encodeURIComponent(id)}/process`, { method: 'POST', body: form }); },
  review(id: string, payload: { decision: 'VERIFIED' | 'REJECTED'; reviewer: string; note: string; reviewed_fields: Record<string, unknown> }) {
    return apiRequest<{ document: DocumentRecord; review: DocumentDetail['latest_review'] }>(`/documents/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  reopenReview(id: string, payload: { reopened_by: string; reason: string }) {
    return apiRequest<DocumentRecord>(`/documents/${encodeURIComponent(id)}/reopen-review`, { method: 'POST', body: JSON.stringify(payload) });
  },
  link(id: string, payload: { entity_type: string; entity_id: string; relationship: string; created_by: string }) {
    return apiRequest<DocumentLink>(`/documents/${encodeURIComponent(id)}/links`, { method: 'POST', body: JSON.stringify(payload) });
  },
  archive(id: string) { return apiRequest<DocumentRecord>(`/documents/${encodeURIComponent(id)}/archive?actor=TraceIQ%20Operator`, { method: 'PATCH' }); },
  runChecks(id: string) { const form = new FormData(); form.append('run_by', 'TraceIQ Operator'); return apiRequest<ValidationRun>(`/documents/${encodeURIComponent(id)}/run-checks`, { method: 'POST', body: form }); },
  rules(signal?: AbortSignal) { return apiRequest<Array<Record<string, unknown>>>('/checks/rules', { signal }); },
  runs(params: { status?: string; entity_type?: string; entity_id?: string; offset?: number; limit?: number } = {}, signal?: AbortSignal) {
    const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
    return apiRequest<{ items: ValidationRun[]; total: number; offset: number; limit: number }>(`/checks/runs?${query}`, { signal });
  },
  findings(params: { status?: string; severity?: string; run_id?: string; offset?: number; limit?: number } = {}, signal?: AbortSignal) {
    const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
    return apiRequest<{ items: ValidationFinding[]; total: number; offset: number; limit: number }>(`/checks/findings?${query}`, { signal });
  },
  runForEntity(payload: { entity_type: 'DOCUMENT' | 'LOT' | 'SUPPLIER'; entity_id: string; document_id?: string; run_by?: string }) {
    return apiRequest<ValidationRun>('/checks/runs', { method: 'POST', body: JSON.stringify(payload) });
  },
  resolveFinding(id: string, payload: { resolved_by: string; resolution: string }) {
    return apiRequest<ValidationFinding>(`/checks/findings/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify(payload) });
  },
};
