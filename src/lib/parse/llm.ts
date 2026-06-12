// LLM client seam. The orchestrator depends on this interface, not on Anthropic
// directly, so the parse logic is testable with a fake and the provider is swappable.

export interface LLMClient {
  /** Returns the model's raw text output for a resume-parse prompt. */
  complete(input: { system: string; user: string }): Promise<string>;
}

/** Deterministic fake for tests and key-less local dev. */
export class FakeLLMClient implements LLMClient {
  constructor(private readonly response: string) {}
  async complete(): Promise<string> {
    return this.response;
  }
}
