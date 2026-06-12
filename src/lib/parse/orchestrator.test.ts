import { describe, it, expect } from "vitest";
import { parseResume } from "./index";
import { FakeLLMClient, type LLMClient } from "./llm";

const goodJson = JSON.stringify({
  name: "Asha Rao",
  skills: ["pm"],
  employers: [{ name: "CurrentCo", is_current: true }],
  confidence: 0.9,
});

class ThrowingClient implements LLMClient {
  async complete(): Promise<string> {
    throw new Error("upstream 503");
  }
}

describe("parseResume orchestrator", () => {
  it("returns no_text_extracted for empty text without calling the model", async () => {
    const r = await parseResume("", new FakeLLMClient(goodJson));
    expect(r).toEqual({ ok: false, reason: "no_text_extracted" });
  });

  it("parses a real text resume through the contract", async () => {
    const r = await parseResume("Asha Rao — Senior PM ...", new FakeLLMClient(goodJson));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resume.employers[0].name).toBe("CurrentCo");
  });

  it("propagates a model refusal as a typed failure", async () => {
    const r = await parseResume("text", new FakeLLMClient("I'm sorry, I cannot do that."));
    expect(r).toEqual({ ok: false, reason: "refusal" });
  });

  it("fails closed (no throw) when the LLM call errors", async () => {
    const r = await parseResume("text", new ThrowingClient());
    expect(r.ok).toBe(false);
  });
});
