"use client";

import { useEffect, useRef, useState } from "react";

/** POST JSON (or FormData) and return parsed JSON, throwing the server's error message. */
export async function api<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(path, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? (body as FormData) : JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({ error: `Request failed (HTTP ${res.status})` }));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (HTTP ${res.status})`);
  return data as T;
}

/** useState that persists to localStorage (per browser). Safe when storage is unavailable. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`rf:${key}`);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage unavailable */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!loaded) return;
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(`rf:${key}`);
      else window.localStorage.setItem(`rf:${key}`, JSON.stringify(value));
    } catch {
      /* quota or privacy mode */
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}

export function timeAgo(unixSeconds: number): string {
  const s = Date.now() / 1000 - unixSeconds;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function downloadText(filename: string, text: string, type = "application/x-tex") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open LaTeX source as a new Overleaf project (https://www.overleaf.com/devs). */
export function openInOverleaf(latex: string, name = "resume.tex") {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://www.overleaf.com/docs";
  form.target = "_blank";
  const add = (k: string, v: string) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = v;
    form.appendChild(i);
  };
  add("encoded_snip", encodeURIComponent(latex));
  add("snip_name", name);
  add("engine", "pdflatex");
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function scoreTone(score: number): "good" | "ok" | "low" {
  return score >= 75 ? "good" : score >= 50 ? "ok" : "low";
}
