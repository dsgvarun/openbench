import type { LLMClient } from "./llm";

// Provider-agnostic LLM client over the OpenAI Chat Completions wire format. Works with
// any compatible endpoint — Groq (free tier), Gemini (OpenAI-compat), OpenRouter,
// Together, DeepInfra, or a local Ollama (/v1) — so resume parsing costs ~nothing and
// the provider is swapped with env vars, no code change. No SDK → no outdated-API risk.
//
// Env:
//   PARSE_LLM_BASE_URL  e.g. https://api.groq.com/openai/v1  |  http://localhost:11434/v1
//   PARSE_LLM_MODEL     e.g. llama-3.3-70b-versatile  |  qwen2.5  |  gemini-2.0-flash
//   PARSE_LLM_API_KEY   provider key (omit/empty for local Ollama)
export class OpenAICompatibleLLMClient implements LLMClient {
  constructor(
    private baseUrl = process.env.PARSE_LLM_BASE_URL ?? "",
    private model = process.env.PARSE_LLM_MODEL ?? "",
    private apiKey = process.env.PARSE_LLM_API_KEY ?? "",
  ) {
    if (!this.baseUrl || !this.model) {
      throw new Error("PARSE_LLM_BASE_URL and PARSE_LLM_MODEL required for the OpenAI-compatible parser.");
    }
  }

  async complete(input: { system: string; user: string }): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });

    if (!res.ok) throw new Error(`parse LLM ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
