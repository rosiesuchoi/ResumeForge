"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { atsScore, hasKeyword, weightsFromAnalysis } from "@/lib/keywords";
import { resumeToText } from "@/lib/latex";
import type { JobAnalysis, JobPosting, Resume } from "@/lib/types";
import type { JobState } from "./Workspace";
import { ErrorBox, ScoreRing, Spinner } from "./ui";

type Props = {
  resume: Resume | null;
  job: JobState | null;
  onAnalyzed: (j: JobState) => void;
  onTailor: () => void;
  tailoring: boolean;
  pending: { url: string; nonce: number } | null;
  goResume: () => void;
};

export default function JobPanel({ resume, job, onAnalyzed, onTailor, tailoring, pending, goResume }: Props) {
  const [url, setUrl] = useState(job?.url ?? "");
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNonce = useRef<number | null>(null);

  async function analyze(u = url, t = text) {
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ posting: JobPosting; analysis: JobAnalysis }>("/api/analyze-job", { url: u || undefined, text: t || undefined });
      onAnalyzed({ ...r, url: u });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      if (/paste/i.test(msg)) setShowPaste(true);
    } finally {
      setBusy(false);
    }
  }

  // Arriving from the job board with a link: analyze it right away.
  useEffect(() => {
    if (pending && pending.nonce !== lastNonce.current) {
      lastNonce.current = pending.nonce;
      setUrl(pending.url);
      setText("");
      analyze(pending.url, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.nonce]);

  const resumeText = useMemo(() => (resume ? resumeToText(resume) : ""), [resume]);
  const ats = useMemo(
    () => (job && resume ? atsScore(resumeText, weightsFromAnalysis(job.analysis)) : null),
    [job, resume, resumeText],
  );

  const chip = (k: string) => {
    const has = resume ? hasKeyword(resumeText, k) : false;
    return (
      <span key={k} className={`chip ${resume ? (has ? "good" : "low") : ""}`} title={resume ? (has ? "On your resume" : "Not on your resume yet") : ""}>
        {resume && (has ? "✓ " : "")}
        {k}
      </span>
    );
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Which job are you applying for?</h2>
            <p className="sub">
              Paste the job link (Greenhouse, Lever, Ashby, Workday, SmartRecruiters and most career pages work), or paste the description.
            </p>
          </div>
        </div>
        <form
          className="row"
          style={{ flexWrap: "nowrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            analyze();
          }}
        >
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://boards.greenhouse.io/company/jobs/123456" aria-label="Job link" />
          <button className="btn primary" type="submit" disabled={busy || (!url && text.trim().length < 150)}>
            {busy ? <Spinner /> : null} Analyze
          </button>
        </form>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => setShowPaste((s) => !s)}>
            {showPaste ? "Hide description box" : "Paste the job description instead"}
          </button>
        </div>
        {showPaste && (
          <textarea style={{ marginTop: 8 }} rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full job description…" />
        )}
        {busy && <p className="sub" style={{ marginTop: 10 }}>Reading the posting and pulling out what the ATS will look for…</p>}
        <div style={{ marginTop: 10 }}>
          <ErrorBox error={error} />
        </div>
      </div>

      {job && (
        <div className="grid-side">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>{job.analysis.title || job.posting.title || "Job"}</h2>
                <p className="sub">
                  {[job.analysis.company, job.analysis.location, job.analysis.level].filter(Boolean).join(" · ")}
                  {job.url && (
                    <>
                      {" · "}
                      <a href={job.url} target="_blank" rel="noreferrer">View posting ↗</a>
                    </>
                  )}
                </p>
              </div>
            </div>
            <p style={{ marginBottom: 14 }}>{job.analysis.summary}</p>
            <div className="stack">
              <div>
                <h4 style={{ marginBottom: 6 }}>Required skills</h4>
                <div className="chips">{job.analysis.requiredSkills.map(chip)}</div>
              </div>
              {job.analysis.preferredSkills.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 6 }}>Preferred skills</h4>
                  <div className="chips">{job.analysis.preferredSkills.map(chip)}</div>
                </div>
              )}
              <div>
                <h4 style={{ marginBottom: 6 }}>Other ATS keywords</h4>
                <div className="chips">{job.analysis.keywords.map(chip)}</div>
              </div>
              <div>
                <h4 style={{ marginBottom: 6 }}>What you&apos;d do</h4>
                <ul className="clean">
                  {job.analysis.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card sticky">
            {resume && ats ? (
              <div className="stack">
                <div className="score">
                  <ScoreRing score={ats.score} label="Current ATS match" />
                  <div>
                    <div className="label">CURRENT ATS MATCH</div>
                    <div className="value">
                      {ats.matched.length} of {ats.total} keywords found
                    </div>
                  </div>
                </div>
                <p className="sub">
                  Weighted keyword match of your current resume against this posting (required skills count 3×, preferred 1.5×).
                  Tailoring rewrites your bullets in Google&apos;s XYZ format and works in the missing keywords you can truthfully claim.
                </p>
                <button className="btn primary" onClick={onTailor} disabled={tailoring}>
                  {tailoring ? <Spinner /> : null} {tailoring ? "Tailoring…" : "Tailor my resume →"}
                </button>
              </div>
            ) : (
              <div className="stack">
                <p>Upload your resume to see how well it matches this job.</p>
                <button className="btn primary" onClick={goResume}>Upload resume</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
