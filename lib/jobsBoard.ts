import type { BoardJob } from "./types";

/**
 * Live listings from SimplifyJobs' community-maintained GitHub repos.
 * Each repo publishes the data behind its README at .github/scripts/listings.json.
 */
const SOURCES: { list: BoardJob["list"]; repo: string }[] = [
  { list: "newgrad", repo: "SimplifyJobs/New-Grad-Positions" },
  { list: "intern", repo: process.env.INTERNSHIP_REPO || "SimplifyJobs/Summer2027-Internships" },
];

type RawListing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations?: string[];
  category?: string;
  active?: boolean;
  is_visible?: boolean;
  date_posted?: number;
  sponsorship?: string;
  degrees?: string[];
  terms?: string[];
};

const TTL_MS = 30 * 60 * 1000;
let cache: { at: number; jobs: BoardJob[]; errors: string[] } | null = null;
let inflight: Promise<{ at: number; jobs: BoardJob[]; errors: string[] }> | null = null;

const SWE_TITLE = /\b(software|developer|swe|sde|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web|platform|infrastructure|devops|site reliability|sre|cloud|application|programmer|embedded software|firmware|engineer(ing)?\s+(i|1)\b)/i;
const NOT_SWE = /\b(mechanical|electrical engineer|civil|chemical|hardware design|analog|rf engineer|manufacturing|technician|sales|recruit|marketing|product manager|designer|accountant|finance analyst|business analyst)\b/i;

function isSweRole(l: RawListing): boolean {
  const cat = (l.category ?? "").toLowerCase();
  if (cat.startsWith("software")) return !NOT_SWE.test(l.title);
  return SWE_TITLE.test(l.title) && !NOT_SWE.test(l.title);
}

async function loadOne(src: (typeof SOURCES)[number]): Promise<BoardJob[]> {
  const url = `https://raw.githubusercontent.com/${src.repo}/dev/.github/scripts/listings.json`;
  // These files are ~13MB, larger than Next's data cache allows, so cache in memory instead.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${src.repo}: HTTP ${res.status}`);
  const raw = (await res.json()) as RawListing[];
  return raw
    .filter((l) => l.active !== false && l.is_visible !== false && l.url && isSweRole(l))
    .map((l) => ({
      id: `${src.list}:${l.id}`,
      list: src.list,
      company: l.company_name,
      title: l.title,
      url: l.url,
      locations: l.locations ?? [],
      category: l.category ?? "",
      datePosted: l.date_posted ?? 0,
      sponsorship: l.sponsorship ?? "",
      degrees: l.degrees ?? [],
      terms: l.terms,
    }));
}

export async function getBoardJobs(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache;
  inflight ??= (async () => {
    const results = await Promise.allSettled(SOURCES.map(loadOne));
    const jobs: BoardJob[] = [];
    const errors: string[] = [];
    results.forEach((r) => (r.status === "fulfilled" ? jobs.push(...r.value) : errors.push(String(r.reason))));
    jobs.sort((a, b) => b.datePosted - a.datePosted);
    const out = { at: Date.now(), jobs, errors };
    if (jobs.length) cache = out;
    return out;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export const BOARD_SOURCES = SOURCES.map((s) => ({ list: s.list, repo: s.repo, url: `https://github.com/${s.repo}` }));
