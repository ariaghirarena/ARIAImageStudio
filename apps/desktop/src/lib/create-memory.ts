import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "aria:create:v1:";
/** Only local UI data: no credentials or image bytes. Storage may be unavailable. */
export function readCreateMemory<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (Array.isArray(fallback) ? !Array.isArray(value) : fallback !== null && typeof value !== typeof fallback) return fallback;
    return value as T;
  } catch { return fallback; }
}
export function writeCreateMemory(key: string, value: unknown): boolean {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function useCreateMemory<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readCreateMemory(key, fallback));
  useEffect(() => { writeCreateMemory(key, value); }, [key, value]);
  return [value, setValue];
}

export function recoverMessages<T extends { status?: string; text: string }>(messages: T[]): T[] {
  return messages.filter((m) => m && typeof m.text === "string").map((m) => m.status === "running"
    ? { ...m, status: "interrupted", text: "اجرای قبلی با بسته‌شدن برنامه قطع شد؛ نتیجه احتمالی را در گالری یا تاریخچه بررسی کنید." }
    : m);
}
