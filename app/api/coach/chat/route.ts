import { askStructured, errorResponse, HttpError } from "@/lib/claude";
import { CHAT_SYSTEM } from "@/lib/prompts";
import { indexedResumeText, listLines } from "@/lib/resumeRefs";
import { ChatReplySchema, ResumeSchema, type ChatResponse } from "@/lib/types";
import * as z from "zod/v4";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
  context: z.string().optional(),
  resume: ResumeSchema,
});

const MAX_EDITS = 6;

/** POST {messages, context?, resume} -> {reply, edits}. The browser applies `edits` to the resume. */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Send a message and your resume.");
    const { messages, context, resume } = parsed.data;
    if (messages[messages.length - 1].role !== "user") throw new HttpError(400, "Send at least one user message.");

    // The API wants the history to open with a user turn.
    const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    while (history.length > 1 && history[0].role !== "user") history.shift();

    const result = await askStructured({
      system: `${CHAT_SYSTEM}\n\n<candidate_context>\n${(context ?? "").slice(0, 8000)}\n</candidate_context>\n\n<resume>\n${indexedResumeText(resume)}\n</resume>`,
      messages: history,
      schema: ChatReplySchema,
      maxTokens: 4000,
      effort: "medium",
    });

    // Never trust the model's ids or text: keep real, distinct, actually-changed lines only.
    const lines = new Map(listLines(resume).map((l) => [l.id, l]));
    const seen = new Set<string>();
    const edits: ChatResponse["edits"] = [];
    for (const e of result.edits) {
      const line = lines.get(e.id);
      const after = e.after.trim().slice(0, 500);
      if (!line || seen.has(e.id) || !after || after === line.text) continue;
      seen.add(e.id);
      edits.push({ id: e.id, section: line.section, before: line.text, after, reason: e.reason });
      if (edits.length >= MAX_EDITS) break;
    }
    return Response.json({ reply: result.reply, edits } satisfies ChatResponse);
  } catch (err) {
    return errorResponse(err);
  }
}
