"use client";

import { useMemo, useState } from "react";
import { downloadText, openInOverleaf } from "@/lib/client";
import { atsScore, weightsFromAnalysis } from "@/lib/keywords";
import { findPlaceholders, resumeToLatex, resumeToText } from "@/lib/latex";
import type { Resume } from "@/lib/types";
import ResumeEditor from "./ResumeEditor";
import ResumePreview from "./ResumePreview";
import type { JobState, TailorState } from "./Workspace";
import { ErrorBox, ScoreRing, Spinner } from "./ui";

type Props = {
  resume: Resume | null;
  job: JobState | null;
  tailored: TailorState | null;
  edited: Resume | null;
  setEdited: (r: Resume) => void;
  tailoring: boolean;
  error: string | null;
  onRetailor: () => void;
  go: (tab: "resume" | "job") => void;
  onCoach: () => void;
};

export default function TailorPanel({ resume, job, tailored, edited, setEdited, tailoring, error, onRetailor, go, onCoach }: Props) {
  const [view, setView] = useState<"edit" | "changes" | "latex">("edit");
  const [copied, setCopied] = useState(false);
  const current = edited ?? tailored?.resume ?? null;

  const latex = useMemo(() => (current ? resumeToLatex(current) : ""), [current]);
  const placeholders = useMemo(() => (current ? findPlaceholders(current) : []), [current]);
  const liveAts = useMemo(
    () => (current && job ? atsScore(resumeToText(current), weightsFromAnalysis(job.analysis)) : null),
    [current, job],
  );

  if (!resume || !job) {
    return (
      <div className="card empty">
        <h3>{!resume ? "Upload your resume first" : "Pick a target job first"}</h3>
        <p>Tailoring needs both your resume and the job you&apos;re applying to.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn primary" onClick={() => go(!resume ? "resume" : "job")}>
            {!resume ? "Upload resume" : "Add a job link"}
          </button>
        </div>
      </div>
    );
  }

  if (tailoring || (!tailored && !error)) {
    return (
      <div className="card empty">
        {tailoring ? (
          <>
            <h3 className="row" style={{ justifyContent: "center" }}>
              <Spinner /> Tailoring for {job.analysis.title}
              {job.analysis.company ? ` at ${job.analysis.company}` : ""}…
            </h3>
            <p>Rewriting every bullet in Google&apos;s XYZ format and matching the job&apos;s keywords. This takes about a minute.</p>
          </>
        ) : (
          <>
            <h3>Ready to tailor</h3>
            <p>We&apos;ll rewrite your resume for {job.analysis.title || "this job"}.</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="btn primary" onClick={onRetailor}>Tailor my resume</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!tailored || !current) {
    return (
      <div className="card stack">
        <ErrorBox error={error} />
        <div>
          <button className="btn primary" onClick={onRetailor}>Try again</button>
        </div>
      </div>
    );
  }

  const before = tailored.ats.before;
  const after = liveAts ?? tailored.ats.after;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ gap: 24, alignItems: "center" }}>
          <div className="score">
            <ScoreRing score={before.score} label="Original ATS match" />
            <div>
              <div className="label">ORIGINAL</div>
              <div className="value">{before.matched.length}/{before.total} keywords</div>
            </div>
          </div>
          <span style={{ fontSize: 22, color: "var(--muted)" }} aria-hidden>→</span>
          <div className="score">
            <ScoreRing score={after.score} label="Tailored ATS match" />
            <div>
              <div className="label">TAILORED (LIVE)</div>
              <div className="value">{after.matched.length}/{after.total} keywords</div>
            </div>
          </div>
          <div className="spacer" />
          <div className="row">
            <button className="btn primary" onClick={() => openInOverleaf(latex, "resume.tex")}>Open in Overleaf ↗</button>
            <button className="btn" onClick={() => downloadText(`${(current.name || "resume").replace(/\s+/g, "_")}_resume.tex`, latex)}>Download .tex</button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(latex);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setView("latex");
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy LaTeX"}
            </button>
          </div>
        </div>

        {placeholders.length > 0 && (
          <div className="warn" style={{ marginTop: 14 }}>
            <b>{placeholders.length} placeholder{placeholders.length > 1 ? "s" : ""} to fill in</b> (highlighted in the preview, e.g.{" "}
            {placeholders.slice(0, 3).join(", ")}). The AI never invents metrics, so replace these with your real numbers, or reword the bullet,
            before you submit.
          </div>
        )}
        {tailored.notes && <p className="note" style={{ marginTop: 12 }}>{tailored.notes}</p>}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <div>
            <h4 style={{ marginBottom: 6 }}>Keywords matched</h4>
            <div className="chips">
              {after.matched.map((k) => (
                <span key={k} className="chip good">✓ {k}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ marginBottom: 6 }}>Still missing</h4>
            <div className="chips">
              {after.missing.length ? after.missing.map((k) => <span key={k} className="chip low">{k}</span>) : <span className="sub">Nothing. Nice.</span>}
            </div>
          </div>
        </div>

        {tailored.missingKeywords.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>How to earn the missing keywords honestly</summary>
            <ul className="clean" style={{ marginTop: 8 }}>
              {tailored.missingKeywords.map((m) => (
                <li key={m.keyword}>
                  <b>{m.keyword}</b>: {m.advice}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="grid-resume">
        <div className="card">
          <div className="card-head">
            <div className="seg" role="tablist">
              <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Edit</button>
              <button className={view === "changes" ? "on" : ""} onClick={() => setView("changes")}>Changes ({tailored.changes.length})</button>
              <button className={view === "latex" ? "on" : ""} onClick={() => setView("latex")}>LaTeX</button>
            </div>
            <div className="row">
              <button className="btn sm ghost" onClick={() => setEdited(tailored.resume)} title="Discard your manual edits">Reset edits</button>
              <button className="btn sm" onClick={onRetailor}>Re-tailor</button>
              <button className="btn sm" onClick={onCoach}>Get coaching →</button>
            </div>
          </div>

          {view === "edit" && (
            <>
              <p className="sub" style={{ marginBottom: 12 }}>
                XYZ = <i>Accomplished [X] as measured by [Y], by doing [Z]</i>. Bullets with orange borders still have a placeholder.
              </p>
              <ResumeEditor resume={current} onChange={setEdited} />
            </>
          )}

          {view === "changes" && (
            <div>
              {tailored.changes.map((c, i) => (
                <div className="change" key={i}>
                  <div className="sec">{c.section}</div>
                  {c.before && <div className="before">{c.before}</div>}
                  <div className="after">{c.after}</div>
                  <div className="why">{c.reason}</div>
                </div>
              ))}
            </div>
          )}

          {view === "latex" && (
            <div className="stack">
              <p className="sub">
                Paste into a new Overleaf project (compiler: pdfLaTeX), or click <b>Open in Overleaf</b> to create one automatically.
              </p>
              <pre className="code">{latex}</pre>
            </div>
          )}
        </div>

        <div className="sticky">
          <ResumePreview resume={current} />
        </div>
      </div>
    </div>
  );
}
