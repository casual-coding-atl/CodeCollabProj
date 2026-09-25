import 'dotenv/config';

/**
 * Provider-agnostic LLM wrapper for the Agentic Evaluation Framework.
 *
 * Supports two providers, selected by which key is present in the environment:
 *   - Anthropic Claude  →  ANTHROPIC_API_KEY
 *   - OpenAI            →  OPENAI_API_KEY
 *
 * If both keys are set, Claude is preferred.
 * If neither is set, `llmRequest` returns `{ ok: false }` and callers return
 * a 503, exactly as before.
 *
 * The OpenAI path uses the Chat Completions API (`/v1/chat/completions`) with
 * a `system` message and a single `user` message — the same structure the
 * evaluation route already builds for Claude.
 */

// ── Anthropic constants ───────────────────────────────────────────────────────

export const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
export const ANTHROPIC_API_VERSION = '2023-06-01';
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ── OpenAI constants ──────────────────────────────────────────────────────────

export const OPENAI_API_BASE = 'https://api.openai.com';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const REQUEST_TIMEOUT_MS = 60_000;

// ── Shared types ──────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  /** Model override. Defaults to the provider's own default. */
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  messages: LLMMessage[];
}

export type LLMResult =
  | { ok: true; text: string; provider: 'claude' | 'openai' }
  | { ok: false; reason: string };

// ── Key detection ─────────────────────────────────────────────────────────────

export function claudeApiKey(env: { ANTHROPIC_API_KEY?: string } = process.env): string | null {
  return env.ANTHROPIC_API_KEY?.trim() || null;
}

export function openaiApiKey(env: { OPENAI_API_KEY?: string } = process.env): string | null {
  return env.OPENAI_API_KEY?.trim() || null;
}

/**
 * Returns which provider is active, or null if neither key is configured.
 * Claude takes priority when both keys are present.
 */
export function activeProvider(
  env: { ANTHROPIC_API_KEY?: string; OPENAI_API_KEY?: string } = process.env,
): 'claude' | 'openai' | null {
  if (claudeApiKey(env)) return 'claude';
  if (openaiApiKey(env)) return 'openai';
  return null;
}

// ── Anthropic request ─────────────────────────────────────────────────────────

async function callClaude(
  opts: LLMRequestOptions,
  deps: { apiKey: string; fetchImpl: typeof fetch; apiBase: string },
): Promise<LLMResult> {
  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    messages: opts.messages,
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;

  try {
    const response = await deps.fetchImpl(`${deps.apiBase}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': deps.apiKey,
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

    return { ok: true, text, provider: 'claude' };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ── OpenAI request ────────────────────────────────────────────────────────────

async function callOpenAI(
  opts: LLMRequestOptions,
  deps: { apiKey: string; fetchImpl: typeof fetch; apiBase: string },
): Promise<LLMResult> {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

  const body = {
    model: opts.model ?? DEFAULT_OPENAI_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    messages,
  };

  try {
    const response = await deps.fetchImpl(`${deps.apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deps.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, reason: `OpenAI API answered ${response.status}: ${text}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) return { ok: false, reason: 'OpenAI response contained no content' };

    return { ok: true, text, provider: 'openai' };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ── Unified entry point ───────────────────────────────────────────────────────

/**
 * Send a prompt to whichever LLM provider is configured.
 * Never throws — the caller must check `result.ok`.
 */
export async function llmRequest(
  opts: LLMRequestOptions,
  deps: {
    fetchImpl?: typeof fetch;
    /** Override Anthropic base URL (E2E fixture). */
    anthropicBase?: string;
    /** Override OpenAI base URL (E2E fixture). */
    openaiBase?: string;
  } = {},
): Promise<LLMResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const provider = activeProvider();

  if (provider === 'claude') {
    return callClaude(opts, {
      apiKey: claudeApiKey()!,
      fetchImpl,
      apiBase: deps.anthropicBase ?? (process.env.ANTHROPIC_API_BASE?.trim().replace(/\/+$/, '') || ANTHROPIC_API_BASE),
    });
  }

  if (provider === 'openai') {
    return callOpenAI(opts, {
      apiKey: openaiApiKey()!,
      fetchImpl,
      apiBase: deps.openaiBase ?? (process.env.OPENAI_API_BASE?.trim().replace(/\/+$/, '') || OPENAI_API_BASE),
    });
  }

  return { ok: false, reason: 'No LLM provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)' };
}
