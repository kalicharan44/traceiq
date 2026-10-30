import type { DashboardExecutiveSummary, DashboardPeriod, DashboardSummary } from '../../types/api';
import { apiRequest } from './client';

export const dashboardApi = {
  summary: (signal?: AbortSignal) => apiRequest<DashboardSummary>('/dashboard', { signal }),
  executive: (period: DashboardPeriod, signal?: AbortSignal) => apiRequest<DashboardExecutiveSummary>(`/dashboard/summary?period=${period}`, { signal }),
};
