import { askStructured, errorResponse, HttpError } from "@/lib/claude";
import { atsScore, weightsFromAnalysis } from "@/lib/keywords";
import { resumeToText } from "@/lib/latex";
import { TAILOR_SYSTEM } from "@/lib/prompts";
import { JobAnalysisSchema, ResumeSchema, TailorResultSchema } from "@/lib/types";
import * as z from "zod/v4";

export const runtime = "nodejs";
export const maxDuration = 180;

const Body = z.object({ resume: ResumeSchema, job: JobAnalysisSchema, jobText: z.string().optional() });

/** POST {resume, job, jobText?} -> TailorResult + ATS before/after */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Upload a resume and analyze a job first.");
    const { resume, job, jobText } = parsed.data;

    const weights = weightsFromAnalysis(job);
    const before = atsScore(resumeToText(resume), weights);

    const result = await askStructured({
      system: TAILOR_SYSTEM,
      schema: TailorResultSchema,
      maxTokens: 16000,
      content: [
        {
          type: "text",
          text: `<target_job>
${JSON.stringify(job, null, 2)}
</target_job>
${jobText ? `<job_posting_text>\n${jobText.slice(0, 8000)}\n</job_posting_text>\n` : ""}
<ats_check>
Keywords already matched: ${before.matched.join(", ") || "none"}
Keywords currently missing (add ONLY where truthful): ${before.missing.join(", ") || "none"}
</ats_check>

<candidate_resume>
${JSON.stringify(resume, null, 2)}
</candidate_resume>

Tailor this resume for the target job following all rules. Rewrite every experience/project/leadership bullet in Google XYZ form.`,
        },
      ],
    });

    const after = atsScore(resumeToText(result.resume), weights);
    return Response.json({ ...result, ats: { before, after } });
  } catch (err) {
    return errorResponse(err);
  }
}
