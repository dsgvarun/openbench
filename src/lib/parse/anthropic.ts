import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "./llm";

// Anthropic-backed LLM client. Behind the LLMClient seam so the parse orchestrator
// stays provider-agnostic and unit-testable with a fake.
//
// Model: Sonnet 4.6 by default — resume employer-extraction recall is a SAFETY metric
// (a missed employer = exposure), so we favour quality over the cheapest model.
// Tune via OPENBENCH_PARSE_MODEL once the recall eval (Phase 6.1) has data.
const DEFAULT_MODEL = "claude-sonnet-4-6";

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor() {
    // TODO(key): set ANTHROPIC_API_KEY in .env.local before this path runs.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing — resume parsing unavailable.");
    this.client = new Anthropic({ apiKey });
    this.model = process.env.OPENBENCH_PARSE_MODEL ?? DEFAULT_MODEL;
  }

  async complete(input: { system: string; user: string }): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    // Concatenate text blocks; ignore any non-text content.
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
}
