import * as cheerio from "cheerio";
import { HttpError } from "./claude";
import type { JobPosting } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "That doesn't look like a valid URL.");
  }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, "Only http(s) job links are supported.");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === "[::1]" ||
    !h.includes(".")
  ) {
    throw new HttpError(400, "That host isn't allowed.");
  }
  return u;
}

async function get(url: string, accept = "text/html,application/json"): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = init ? await fetch(url, { ...init, cache: "no-store" }) : await get(url, "application/json");
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** HTML -> readable text keeping list/paragraph breaks. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,iframe,header nav,footer").remove();
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("\n• ");
  });
  $("p,div,h1,h2,h3,h4,h5,h6,ul,ol,section,tr").each((_, el) => {
    $(el).append("\n");
  });
  return $.root()
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function decodeEntities(s: string): string {
  return cheerio.load(`<div>${s}</div>`)("div").text();
}

/* ---------- ATS-specific public APIs (most job pages are JS-rendered) ---------- */

async function greenhouse(u: URL): Promise<JobPosting | null> {
  let board: string | undefined;
  let id: string | undefined = u.searchParams.get("gh_jid") ?? undefined;
  const m = u.pathname.match(/^\/(?:embed\/job_app\?for=)?([^/]+)\/jobs\/(\d+)/);
  if (/greenhouse\.io$/.test(u.hostname) && m) {
    board = m[1];
    id = m[2];
  }
  if (/greenhouse\.io$/.test(u.hostname) && !board) board = u.searchParams.get("for") ?? undefined;
  if (!id) return null;
  if (!board) {
    // gh_jid on a company career page; board token is usually the company name in the host
    board = u.hostname.replace(/^(www|careers|jobs)\./, "").split(".")[0];
  }
  const j = await getJson<{ title: string; content: string; location?: { name: string }; company_name?: string }>(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
  );
  if (!j?.content) return null;
  return {
    url: u.toString(),
    source: "greenhouse",
    title: j.title,
    company: j.company_name ?? board,
    location: j.location?.name ?? "",
    text: htmlToText(decodeEntities(j.content)),
  };
}

async function lever(u: URL): Promise<JobPosting | null> {
  if (!/lever\.co$/.test(u.hostname)) return null;
  const [, company, id] = u.pathname.split("/");
  if (!company || !id) return null;
  const host = u.hostname.includes(".eu.") ? "api.eu.lever.co" : "api.lever.co";
  const j = await getJson<{
    text: string;
    descriptionPlain?: string;
    additionalPlain?: string;
    lists?: { text: string; content: string }[];
    categories?: { location?: string };
  }>(`https://${host}/v0/postings/${company}/${id}`);
  if (!j) return null;
  const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
  return {
    url: u.toString(),
    source: "lever",
    title: j.text,
    company,
    location: j.categories?.location ?? "",
    text: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n"),
  };
}

async function ashby(u: URL): Promise<JobPosting | null> {
  if (!/ashbyhq\.com$/.test(u.hostname)) return null;
  const [, org, id] = u.pathname.split("/");
  if (!org || !id) return null;
  const j = await getJson<{
    jobs: { id: string; title: string; location: string; descriptionPlain?: string; descriptionHtml?: string }[];
  }>(`https://api.ashbyhq.com/posting-api/job-board/${org}?includeCompensation=true`);
  const job = j?.jobs?.find((x) => x.id === id);
  if (!job) return null;
  return {
    url: u.toString(),
    source: "ashby",
    title: job.title,
    company: org,
    location: job.location ?? "",
    text: job.descriptionPlain || htmlToText(job.descriptionHtml ?? ""),
  };
}

async function workday(u: URL): Promise<JobPosting | null> {
  // https://{tenant}.wd5.myworkdayjobs.com/[en-US/]{site}/job/{loc}/{slug}
  if (!/myworkdayjobs\.com$/.test(u.hostname)) return null;
  const tenant = u.hostname.split(".")[0];
  const parts = u.pathname.split("/").filter(Boolean);
  if (/^[a-z]{2}-[A-Z]{2}$/.test(parts[0] ?? "")) parts.shift();
  const site = parts.shift();
  const jobIdx = parts.indexOf("job");
  if (!site || jobIdx < 0) return null;
  const rest = parts.slice(jobIdx).join("/");
  const j = await getJson<{
    jobPostingInfo?: { title: string; jobDescription: string; location?: string };
    hiringOrganization?: { name: string };
  }>(`https://${u.hostname}/wday/cxs/${tenant}/${site}/${rest}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!j?.jobPostingInfo) return null;
  return {
    url: u.toString(),
    source: "workday",
    title: j.jobPostingInfo.title,
    company: j.hiringOrganization?.name ?? tenant,
    location: j.jobPostingInfo.location ?? "",
    text: htmlToText(j.jobPostingInfo.jobDescription),
  };
}

async function smartRecruiters(u: URL): Promise<JobPosting | null> {
  if (!/smartrecruiters\.com$/.test(u.hostname)) return null;
  const [, company, slug] = u.pathname.split("/");
  const id = slug?.match(/^(\d+)/)?.[1];
  if (!company || !id) return null;
  const j = await getJson<{
    name: string;
    company?: { name: string };
    location?: { city?: string; region?: string };
    jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
  }>(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`);
  if (!j?.jobAd?.sections) return null;
  const text = Object.values(j.jobAd.sections)
    .map((s) => `${s.title ?? ""}\n${htmlToText(s.text ?? "")}`)
    .join("\n\n");
  return {
    url: u.toString(),
    source: "smartrecruiters",
    title: j.name,
    company: j.company?.name ?? company,
    location: [j.location?.city, j.location?.region].filter(Boolean).join(", "),
    text,
  };
}

/* ---------- generic page: JSON-LD JobPosting, then readable text ---------- */

type LdJob = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } } | { address?: { addressLocality?: string } }[];
  "@graph"?: LdJob[];
};

function findLdJob(node: unknown): LdJob | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findLdJob(n);
      if (f) return f;
    }
    return null;
  }
  const n = node as LdJob;
  const type = n["@type"];
  if ((Array.isArray(type) ? type : [type]).includes("JobPosting")) return n;
  if (n["@graph"]) return findLdJob(n["@graph"]);
  return null;
}

async function generic(u: URL): Promise<JobPosting> {
  let res: Response;
  try {
    res = await get(u.toString());
  } catch {
    throw new HttpError(502, "Couldn't reach that job page. Paste the job description instead.");
  }
  if (!res.ok) throw new HttpError(502, `The job page returned HTTP ${res.status}. Paste the job description instead.`);
  const html = await res.text();
  const $ = cheerio.load(html);

  let job: LdJob | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (job) return;
    try {
      job = findLdJob(JSON.parse($(el).contents().text()));
    } catch {
      /* ignore bad JSON-LD */
    }
  });
  const ld = job as LdJob | null;
  if (ld?.description) {
    const loc = Array.isArray(ld.jobLocation) ? ld.jobLocation[0] : ld.jobLocation;
    const org = typeof ld.hiringOrganization === "string" ? ld.hiringOrganization : ld.hiringOrganization?.name;
    return {
      url: u.toString(),
      source: "jsonld",
      title: ld.title ?? "",
      company: org ?? "",
      location: [loc?.address?.addressLocality, (loc?.address as { addressRegion?: string })?.addressRegion].filter(Boolean).join(", "),
      text: htmlToText(decodeEntities(ld.description)),
    };
  }

  const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
  const site = $('meta[property="og:site_name"]').attr("content") || "";
  const main = $("main").html() || $("article").html() || $("body").html() || "";
  return { url: u.toString(), source: "html", title: title.trim(), company: site.trim(), location: "", text: htmlToText(main) };
}

/** Fetch a job posting's text from (almost) any job link. */
export async function fetchJobPosting(rawUrl: string): Promise<JobPosting> {
  const u = assertPublicUrl(rawUrl);
  for (const handler of [greenhouse, lever, ashby, workday, smartRecruiters]) {
    try {
      const r = await handler(u);
      if (r && r.text.length > 200) return { ...r, text: r.text.slice(0, 20000) };
    } catch {
      /* fall through to the next strategy */
    }
  }
  const g = await generic(u);
  if (g.text.length < 300) {
    throw new HttpError(
      422,
      "That page loads its job description with JavaScript, so it can't be read automatically. Paste the job description text instead.",
    );
  }
  return { ...g, text: g.text.slice(0, 20000) };
}
