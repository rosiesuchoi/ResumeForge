"use client";

import type { Resume } from "@/lib/types";
import type { ReactNode } from "react";

/** Highlight [placeholders] the user still has to fill in. */
function withMarks(s: string): ReactNode {
  const parts = dash(s).split(/(\[[^\]]{1,30}\])/g);
  return parts.map((p, i) => (/^\[[^\]]+\]$/.test(p) ? <mark key={i}>{p}</mark> : p));
}

/** Mirror LaTeX typography: "--" renders as an en dash, "---" as an em dash. */
const dash = (s: string) => s.replace(/---/g, "\u2014").replace(/--/g, "\u2013");

const display = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

/** HTML approximation of the Jake's Resume PDF, for instant preview while editing. */
export default function ResumePreview({ resume: r }: { resume: Resume }) {
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

  const expLike = (title: string, items: Resume["experience"]) =>
    items.length > 0 && (
      <>
        <div className="psec">{title}</div>
        {items.map((x, i) => (
          <div className="pitem" key={i}>
            <div className="prow">
              <b>{x.title}</b>
              <span>{dash(x.dates)}</span>
            </div>
            <div className="prow sub">
              <span>{x.company}</span>
              <span>{x.location}</span>
            </div>
            <ul>
              {x.bullets.filter(Boolean).map((b, j) => (
                <li key={j}>{withMarks(b)}</li>
              ))}
            </ul>
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
                {e.details.filter(Boolean).length > 0 && (
                  <ul>
                    {e.details.filter(Boolean).map((d, j) => (
                      <li key={j}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}

        {expLike("Experience", r.experience)}

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
                <ul>
                  {p.bullets.filter(Boolean).map((b, j) => (
                    <li key={j}>{withMarks(b)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        {expLike("Leadership & Activities", r.leadership)}

        {r.skills.length > 0 && (
          <>
            <div className="psec">Technical Skills</div>
            <div className="pskills">
              {r.skills
                .filter((s) => s.category && s.items)
                .map((s, i) => (
                  <div key={i}>
                    <b>{s.category}</b>: {s.items}
                  </div>
                ))}
            </div>
          </>
        )}

        {r.certifications.filter(Boolean).length > 0 && (
          <>
            <div className="psec">Certifications &amp; Awards</div>
            <div className="pskills">
              {r.certifications.filter(Boolean).map((c, i) => (
                <div key={i}>{c}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
