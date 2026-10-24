"use client";

import { scoreTone } from "@/lib/client";

const toneColor = { good: "var(--good)", ok: "var(--ok)", low: "var(--low)" } as const;

export function ScoreRing({ score, size = "md", label }: { score: number; size?: "md" | "sm"; label?: string }) {
  const c = toneColor[scoreTone(score)];
  return (
    <div
      className={`ring ${size === "sm" ? "sm" : ""}`}
      style={{ background: `conic-gradient(${c} ${score * 3.6}deg, var(--panel-2) 0deg)` }}
      role="img"
      aria-label={`${label ?? "Score"}: ${score}%`}
    >
      <span style={{ color: c }}>{score}</span>
    </div>
  );
}

export function FitBar({ value }: { value: number }) {
  const c = toneColor[scoreTone(value)];
  return (
    <div className="bar" aria-hidden>
      <div style={{ width: `${value}%`, background: c }} />
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error}
    </div>
  );
}

/** Tiny, safe Markdown renderer for chat replies (bold, italics, code, links, lists, paragraphs). */
export function Markdown({ text }: { text: string }) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  const blocks: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (list) blocks.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  for (const line of text.split("\n")) {
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list.items.push(inline((ul ?? ol)![1]));
    } else {
      flush();
      if (h) blocks.push(`<p><strong>${inline(h[1])}</strong></p>`);
      else if (line.trim()) blocks.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return <div dangerouslySetInnerHTML={{ __html: blocks.join("") }} />;
}
