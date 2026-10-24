import type { Resume } from "./types";

/**
 * Stable ids for every editable line of a resume, so the AI coach can point at
 * ("highlight") or rewrite ("edit") one exact line without us trusting it to
 * quote text. Ids look like `experience.0.bullets.2`, `skills.1` or
 * `certifications.0`. Shared by the server routes and the browser.
 */
export type ResumeLine = { id: string; section: string; text: string };

export function listLines(r: Resume): ResumeLine[] {
  const out: ResumeLine[] = [];
  const add = (id: string, section: string, text: string) => {
    if (text.trim()) out.push({ id, section, text });
  };

  r.education.forEach((e, i) => e.details.forEach((d, j) => add(`education.${i}.details.${j}`, `Education: ${e.school}`, d)));
  r.experience.forEach((x, i) =>
    x.bullets.forEach((b, j) => add(`experience.${i}.bullets.${j}`, `Experience: ${x.title} @ ${x.company}`, b)),
  );
  r.projects.forEach((p, i) => p.bullets.forEach((b, j) => add(`projects.${i}.bullets.${j}`, `Project: ${p.name}`, b)));
  r.leadership.forEach((x, i) =>
    x.bullets.forEach((b, j) => add(`leadership.${i}.bullets.${j}`, `Leadership: ${x.title} @ ${x.company}`, b)),
  );
  r.skills.forEach((s, i) => add(`skills.${i}`, `Skills: ${s.category}`, s.items));
  r.certifications.forEach((c, i) => add(`certifications.${i}`, "Certifications & Awards", c));
  return out;
}

export function getLine(r: Resume, id: string): string | undefined {
  return listLines(r).find((l) => l.id === id)?.text;
}

/** Returns a copy of the resume with one line replaced, or null if the id doesn't exist. */
export function setLine(r: Resume, id: string, text: string): Resume | null {
  const [sec, a, field, b] = id.split(".");
  const i = Number(a);
  const j = Number(b);
  if (!Number.isInteger(i)) return null;
  const next = structuredClone(r);

  if (sec === "skills") {
    const s = next.skills[i];
    if (!s) return null;
    s.items = text;
    return next;
  }
  if (sec === "certifications") {
    if (next.certifications[i] === undefined) return null;
    next.certifications[i] = text;
    return next;
  }
  if (!Number.isInteger(j)) return null;

  let list: string[] | undefined;
  if (sec === "education" && field === "details") list = next.education[i]?.details;
  else if ((sec === "experience" || sec === "leadership" || sec === "projects") && field === "bullets") list = next[sec][i]?.bullets;
  if (!list || list[j] === undefined) return null;
  list[j] = text;
  return next;
}

/** The resume as plain text with `[id]` prefixes on every addressable line, for prompts. */
export function indexedResumeText(r: Resume): string {
  const byId = new Map(listLines(r).map((l) => [l.id, l.text]));
  const line = (id: string) => (byId.has(id) ? `  [${id}] ${byId.get(id)}` : null);
  const out: string[] = [`${r.name}`];

  if (r.education.length) {
    out.push("", "EDUCATION");
    r.education.forEach((e, i) => {
      out.push(`${e.school} | ${e.degree} | ${e.dates}`);
      e.details.forEach((_, j) => out.push(line(`education.${i}.details.${j}`) ?? ""));
    });
  }
  const entries = (title: string, key: "experience" | "leadership") => {
    if (!r[key].length) return;
    out.push("", title);
    r[key].forEach((x, i) => {
      out.push(`${x.title} @ ${x.company} | ${x.dates}`);
      x.bullets.forEach((_, j) => out.push(line(`${key}.${i}.bullets.${j}`) ?? ""));
    });
  };
  entries("EXPERIENCE", "experience");
  if (r.projects.length) {
    out.push("", "PROJECTS");
    r.projects.forEach((p, i) => {
      out.push(`${p.name} | ${p.tech} | ${p.dates}`);
      p.bullets.forEach((_, j) => out.push(line(`projects.${i}.bullets.${j}`) ?? ""));
    });
  }
  entries("LEADERSHIP & ACTIVITIES", "leadership");
  if (r.skills.length) {
    out.push("", "TECHNICAL SKILLS (each line = the comma-separated items of one group)");
    r.skills.forEach((s, i) => out.push(line(`skills.${i}`)?.replace("] ", `] (${s.category}) `) ?? ""));
  }
  if (r.certifications.length) {
    out.push("", "CERTIFICATIONS & AWARDS");
    r.certifications.forEach((_, i) => out.push(line(`certifications.${i}`) ?? ""));
  }
  return out.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
}
