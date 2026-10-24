import { askStructured, errorResponse, HttpError } from "@/lib/claude";
import { fetchJobPosting } from "@/lib/jobFetch";
import { JOB_SYSTEM } from "@/lib/prompts";
import { JobAnalysisSchema, type JobPosting } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

/** POST {url?, text?} -> { posting, analysis } */
export async function POST(req: Request) {
  try {
    const { url, text } = (await req.json()) as { url?: string; text?: string };
    let posting: JobPosting;
    if (text && text.trim().length > 150) {
      posting = { url: url ?? "", source: "pasted", title: "", company: "", location: "", text: text.trim().slice(0, 20000) };
    } else if (url) {
      posting = await fetchJobPosting(url);
    } else {
      throw new HttpError(400, "Provide a job link or paste the job description.");
    }

    const analysis = await askStructured({
      system: JOB_SYSTEM,
      schema: JobAnalysisSchema,
      maxTokens: 3000,
      content: [
        {
          type: "text",
          text: [
            posting.url ? `URL: ${posting.url}` : "",
            posting.title ? `Title (from page): ${posting.title}` : "",
            posting.company ? `Company (from page): ${posting.company}` : "",
            posting.location ? `Location (from page): ${posting.location}` : "",
            `<job_posting>\n${posting.text}\n</job_posting>`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    return Response.json({ posting: { ...posting, text: posting.text.slice(0, 8000) }, analysis });
  } catch (err) {
    return errorResponse(err);
  }
}
