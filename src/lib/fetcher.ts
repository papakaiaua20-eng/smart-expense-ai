"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiClientError(res.status, body?.error ?? fallbackMessage(res.status), body);
  return body as T;
}

/** Small data hook: { data, error, loading, reload } */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api<T>(url);
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

function fallbackMessage(status: number) {
  if (status === 413) return "ไฟล์ใหญ่เกินไป กรุณาใช้รูปที่เล็กลง (413)";
  if (status === 504) return "เซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณาลองใหม่ (504)";
  return `เกิดข้อผิดพลาด (${status})`;
}
