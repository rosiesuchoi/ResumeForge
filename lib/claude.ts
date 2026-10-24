import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type * as z from "zod/v4";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }
  client ??= new Anthropic();
  return client;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Content = Anthropic.Messages.MessageParam["content"];

/**
 * Ask Claude for a JSON object matching `schema` (structured outputs).
 * Streams under the hood so long generations don't hit HTTP timeouts.
 */
export async function askStructured<S extends z.ZodType>(opts: {
  system: string;
  content: Content;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const stream = claude().messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: zodOutputFormat(opts.schema), ...(opts.effort ? { effort: opts.effort } : {}) },
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "max_tokens") throw new HttpError(502, "The AI response was cut off (too long). Try again.");
  if (msg.stop_reason === "refusal") throw new HttpError(422, "The AI declined to process this request.");
  const parsed = (msg as unknown as { parsed_output?: z.infer<S> | null }).parsed_output;
  if (!parsed) throw new HttpError(502, "The AI returned an unexpected response. Please try again.");
  return parsed;
}

/** Uniform JSON error response for route handlers. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  if (err instanceof Anthropic.APIError) {
    const msg =
      err.status === 401
        ? "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
        : err.status === 429
          ? "Rate limited by the AI provider. Wait a moment and retry."
          : `AI provider error (${err.status}): ${err.message}`;
    return Response.json({ error: msg }, { status: err.status && err.status >= 400 ? err.status : 502 });
  }
  console.error(err);
  return Response.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
}
