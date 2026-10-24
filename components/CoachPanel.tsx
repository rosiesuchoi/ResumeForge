"use client";

import { useEffect, useRef, useState } from "react";
import { api, usePersistentState } from "@/lib/client";
import { resumeToText } from "@/lib/latex";
import type { CoachReport, Resume } from "@/lib/types";
import type { CoachTarget, JobState } from "./Workspace";
import { ErrorBox, Markdown, Spinner } from "./ui";

type Props = { resume: Resume | null; job: JobState | null; missing: string[]; target: CoachTarget | null; goResume: () => void };
type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which bullet is my weakest and how would you rewrite it?",
  "What 1–2 week project would make me a stronger candidate for this role?",
  "Give me a 4-week LeetCode plan for this company.",
  "What behavioral stories should I prepare from my resume?",
];

const diffColor = { Easy: "good", Medium: "ok", Hard: "low" } as const;

export default function CoachPanel({ resume, job, missing, target, goResume }: Props) {
  const [company, setCompany] = useState(target?.company ?? job?.analysis.company ?? "");
  const [role, setRole] = useState(target?.role ?? job?.analysis.title ?? "");
  const [report, setReport] = usePersistentState<(CoachReport & { for: string }) | null>("coach", null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastNonce = useRef<number | null>(null);

  async function generate(c = company, r = role) {
    if (!resume) return;
    setBusy(true);
    setError(null);
    try {
      const rep = await api<CoachReport>("/api/coach", {
        resume,
        job: job && (!c || c === job.analysis.company) ? job.analysis : null,
        company: c,
        role: r,
        missingKeywords: missing,
      });
      setReport({ ...rep, for: `${c}|${r}` });
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Coming from "Prep" on the job board or "Get coaching" on the tailor tab.
  useEffect(() => {
    if (target && target.nonce !== lastNonce.current) {
      lastNonce.current = target.nonce;
      setCompany(target.company);
      setRole(target.role);
      if (resume && report?.for !== `${target.company}|${target.role}`) generate(target.company, target.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming || !resume) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const context = [
      `Target: ${role || "Software Engineer"}${company ? ` at ${company}` : ""}`,
      job ? `Job summary: ${job.analysis.summary}\nRequired: ${job.analysis.requiredSkills.join(", ")}` : "",
      missing.length ? `Missing ATS keywords: ${missing.join(", ")}` : "",
      `Resume:\n${resumeToText(resume)}`,
      report ? `Your earlier report said: ${report.overall}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages([...next, { role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!resume) {
    return (
      <div className="card empty">
        <h3>Upload your resume to get coaching</h3>
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn primary" onClick={goResume}>Upload resume</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>AI resume &amp; interview coach</h2>
            <p className="sub">Personal feedback on your resume, plus the LeetCode problems candidates report for your target company.</p>
          </div>
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (e.g. Google, Amazon, Stripe)" style={{ flex: 1, minWidth: 180 }} aria-label="Company" />
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Software Engineer Intern)" style={{ flex: 1, minWidth: 180 }} aria-label="Role" />
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? <Spinner /> : null} {report ? "Regenerate" : "Get my report"}
          </button>
        </form>
        <div style={{ marginTop: 10 }}>
          <ErrorBox error={error} />
        </div>
        {busy && <p className="sub" style={{ marginTop: 10 }}>Reviewing your resume and researching the interview loop… (about 30 seconds)</p>}
      </div>

      {report && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Resume feedback</h3>
            <p style={{ marginBottom: 12 }}>{report.overall}</p>
            {report.strengths.length > 0 && (
              <>
                <h4 style={{ marginBottom: 6 }}>What&apos;s working</h4>
                <ul className="clean" style={{ marginBottom: 14 }}>
                  {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            <h4 style={{ marginBottom: 8 }}>Improve next</h4>
            <div className="stack">
              {report.improvements.map((m, i) => (
                <div key={i} className={`improve ${m.priority}`}>
                  <div className="row">
                    <b>{m.title}</b>
                    <span className={`badge ${m.priority === "high" ? "low" : m.priority === "medium" ? "ok" : "good"}`}>{m.priority}</span>
                  </div>
                  <p style={{ fontSize: 14, marginTop: 2 }}>{m.detail}</p>
                  {m.example && <div className="ex">{m.example}</div>}
                </div>
              ))}
            </div>
            {report.atsTips.length > 0 && (
              <>
                <h4 style={{ margin: "16px 0 6px" }}>ATS tips</h4>
                <ul className="clean">{report.atsTips.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Interview prep{report.interview.company ? `: ${report.interview.company}` : ""}</h3>
            <p className="sub" style={{ marginBottom: 12 }}>{report.interview.process}</p>
            <div className="table-wrap">
              <table className="jobs-table lc-table">
                <thead>
                  <tr>
                    <th>LeetCode problem</th>
                    <th>Level</th>
                    <th>Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {report.interview.leetcode.map((p) => (
                    <tr key={p.slug}>
                      <td>
                        <a href={`https://leetcode.com/problems/${encodeURIComponent(p.slug)}/`} target="_blank" rel="noreferrer">{p.title}</a>
                        {p.source === "company-reported" && <span className="badge accent" style={{ marginLeft: 6 }}>Reported</span>}
                        <div className="loc">{p.why}</div>
                      </td>
                      <td><span className={`badge ${diffColor[p.difficulty]}`}>{p.difficulty}</span></td>
                      <td className="loc">{p.topic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ marginTop: 8 }}>
              “Reported” means candidates commonly report it for this company. Lists change often, so treat them as practice targets, not a guarantee.
            </p>
            {report.interview.otherTips.length > 0 && (
              <>
                <h4 style={{ margin: "14px 0 6px" }}>Other tips</h4>
                <ul className="clean">{report.interview.otherTips.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Ask the coach</h3>
        <div className="chat" ref={chatRef} aria-live="polite">
          {messages.length === 0 && <p className="sub">Ask anything about your resume, this role, or interview prep.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" ? (m.content ? <Markdown text={m.content} /> : <Spinner />) : m.content}
            </div>
          ))}
        </div>
        {messages.length === 0 && (
          <div className="suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            aria-label="Message"
          />
          {streaming ? (
            <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button type="submit" className="btn primary" disabled={!input.trim()}>Send</button>
          )}
        </form>
      </div>
    </div>
  );
}
