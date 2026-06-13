import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAICompatibleLLMClient } from "./openai-compatible";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAICompatibleLLMClient", () => {
  it("requires base URL + model", () => {
    expect(() => new OpenAICompatibleLLMClient("", "", "")).toThrow();
  });

  it("posts chat-completions and returns the message content", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"name":"A","employers":[],"skills":["x"],"confidence":0.9}' } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = new OpenAICompatibleLLMClient("https://api.groq.com/openai/v1/", "llama-3.3-70b", "key123");
    const out = await client.complete({ system: "sys", user: "usr" });

    expect(out).toContain('"name":"A"');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions"); // trailing slash trimmed
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("llama-3.3-70b");
    expect(body.temperature).toBe(0);
    expect(body.messages).toHaveLength(2);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key123");
  });

  it("omits Authorization when no key (local Ollama)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const client = new OpenAICompatibleLLMClient("http://localhost:11434/v1", "qwen2.5", "");
    await client.complete({ system: "s", user: "u" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws on non-ok (→ orchestrator routes to manual entry)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch);
    const client = new OpenAICompatibleLLMClient("https://x/v1", "m", "k");
    await expect(client.complete({ system: "s", user: "u" })).rejects.toThrow();
  });
});
