"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, scoreTone, timeAgo } from "@/lib/client";
import { resumeToText } from "@/lib/latex";
import type { AtsResult, Resume, ScoredBoardJob } from "@/lib/types";
import { ErrorBox, FitBar, Spinner } from "./ui";

type Props = {
  resume: Resume | null;
  onTailorTo: (url: string) => void;
  onPrep: (company: string, role: string) => void;
  goResume: () => void;
};

type Deep = { status: "loading" } | { status: "done"; ats: AtsResult } | { status: "error"; message: string };
type Sort = "fit" | "new" | "ats";
const PAGE = 50;

export default function JobBoard({ resume, onTailorTo, onPrep, goResume }: Props) {
  const [jobs, setJobs] = useState<ScoredBoardJob[] | null>(null);
  const [meta, setMeta] = useState<{ fetchedAt: number; sources: { list: string; repo: string; url: string }[]; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [list, setList] = useState<"all" | "newgrad" | "intern">("all");
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("fit");
  const [sponsorOnly, setSponsorOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [deep, setDeep] = useState<Record<string, Deep>>({});
  const [batching, setBatching] = useState(false);

  const resumeText = useMemo(() => (resume ? resumeToText(resume) : ""), [resume]);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const r = await api<{ jobs: ScoredBoardJob[]; fetchedAt: number; sources: { list: string; repo: string; url: string }[]; errors: string[] }>(
          "/api/jobs",
          { resumeText, days, list: "all", refresh },
        );
        setJobs(r.jobs);
        setMeta({ fetchedAt: r.fetchedAt, sources: r.sources, errors: r.errors });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [resumeText, days],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const needle = q.trim().toLowerCase();
    let out = jobs.filter(
      (j) =>
        (list === "all" || j.list === list) &&
        (!sponsorOnly || !/does not|no sponsorship|u\.?s\.? citizen/i.test(j.sponsorship)) &&
        (!needle || `${j.company} ${j.title} ${j.locations.join(" ")}`.toLowerCase().includes(needle)),
    );
    const atsOf = (j: ScoredBoardJob) => {
      const d = deep[j.id];
      return d?.status === "done" ? d.ats.score : -1;
    };
    out = [...out].sort((a, b) =>
      sort === "new" ? b.datePosted - a.datePosted : sort === "ats" ? atsOf(b) - atsOf(a) || b.fit - a.fit : b.fit - a.fit || b.datePosted - a.datePosted,
    );
    return out;
  }, [jobs, list, q, sort, deep, sponsorOnly]);

  async function scan(j: ScoredBoardJob) {
    if (!resumeText) return;
    setDeep((d) => ({ ...d, [j.id]: { status: "loading" } }));
    try {
      const ats = await api<AtsResult>("/api/job-score", { url: j.url, resumeText });
      setDeep((d) => ({ ...d, [j.id]: { status: "done", ats } }));
    } catch (e) {
      setDeep((d) => ({ ...d, [j.id]: { status: "error", message: e instanceof Error ? e.message : String(e) } }));
    }
  }

  async function scanTop(n = 15) {
    setBatching(true);
    const queue = filtered.filter((j) => !deep[j.id] || deep[j.id].status === "error").slice(0, n);
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const j = queue.shift();
        if (j) await scan(j);
      }
    });
    await Promise.all(workers);
    setBatching(false);
  }

  const counts = useMemo(() => {
    const c = { all: jobs?.length ?? 0, newgrad: 0, intern: 0 };
    jobs?.forEach((j) => c[j.list]++);
    return c;
  }, [jobs]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Live software engineering jobs</h2>
          <p className="sub">
            Pulled from{" "}
            {meta?.sources.map((s, i) => (
              <span key={s.repo}>
                {i > 0 && " and "}
                <a href={s.url} target="_blank" rel="noreferrer">{s.repo}</a>
              </span>
            )) ?? "SimplifyJobs on GitHub"}
            {meta && ` · updated ${timeAgo(meta.fetchedAt / 1000)} ago`}
          </p>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => load(true)} disabled={loading}>{loading ? <Spinner /> : "↻"} Refresh</button>
          <button className="btn sm primary" onClick={() => scanTop(15)} disabled={!resume || batching || !filtered.length}>
            {batching ? <Spinner /> : null} Scan top 15 for ATS match
          </button>
        </div>
      </div>

      {!resume && (
        <div className="warn" style={{ marginBottom: 12 }}>
          Upload your resume to see your fit score for every job.{" "}
          <button className="btn sm" onClick={goResume}>Upload</button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="seg">
          {(["all", "newgrad", "intern"] as const).map((l) => (
            <button key={l} className={list === l ? "on" : ""} onClick={() => { setList(l); setShown(PAGE); }}>
              {l === "all" ? "All" : l === "newgrad" ? "New grad" : "Internships"} ({counts[l]})
            </button>
          ))}
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: "auto" }} aria-label="Posted within">
          {[3, 7, 14, 30, 60].map((d) => (
            <option key={d} value={d}>Posted in last {d} days</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto" }} aria-label="Sort by">
          <option value="fit">Sort: best fit</option>
          <option value="ats">Sort: ATS match (scanned)</option>
          <option value="new">Sort: newest</option>
        </select>
        <label className="row sub" style={{ gap: 6 }}>
          <input type="checkbox" checked={sponsorOnly} onChange={(e) => setSponsorOnly(e.target.checked)} /> Hide “no sponsorship”
        </label>
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search company, title, or location" style={{ flex: 1, minWidth: 200 }} />
      </div>

      <ErrorBox error={error} />
      {meta?.errors.length ? <div className="warn">Some sources failed: {meta.errors.join("; ")}</div> : null}

      {loading && !jobs && (
        <div className="empty"><Spinner /> Loading thousands of listings from GitHub…</div>
      )}

      {jobs && (
        <>
          <p className="sub" style={{ marginBottom: 8 }}>
            <b>Est. fit</b> compares your skills with what this kind of role usually needs (from the title). <b>ATS match</b> reads the actual
            posting and scores your resume&apos;s keyword coverage. Click <b>Scan</b> on any row.
          </p>
          <div className="table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Company / role</th>
                  <th>Posted</th>
                  <th>Est. fit</th>
                  <th>ATS match</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((j) => {
                  const d = deep[j.id];
                  return (
                    <tr key={j.id}>
                      <td>
                        <div className="company">
                          {j.company} <span className={`badge ${j.list === "intern" ? "accent" : ""}`}>{j.list === "intern" ? "Intern" : "New grad"}</span>
                        </div>
                        <div className="title">{j.title}</div>
                        <div className="loc">
                          {j.locations.slice(0, 2).join(" · ")}
                          {j.locations.length > 2 ? ` +${j.locations.length - 2}` : ""}
                          {j.sponsorship && j.sponsorship !== "Other" ? ` · ${j.sponsorship}` : ""}
                        </div>
                      </td>
                      <td className="loc">{timeAgo(j.datePosted)}</td>
                      <td>
                        {resume ? (
                          <div className="fitcell" title={j.fitMissing.length ? `Gaps: ${j.fitMissing.join(", ")}` : "Strong skill overlap"}>
                            <span className="fitnum">{j.fit}%</span>
                            <FitBar value={j.fit} />
                          </div>
                        ) : (
                          <span className="sub">—</span>
                        )}
                      </td>
                      <td>
                        {!d && (
                          <button className="btn sm" onClick={() => scan(j)} disabled={!resume}>Scan</button>
                        )}
                        {d?.status === "loading" && <Spinner />}
                        {d?.status === "done" && (
                          <span
                            className={`badge ${scoreTone(d.ats.score)}`}
                            style={{ fontSize: 13 }}
                            title={`Matched: ${d.ats.matched.join(", ") || "none"}\nMissing: ${d.ats.missing.join(", ") || "none"}`}
                          >
                            {d.ats.score}%
                          </span>
                        )}
                        {d?.status === "error" && (
                          <button className="btn sm ghost" title={d.message} onClick={() => scan(j)}>Can&apos;t read ↻</button>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <a className="btn sm" href={j.url} target="_blank" rel="noreferrer">Apply ↗</a>
                          <button className="btn sm" onClick={() => onTailorTo(j.url)} disabled={!resume}>Tailor</button>
                          <button className="btn sm ghost" onClick={() => onPrep(j.company, j.title)}>Prep</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && <div className="empty">No jobs match those filters.</div>}
          {filtered.length > shown && (
            <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn" onClick={() => setShown((s) => s + PAGE)}>
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
