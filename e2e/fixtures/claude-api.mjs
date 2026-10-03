// A stand-in for api.anthropic.com, so the E2E suite never spends real credits.
//
// The app's Claude wrapper (src/server/claude.ts) reads ANTHROPIC_API_BASE at
// request time; playwright.config.ts points it here for the whole suite.
// This lets the evaluation E2E tests assert structured findings — including the
// Reality Check — without any live network calls or API keys.
//
// The fixture returns a deterministic JSON evaluation that always includes a
// "Reality Check" finding when the request body contains evidence sections
// (detected by the presence of "## Repository Evidence" in the user message).
// When no evidence is present it returns the six standard findings only.
import { createServer } from 'node:http';

const PORT = Number(process.env.CLAUDE_FIXTURE_PORT) || 3198;
const HOST = '127.0.0.1';

const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

/** The six standard dimension findings every evaluation returns. */
const STANDARD_FINDINGS = [
  {
    dimension: 'Clarity of Intent',
    assessment: 'The problem statement is clear and well-articulated.',
    suggestion: 'Add a one-sentence mission statement at the top.',
  },
  {
    dimension: 'Scope & Prioritisation Realism',
    assessment: 'The MVP scope is reasonable for the stated timeline.',
  },
  {
    dimension: 'User Need Validation',
    assessment: 'Some evidence of user need, but more validation recommended.',
    suggestion: 'Talk to five potential users before building.',
  },
  {
    dimension: 'Feasibility Assessment',
    assessment: 'The technical approach is feasible with the stated stack.',
  },
  {
    dimension: 'Completeness of Vision',
    assessment: 'Success metrics are present but could be more specific.',
    suggestion: 'Define at least one quantitative metric.',
  },
  {
    dimension: 'Differentiation',
    assessment: 'The angle is reasonable but competitive landscape is not addressed.',
  },
];

/** The Reality Check finding, only included when repository evidence is present. */
const REALITY_CHECK_FINDING = {
  dimension: 'Reality Check',
  assessment:
    'The repository e2e-org/codecollab-web confirms several claims from the README: ' +
    'the TypeScript stack matches, and collaboration/evaluation features are present in the file tree. ' +
    'No major gaps detected between the pitch and the evidence.',
  suggestion: 'Keep the README in sync with the repository as the project evolves.',
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  if (pathname === '/healthz') return send(res, 200, { ok: true });

  if (pathname === '/v1/messages' && req.method === 'POST') {
    // Read the request body to detect whether evidence was injected.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    const userMessage =
      body.messages?.find((m) => m.role === 'user')?.content ?? '';
    const hasEvidence = userMessage.includes('## Repository Evidence');

    const findings = hasEvidence
      ? [...STANDARD_FINDINGS, REALITY_CHECK_FINDING]
      : STANDARD_FINDINGS;

    const evaluation = {
      summary:
        'This is a fixture evaluation returned by the E2E Claude stub. ' +
        'It exercises the full evaluation pipeline without live API calls.',
      findings,
      actionItems: [
        'Validate the idea with real users.',
        'Define quantitative success metrics.',
        'Set up a CI pipeline early.',
      ],
      readinessScore: 3,
    };

    return send(res, 200, {
      id: 'e2e-msg-fixture',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify(evaluation) }],
      model: 'claude-haiku-fixture',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 200 },
    });
  }

  return send(res, 404, { error: { message: 'Not Found' } });
});

server.on('error', (err) => {
  const detail = err.code === 'EADDRINUSE' ? ` — ${HOST}:${PORT} is already in use` : '';
  console.error(`[e2e] the Claude API fixture could not start${detail}: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[e2e] Claude API fixture listening on http://${HOST}:${PORT}`);
});
