import { askStructured, errorResponse, HttpError } from "@/lib/claude";
import { readPdf } from "@/lib/pdf";
import { PARSE_SYSTEM } from "@/lib/prompts";
import { ResumeSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

/** POST multipart {file: PDF} or JSON {text} -> { resume, rawText } */
export async function POST(req: Request) {
  try {
    const type = req.headers.get("content-type") ?? "";
    let rawText = "";
    let links: string[] = [];
    let pdfBase64: string | null = null;

    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "No file uploaded.");
      if (file.size > MAX_BYTES) throw new HttpError(413, "PDF is larger than 5 MB.");
      const buf = await file.arrayBuffer();
      const head = new TextDecoder().decode(buf.slice(0, 5));
      if (head !== "%PDF-") throw new HttpError(400, "That file isn't a PDF.");
      const pdf = await readPdf(buf.slice(0));
      rawText = pdf.text;
      links = pdf.links;
      pdfBase64 = Buffer.from(buf).toString("base64");
    } else {
      const body = (await req.json()) as { text?: string };
      rawText = (body.text ?? "").trim();
      if (rawText.length < 100) throw new HttpError(400, "Paste the full resume text (at least a few lines).");
    }

    const resume = await askStructured({
      system: PARSE_SYSTEM,
      schema: ResumeSchema,
      maxTokens: 8000,
      content: [
        ...(pdfBase64
          ? [{ type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdfBase64 } }]
          : []),
        {
          type: "text" as const,
          text: [
            "Convert this resume to the JSON schema.",
            links.length ? `Hyperlinks found in the PDF:\n${links.join("\n")}` : "",
            `Extracted text (may have layout artifacts):\n<resume_text>\n${rawText.slice(0, 30000)}\n</resume_text>`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    return Response.json({ resume, rawText });
  } catch (err) {
    return errorResponse(err);
  }
}
