# Resume parsing — provider config

Parsing **only pre-fills** the candidate's profile. The candidate must confirm the
employer list by hand (the fail-closed safety step), so the LLM is a convenience, not a
correctness dependency. This means you can run with **zero keys and zero cost**.

## How the provider is chosen (`src/lib/parse/provider.ts`)

Cheapest-first, from env:

1. **`PARSE_LLM_BASE_URL` + `PARSE_LLM_MODEL` set** → OpenAI-compatible client
   (`src/lib/parse/openai-compatible.ts`). Works with any compatible endpoint:
   - **Groq** (free tier): `https://api.groq.com/openai/v1`, model `llama-3.3-70b-versatile`
   - **Gemini Flash** (free tier): `https://generativelanguage.googleapis.com/v1beta/openai`, model `gemini-2.0-flash`
   - **OpenRouter / Together / DeepInfra**: their `/v1` base + a cheap model
   - **Local Ollama** ($0): `http://localhost:11434/v1`, model `qwen2.5`, no API key
     (note: Ollama can't run inside Vercel serverless — point at a box you run)
2. **`ANTHROPIC_API_KEY` set** (and no `PARSE_LLM_BASE_URL`) → Claude fallback. Costs more.
3. **Nothing set** → no parser. Onboarding routes to **manual employer entry** — $0, no keys.

Swapping providers is env-only; no code change. The `LLMClient` seam keeps the parse
orchestrator (`src/lib/parse/index.ts`) provider-agnostic and unit-tested with a fake.

## Quality

Resume employer-recall is a safety metric (a missed employer = exposure), gated at 0.9
on a labeled corpus (`src/lib/parse/recall.ts`). Run the recall eval against whichever
model you pick before relying on auto-fill; if recall is weak, the fail-closed manual
confirmation still protects candidates — they just do more typing.
