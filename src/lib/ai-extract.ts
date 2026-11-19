/**
 * Best-effort JSON extraction via OpenAI.
 *
 * All callers must validate the returned value: model output is untrusted
 * input, never a trusted data source.
 */
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_TEXT_LENGTH = 20_000;

interface AiJsonOptions {
  system: string;
  text: string;
  modelEnv?: string;
  timeoutMs?: number;
}

interface AiResponse {
  choices?: { message?: { content?: string } }[];
}

/** Return parsed JSON, or null when AI is unavailable/misbehaving. */
export async function extractAiJson(options: AiJsonOptions): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = options.text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!apiKey || !text) return null;

  const model = (options.modelEnv && process.env[options.modelEnv]) || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.system },
          // Email/LMS text is data, not instructions; the system prompt above
          // defines the only output contract we accept.
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as AiResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
