import { askStructured, errorResponse, HttpError } from "@/lib/claude";
import { COACH_SYSTEM } from "@/lib/prompts";
import { indexedResumeText, listLines } from "@/lib/resumeRefs";
import { CoachReportSchema, JobAnalysisSchema, ResumeSchema, type CoachReportView } from "@/lib/types";
import * as z from "zod/v4";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  resume: ResumeSchema,
  job: JobAnalysisSchema.nullable().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  missingKeywords: z.array(z.string()).optional(),
});

/** POST {resume, job?, company?, role?, missingKeywords?} -> CoachReportView */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Upload a resume first.");
    const { resume, job, company, role, missingKeywords } = parsed.data;
    const targetCompany = company || job?.company || "";
    const targetRole = role || job?.title || "Software Engineer (new grad / intern)";

    const report = await askStructured({
      system: COACH_SYSTEM,
      schema: CoachReportSchema,
      maxTokens: 8000,
      content: [
        {
          type: "text",
          text: `Target company: ${targetCompany || "(not specified - give general big-tech prep)"}
Target role: ${targetRole}
${job ? `<target_job>\n${JSON.stringify(job, null, 2)}\n</target_job>` : ""}
${missingKeywords?.length ? `ATS keywords the resume is missing: ${missingKeywords.join(", ")}` : ""}

<resume>
${indexedResumeText(resume)}
</resume>

Give your coaching report.`,
        },
      ],
    });

    // Keep only highlights that point at a real line, once per line, and snapshot the
    // line's text so the browser can drop the mark after that line is edited.
    const lines = new Map(listLines(resume).map((l) => [l.id, l.text]));
    const seen = new Set<string>();
    const highlights: CoachReportView["highlights"] = [];
    for (const h of report.highlights) {
      const text = lines.get(h.id);
      if (text === undefined || seen.has(h.id)) continue;
      seen.add(h.id);
      highlights.push({ ...h, text });
    }
    return Response.json({ ...report, highlights } satisfies CoachReportView);
  } catch (err) {
    return errorResponse(err);
  }
}
