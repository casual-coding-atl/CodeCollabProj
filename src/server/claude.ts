import 'dotenv/config';

/**
 * Thin wrapper around the Anthropic Messages API — raw fetch, no SDK.
 * Mirrors the pattern in ./email.ts: decisions are pure and testable,
 * `claudeRequest` is the single outbound edge so tests substitute one fetchImpl.
 *
 * Env-gated the same way the email sender is: the helper returns null when
 * ANTHROPIC_API_KEY is absent, and callers decide what "unconfigured" means.
 */

export const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
export const ANTHROPIC_API_VERSION = '2023-06-01';
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const REQUEST_TIMEOUT_MS = 60_000;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  messages: ClaudeMessage[];
}

export type ClaudeResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/** Null unless ANTHROPIC_API_KEY is set — unconfigured, not an error. */
export function claudeApiKey(env: { ANTHROPIC_API_KEY?: string } = process.env): string | null {
  return env.ANTHROPIC_API_KEY?.trim() || null;
}

/**
 * Where `claudeRequest` sends messages. Always api.anthropic.com in real life;
 * `ANTHROPIC_API_BASE` overrides it so the E2E suite can point the server at a
 * local fixture and stay hermetic (no live Claude calls, no API spend).
 * Same pattern as `githubApiBase` in ./github.
 */
export function claudeApiBase(env: { ANTHROPIC_API_BASE?: string } = process.env): string {
  const base = env.ANTHROPIC_API_BASE?.trim().replace(/\/+$/, '');
  return base || ANTHROPIC_API_BASE;
}

/**
 * Send a request to the Anthropic Messages API.
 * Never throws: the caller must check `result.ok`.
 */
export async function claudeRequest(
  opts: ClaudeRequestOptions,
  deps: {
    apiKey?: string | null;
    fetchImpl?: typeof fetch;
    apiBase?: string;
  } = {}
): Promise<ClaudeResult> {
  const apiKey = deps.apiKey === undefined ? claudeApiKey() : deps.apiKey;
  if (!apiKey) return { ok: false, reason: 'no Anthropic API key configured' };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const apiBase = deps.apiBase ?? claudeApiBase();

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    messages: opts.messages,
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;

  try {
    const response = await fetchImpl(`${apiBase}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, reason: `Anthropic API answered ${response.status}: ${text}` };
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
    if (!text) return { ok: false, reason: 'Anthropic response contained no text block' };

    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
