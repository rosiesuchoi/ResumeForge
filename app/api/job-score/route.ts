import { errorResponse, HttpError } from "@/lib/claude";
import { fetchJobPosting } from "@/lib/jobFetch";
import { atsScore, weightsFromText } from "@/lib/keywords";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { url, resumeText } -> ATS keyword match % against the real posting.
 * Deterministic (no AI call), so it's fast and free to run on many jobs.
 */
export async function POST(req: Request) {
  try {
    const { url, resumeText } = (await req.json()) as { url?: string; resumeText?: string };
    if (!url || !resumeText) throw new HttpError(400, "url and resumeText are required.");
    const posting = await fetchJobPosting(url);
    const weights = weightsFromText(posting.text);
    if (weights.length < 3) throw new HttpError(422, "Couldn't find enough skills in that posting to score it.");
    const ats = atsScore(resumeText, weights);
    return Response.json({ ...ats, title: posting.title, source: posting.source });
  } catch (err) {
    return errorResponse(err);
  }
}
