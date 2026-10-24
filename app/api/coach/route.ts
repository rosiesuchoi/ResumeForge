import { claude, errorResponse, HttpError, MODEL } from "@/lib/claude";
import { CHAT_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

type Msg = { role: "user" | "assistant"; content: string };

/** POST {messages, context} -> streamed plain-text reply */
export async function POST(req: Request) {
  try {
    const { messages, context } = (await req.json()) as { messages?: Msg[]; context?: string };
    if (!messages?.length || messages[messages.length - 1].role !== "user") {
      throw new HttpError(400, "Send at least one user message.");
    }
    const clean = messages.slice(-20).map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }));

    const stream = claude().messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system: `${CHAT_SYSTEM}\n\n<candidate_context>\n${(context ?? "").slice(0, 30000)}\n</candidate_context>`,
      messages: clean,
    });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        stream.on("text", (t) => controller.enqueue(enc.encode(t)));
        try {
          await stream.finalMessage();
        } catch (e) {
          controller.enqueue(enc.encode(`\n\n[Error: ${e instanceof Error ? e.message : "stream failed"}]`));
        }
        controller.close();
      },
      cancel() {
        stream.abort();
      },
    });
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
