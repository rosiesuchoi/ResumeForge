"use client";

import type { Experience, Resume } from "@/lib/types";

type Props = { resume: Resume; onChange: (r: Resume) => void; compact?: boolean };

const blankExp = (): Experience => ({ title: "", company: "", location: "", dates: "", bullets: [""] });

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      {label}
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Bullets({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div>
      {bullets.map((b, i) => (
        <div key={i} className={`bullet-row ${/\[[^\]]{1,30}\]/.test(b) ? "has-ph" : ""}`}>
          <textarea
            value={b}
            rows={2}
            aria-label={`Bullet ${i + 1}`}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <div className="stack" style={{ gap: 2 }}>
            <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => {
              const n = [...bullets];
              [n[i - 1], n[i]] = [n[i], n[i - 1]];
              onChange(n);
            }}>↑</button>
            <button className="icon-btn" title="Delete bullet" onClick={() => onChange(bullets.filter((_, j) => j !== i))}>×</button>
          </div>
        </div>
      ))}
      <button className="btn sm ghost" onClick={() => onChange([...bullets, ""])}>+ Add bullet</button>
    </div>
  );
}

function ExpList({ items, onChange, kind }: { items: Experience[]; onChange: (x: Experience[]) => void; kind: string }) {
  const set = (i: number, patch: Partial<Experience>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <>
      {items.map((x, i) => (
        <div className="entry" key={i}>
          <div className="entry-grid">
            <TextInput label="Title / role" value={x.title} onChange={(v) => set(i, { title: v })} />
            <TextInput label="Organization" value={x.company} onChange={(v) => set(i, { company: v })} />
            <TextInput label="Location" value={x.location} onChange={(v) => set(i, { location: v })} />
            <TextInput label="Dates" value={x.dates} placeholder="Jun. 2025 -- Aug. 2025" onChange={(v) => set(i, { dates: v })} />
          </div>
          <Bullets bullets={x.bullets} onChange={(b) => set(i, { bullets: b })} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn sm ghost danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove {kind}</button>
          </div>
        </div>
      ))}
      <button className="btn sm" onClick={() => onChange([...items, blankExp()])}>+ Add {kind}</button>
    </>
  );
}

export default function ResumeEditor({ resume: r, onChange }: Props) {
  const up = (patch: Partial<Resume>) => onChange({ ...r, ...patch });

  return (
    <div>
      <div className="entry-grid">
        <TextInput label="Full name" value={r.name} onChange={(v) => up({ name: v })} />
        <TextInput label="Email" value={r.email} onChange={(v) => up({ email: v })} />
        <TextInput label="Phone" value={r.phone} onChange={(v) => up({ phone: v })} />
        <TextInput label="Location (optional)" value={r.location} onChange={(v) => up({ location: v })} />
      </div>
      {r.links.map((l, i) => (
        <div className="row" key={i} style={{ marginBottom: 6, flexWrap: "nowrap" }}>
          <input type="text" aria-label="Link label" value={l.label} placeholder="Label" style={{ maxWidth: 180 }}
            onChange={(e) => up({ links: r.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
          <input type="url" aria-label="Link URL" value={l.url} placeholder="https://"
            onChange={(e) => up({ links: r.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
          <button className="icon-btn" title="Remove link" onClick={() => up({ links: r.links.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className="btn sm ghost" onClick={() => up({ links: [...r.links, { label: "", url: "" }] })}>+ Add link</button>

      <div className="editor-section">
        <h4>Education</h4>
        {r.education.map((e, i) => {
          const set = (patch: Partial<typeof e>) => up({ education: r.education.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div className="entry" key={i}>
              <div className="entry-grid">
                <TextInput label="School" value={e.school} onChange={(v) => set({ school: v })} />
                <TextInput label="Location" value={e.location} onChange={(v) => set({ location: v })} />
                <TextInput label="Degree" value={e.degree} onChange={(v) => set({ degree: v })} />
                <TextInput label="Dates" value={e.dates} onChange={(v) => set({ dates: v })} />
              </div>
              <label className="field">
                Details (one per line: GPA, coursework, honors)
                <textarea rows={2} value={e.details.join("\n")} onChange={(ev) => set({ details: ev.target.value.split("\n") })} />
              </label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn sm ghost danger" onClick={() => up({ education: r.education.filter((_, j) => j !== i) })}>Remove school</button>
              </div>
            </div>
          );
        })}
        <button className="btn sm" onClick={() => up({ education: [...r.education, { school: "", location: "", degree: "", dates: "", details: [] }] })}>+ Add school</button>
      </div>

      <div className="editor-section">
        <h4>Experience</h4>
        <ExpList kind="role" items={r.experience} onChange={(x) => up({ experience: x })} />
      </div>

      <div className="editor-section">
        <h4>Projects</h4>
        {r.projects.map((p, i) => {
          const set = (patch: Partial<typeof p>) => up({ projects: r.projects.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div className="entry" key={i}>
              <div className="entry-grid">
                <TextInput label="Project name" value={p.name} onChange={(v) => set({ name: v })} />
                <TextInput label="Tech stack" value={p.tech} onChange={(v) => set({ tech: v })} />
                <TextInput label="Dates" value={p.dates} onChange={(v) => set({ dates: v })} />
                <TextInput label="Link" value={p.link} onChange={(v) => set({ link: v })} />
              </div>
              <Bullets bullets={p.bullets} onChange={(b) => set({ bullets: b })} />
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn sm ghost danger" onClick={() => up({ projects: r.projects.filter((_, j) => j !== i) })}>Remove project</button>
              </div>
            </div>
          );
        })}
        <button className="btn sm" onClick={() => up({ projects: [...r.projects, { name: "", tech: "", dates: "", link: "", bullets: [""] }] })}>+ Add project</button>
      </div>

      <div className="editor-section">
        <h4>Leadership &amp; Activities</h4>
        <ExpList kind="activity" items={r.leadership} onChange={(x) => up({ leadership: x })} />
      </div>

      <div className="editor-section">
        <h4>Technical Skills</h4>
        {r.skills.map((s, i) => (
          <div className="row" key={i} style={{ marginBottom: 6, flexWrap: "nowrap" }}>
            <input type="text" aria-label="Skill category" value={s.category} style={{ maxWidth: 170 }}
              onChange={(e) => up({ skills: r.skills.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })} />
            <input type="text" aria-label="Skills" value={s.items}
              onChange={(e) => up({ skills: r.skills.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)) })} />
            <button className="icon-btn" title="Remove group" onClick={() => up({ skills: r.skills.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button className="btn sm ghost" onClick={() => up({ skills: [...r.skills, { category: "", items: "" }] })}>+ Add skill group</button>
      </div>

      <div className="editor-section">
        <h4>Certifications &amp; Awards</h4>
        <textarea rows={2} value={r.certifications.join("\n")} placeholder="One per line"
          onChange={(e) => up({ certifications: e.target.value.split("\n") })} />
      </div>
    </div>
  );
}
