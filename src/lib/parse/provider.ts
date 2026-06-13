import "server-only";
import type { LLMClient } from "./llm";
import { OpenAICompatibleLLMClient } from "./openai-compatible";

// Picks the resume-parse provider from env, cheapest-first:
//   1. PARSE_LLM_BASE_URL set  → OpenAI-compatible (Groq/Gemini/Ollama/...) — the default
//   2. ANTHROPIC_API_KEY set   → Claude (optional, lazily imported so the SDK isn't pulled
//                                in unless actually used)
//   3. nothing set             → null → onboarding routes to manual employer entry ($0)
//
// Parsing only pre-fills; the candidate confirms employers by hand regardless, so a null
// provider is a perfectly valid (zero-cost, zero-key) production configuration.
export async function getParseClient(): Promise<LLMClient | null> {
  if (process.env.PARSE_LLM_BASE_URL && process.env.PARSE_LLM_MODEL) {
    return new OpenAICompatibleLLMClient();
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const { AnthropicLLMClient } = await import("./anthropic");
    return new AnthropicLLMClient();
  }
  return null;
}
