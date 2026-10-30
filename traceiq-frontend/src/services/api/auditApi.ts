import type { AuditEvent } from '../../types/api';
import { apiRequest } from './client';

export const auditApi = {
  list: (entityId = '', signal?: AbortSignal) => apiRequest<AuditEvent[]>(`/audit-events${entityId ? `?entity_id=${encodeURIComponent(entityId)}` : ''}`, { signal }),
};
