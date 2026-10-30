import type { Anomaly } from '../../types/api';
import { apiRequest } from './client';

export const anomaliesApi = {
  list: (signal?: AbortSignal) => apiRequest<Anomaly[]>('/anomalies', { signal }),
};
