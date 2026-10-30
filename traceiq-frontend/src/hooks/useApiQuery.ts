import { useCallback, useEffect, useState } from 'react';

export interface ApiQuery<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApiQuery<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: unknown[] = []): ApiQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const reload = useCallback(() => setRequestKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(controller.signal)
      .then((result) => setData(result))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load this data.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // Callers pass stable service functions and dependency values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, ...dependencies]);

  return { data, loading, error, reload };
}
