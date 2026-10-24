"use client";

import type { CoachHighlight, Resume } from "@/lib/types";
import type { ReactNode } from "react";

/** Highlight [placeholders] the user still has to fill in. */
function withMarks(s: string): ReactNode {
  const parts = dash(s).split(/(\[[^\]]{1,30}\])/g);
  return parts.map((p, i) => (/^\[[^\]]+\]$/.test(p) ? <mark key={i}>{p}</mark> : p));
}

/** Mirror LaTeX typography: "--" renders as an en dash, "---" as an em dash. */
const dash = (s: string) => s.replace(/---/g, "—").replace(/--/g, "–");

const display = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

/**
 * HTML approximation of the Jake's Resume PDF, for instant preview while editing.
 * Sized in container units (see .paper in globals.css) so it keeps real US-Letter
 * proportions and scales with its column. `highlights` (from the AI coach) paint
 * the weakest lines yellow and the strongest green; a mark only shows while the
 * line still reads exactly as it did when the coach looked at it.
 */
export default function ResumePreview({ resume: r, highlights }: { resume: Resume; highlights?: CoachHighlight[] }) {
  const mark = (id: string, text: string, content: ReactNode): ReactNode => {
    const h = highlights?.find((x) => x.id === id && x.text === text);
    return h ? (
      <span className={`hl hl-${h.kind}`} title={`${h.kind === "weak" ? "Weakest" : "Strongest"}: ${h.reason}`}>
        {content}
      </span>
    ) : (
      content
    );
  };

  const contact = [
    r.phone && <span key="p">{r.phone}</span>,
    r.location && <span key="l">{r.location}</span>,
    r.email && (
      <a key="e" href={`mailto:${r.email}`}>
        {r.email}
      </a>
    ),
    ...r.links
      .filter((l) => l.url)
      .map((l, i) => (
        <a key={`k${i}`} href={/^https?:/.test(l.url) ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer">
          {l.label && !/^(linkedin|github|portfolio|website)$/i.test(l.label) ? l.label : display(l.url)}
        </a>
      )),
  ].filter(Boolean);

  const bullets = (prefix: string, items: string[]) => (
    <ul>
      {items.map((b, j) =>
        b.trim() ? <li key={j}>{mark(`${prefix}.bullets.${j}`, b, withMarks(b))}</li> : null,
      )}
    </ul>
  );

  const expLike = (key: "experience" | "leadership", title: string) =>
    r[key].length > 0 && (
      <>
        <div className="psec">{title}</div>
        {r[key].map((x, i) => (
          <div className="pitem" key={i}>
            <div className="prow">
              <b>{x.title}</b>
              <span>{dash(x.dates)}</span>
            </div>
            <div className="prow sub">
              <span>{x.company}</span>
              <span>{x.location}</span>
            </div>
            {bullets(`${key}.${i}`, x.bullets)}
          </div>
        ))}
      </>
    );

  return (
    <div className="paper-wrap">
      <div className="paper" aria-label="Resume preview">
        <div className="pname">{r.name || "Your Name"}</div>
        <div className="pcontact">
          {contact.map((c, i) => (
            <span key={i}>
              {i > 0 && " | "}
              {c}
            </span>
          ))}
        </div>

        {r.education.length > 0 && (
          <>
            <div className="psec">Education</div>
            {r.education.map((e, i) => (
              <div className="pitem" key={i}>
                <div className="prow">
                  <b>{e.school}</b>
                  <span>{e.location}</span>
                </div>
                <div className="prow sub">
                  <span>{e.degree}</span>
                  <span>{dash(e.dates)}</span>
                </div>
                {e.details.some((d) => d.trim()) && (
                  <ul>
                    {e.details.map((d, j) =>
                      d.trim() ? <li key={j}>{mark(`education.${i}.details.${j}`, d, d)}</li> : null,
                    )}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}

        {expLike("experience", "Experience")}

        {r.projects.length > 0 && (
          <>
            <div className="psec">Projects</div>
            {r.projects.map((p, i) => (
              <div className="pitem" key={i}>
                <div className="prow">
                  <span>
                    <b>{p.name}</b>
                    {p.tech && (
                      <>
                        {" | "}
                        <i>{p.tech}</i>
                      </>
                    )}
                  </span>
                  <span>{dash(p.dates)}</span>
                </div>
                {bullets(`projects.${i}`, p.bullets)}
              </div>
            ))}
          </>
        )}

        {expLike("leadership", "Leadership & Activities")}

        {r.skills.length > 0 && (
          <>
            <div className="psec">Technical Skills</div>
            <div className="pskills">
              {r.skills.map((s, i) =>
                s.category && s.items ? (
                  <div key={i}>
                    <b>{s.category}</b>: {mark(`skills.${i}`, s.items, s.items)}
                  </div>
                ) : null,
              )}
            </div>
          </>
        )}

        {r.certifications.some((c) => c.trim()) && (
          <>
            <div className="psec">Certifications &amp; Awards</div>
            <div className="pskills">
              {r.certifications.map((c, i) => (c.trim() ? <div key={i}>{mark(`certifications.${i}`, c, c)}</div> : null))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
