"use client";

import { useMemo, useState } from "react";
import { api, usePersistentState } from "@/lib/client";
import type { AtsResult, JobAnalysis, JobPosting, Resume, TailorResult } from "@/lib/types";
import UploadPanel from "./UploadPanel";
import JobPanel from "./JobPanel";
import TailorPanel from "./TailorPanel";
import JobBoard from "./JobBoard";
import CoachPanel from "./CoachPanel";

export type JobState = { posting: JobPosting; analysis: JobAnalysis; url: string };
export type TailorState = TailorResult & { ats: { before: AtsResult; after: AtsResult } };
export type CoachTarget = { company: string; role: string; nonce: number };

const TABS = [
  { id: "resume", label: "Resume" },
  { id: "job", label: "Target job" },
  { id: "tailor", label: "Tailored resume" },
  { id: "board", label: "Job board" },
  { id: "coach", label: "AI coach" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Workspace() {
  const [tab, setTab] = usePersistentState<TabId>("tab", "resume");
  const [resume, setResume] = usePersistentState<Resume | null>("resume", null);
  const [job, setJob] = usePersistentState<JobState | null>("job", null);
  const [tailored, setTailored] = usePersistentState<TailorState | null>("tailored", null);
  const [edited, setEdited] = usePersistentState<Resume | null>("edited", null);

  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [pendingJobUrl, setPendingJobUrl] = useState<{ url: string; nonce: number } | null>(null);
  const [coachTarget, setCoachTarget] = useState<CoachTarget | null>(null);

  /** The best current version of the resume (tailored+edited > parsed). */
  const activeResume = edited ?? tailored?.resume ?? resume;

  const done = useMemo(
    () => ({ resume: !!resume, job: !!job, tailor: !!tailored, board: false, coach: false }),
    [resume, job, tailored],
  );

  async function runTailor() {
    if (!resume || !job) return;
    setTailoring(true);
    setTailorError(null);
    setTab("tailor");
    try {
      const r = await api<TailorState>("/api/tailor", { resume, job: job.analysis, jobText: job.posting.text });
      setTailored(r);
      setEdited(r.resume);
    } catch (e) {
      setTailorError(e instanceof Error ? e.message : String(e));
    } finally {
      setTailoring(false);
    }
  }

  function onNewResume(r: Resume) {
    setResume(r);
    setTailored(null);
    setEdited(null);
  }

  function onNewJob(j: JobState) {
    setJob(j);
    setTailored(null);
    setEdited(null);
  }

  function startOver() {
    if (!confirmReset()) return;
    setResume(null);
    setJob(null);
    setTailored(null);
    setEdited(null);
    setTab("resume");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>RF</div>
          <div>
            <h1>Resume Forge</h1>
            <p>Jake&apos;s Resume · Google XYZ bullets · ATS keyword match · live SWE jobs</p>
          </div>
        </div>
        {(resume || job) && (
          <button className="btn sm ghost" onClick={startOver}>Start over</button>
        )}
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className={`num ${done[t.id] ? "done" : ""}`}>{done[t.id] ? "✓" : i + 1}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "resume" && (
          <UploadPanel resume={resume} onParsed={onNewResume} onEdit={setResume} onNext={() => setTab("job")} />
        )}
        {tab === "job" && (
          <JobPanel
            resume={resume}
            job={job}
            onAnalyzed={onNewJob}
            onTailor={runTailor}
            tailoring={tailoring}
            pending={pendingJobUrl}
            goResume={() => setTab("resume")}
          />
        )}
        {tab === "tailor" && (
          <TailorPanel
            resume={resume}
            job={job}
            tailored={tailored}
            edited={edited}
            setEdited={setEdited}
            tailoring={tailoring}
            error={tailorError}
            onRetailor={runTailor}
            go={(t) => setTab(t)}
            onCoach={() => {
              setCoachTarget({ company: job?.analysis.company ?? "", role: job?.analysis.title ?? "", nonce: Date.now() });
              setTab("coach");
            }}
          />
        )}
        {tab === "board" && (
          <JobBoard
            resume={activeResume}
            onTailorTo={(url) => {
              setPendingJobUrl({ url, nonce: Date.now() });
              setTab("job");
            }}
            onPrep={(company, role) => {
              setCoachTarget({ company, role, nonce: Date.now() });
              setTab("coach");
            }}
            goResume={() => setTab("resume")}
          />
        )}
        {tab === "coach" && (
          <CoachPanel
            resume={activeResume}
            job={job}
            missing={tailored?.ats.after.missing ?? []}
            target={coachTarget}
            goResume={() => setTab("resume")}
          />
        )}
      </main>

      <footer className="footer">
        Template: <a href="https://github.com/jakegut/resume" target="_blank" rel="noreferrer">Jake&apos;s Resume</a> (MIT) ·
        Jobs: <a href="https://github.com/SimplifyJobs" target="_blank" rel="noreferrer">SimplifyJobs</a> on GitHub ·
        Your data stays in this browser and is sent only to the AI for processing.
      </footer>
    </div>
  );
}

function confirmReset() {
  try {
    return window.confirm("Clear your resume, job, and tailored version from this browser?");
  } catch {
    return true;
  }
}
