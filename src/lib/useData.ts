import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
export function useData<T>(path: string) {
  const request = useRef<AbortController | null>(null);
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setData(null);
    setError("");
    try {
      const result = await api<T>(path, { signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch (e) {
      if (controller.signal.aborted) return;
      setData(null);
      setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
    return () => request.current?.abort();
  }, [reload]);
  return { data, error, loading, reload };
}
