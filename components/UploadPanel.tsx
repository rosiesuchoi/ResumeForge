"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Resume } from "@/lib/types";
import ResumeEditor from "./ResumeEditor";
import ResumePreview from "./ResumePreview";
import { ErrorBox, Spinner } from "./ui";

type Props = { resume: Resume | null; onParsed: (r: Resume) => void; onEdit: (r: Resume) => void; onNext: () => void };

export default function UploadPanel({ resume, onParsed, onEdit, onNext }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [paste, setPaste] = useState("");
  const [replacing, setReplacing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF. (Or use “paste text instead”.)");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { resume: r } = await api<{ resume: Resume }>("/api/parse-resume", fd);
      onParsed(r);
      setReplacing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function parsePaste() {
    setError(null);
    setBusy(true);
    try {
      const { resume: r } = await api<{ resume: Resume }>("/api/parse-resume", { text: paste });
      onParsed(r);
      setReplacing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!resume || replacing) {
    return (
      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="card-head">
          <div>
            <h2>Upload your resume</h2>
            <p className="sub">Any layout works. We&apos;ll read it and convert it into the Jake&apos;s Resume structure.</p>
          </div>
          {replacing && <button className="btn sm ghost" onClick={() => setReplacing(false)}>Cancel</button>}
        </div>

        {!pasteMode ? (
          <div
            className={`drop ${over ? "over" : ""}`}
            onClick={() => !busy && input.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files[0];
              if (f) upload(f);
            }}
            role="button"
            tabIndex={0}
          >
            {busy ? (
              <div className="row" style={{ justifyContent: "center" }}>
                <Spinner /> Reading your resume… (about 20–40 seconds)
              </div>
            ) : (
              <>
                <strong>Drop your resume PDF here</strong>
                <span className="sub">or click to choose a file · max 5 MB</span>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <div className="stack">
            <textarea rows={14} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste your resume text here…" />
            <div className="row">
              <button className="btn primary" disabled={busy || paste.trim().length < 100} onClick={parsePaste}>
                {busy ? <Spinner /> : null} Convert
              </button>
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn sm ghost" onClick={() => setPasteMode((p) => !p)} disabled={busy}>
            {pasteMode ? "Upload a PDF instead" : "Paste text instead"}
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <ErrorBox error={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid-side">
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Check what we read</h2>
            <p className="sub">Fix anything the PDF reader got wrong. Edits save automatically in this browser.</p>
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => setReplacing(true)}>Replace resume</button>
            <button className="btn sm primary" onClick={onNext}>Next: target job →</button>
          </div>
        </div>
        <ResumeEditor resume={resume} onChange={onEdit} />
      </div>
      <div className="sticky">
        <ResumePreview resume={resume} />
      </div>
    </div>
  );
}
