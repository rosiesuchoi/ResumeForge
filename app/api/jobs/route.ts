import { errorResponse } from "@/lib/claude";
import { BOARD_SOURCES, getBoardJobs } from "@/lib/jobsBoard";
import { extractTerms, quickFit } from "@/lib/keywords";
import type { ScoredBoardJob } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { resumeText?, days?=30, list?: "all"|"newgrad"|"intern", refresh? }
 * -> live SWE listings from SimplifyJobs, each with a quick estimated-fit score.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      resumeText?: string;
      days?: number;
      list?: "all" | "newgrad" | "intern";
      refresh?: boolean;
    };
    const days = Math.min(Math.max(Number(body.days) || 30, 1), 180);
    const { jobs, at, errors } = await getBoardJobs(!!body.refresh);
    const cutoff = Date.now() / 1000 - days * 86400;

    const resumeText = body.resumeText ?? "";
    const terms = new Set(extractTerms(resumeText));
    const hasPhd = /\b(ph\.?d|doctor of philosophy)\b/i.test(resumeText);

    const out: ScoredBoardJob[] = jobs
      .filter((j) => j.datePosted >= cutoff && (body.list === undefined || body.list === "all" || j.list === body.list))
      .map((j) => {
        const f = resumeText
          ? quickFit(j.title, j.category, j.degrees, terms, hasPhd)
          : { fit: 0, matched: [], missing: [] };
        return { ...j, fit: f.fit, fitMatched: f.matched, fitMissing: f.missing };
      });

    return Response.json({ jobs: out, fetchedAt: at, sources: BOARD_SOURCES, errors });
  } catch (err) {
    return errorResponse(err);
  }
}
