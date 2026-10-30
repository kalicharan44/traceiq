export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export type ApiRequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body || `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { detail?: string | { message?: string; blockers?: string[] } };
      if (typeof parsed.detail === 'string') message = parsed.detail;
      else if (parsed.detail?.message) message = [parsed.detail.message, ...(parsed.detail.blockers ?? [])].join(' ');
    } catch {
      // Preserve plain-text error responses.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
