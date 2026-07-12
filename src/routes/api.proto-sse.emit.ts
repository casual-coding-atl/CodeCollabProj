// ⚠️ PROTOTYPE — throwaway. Verifies SSE viability; delete after. See src/server/proto-sse.ts.
import { createFileRoute } from '@tanstack/react-router';
import { emit, stats } from '../server/proto-sse';

export const Route = createFileRoute('/api/proto-sse/emit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { user?: string; message?: string };
        const user = body.user || 'anon';
        const delivered = emit(user, {
          type: 'test',
          message: body.message || 'hello',
          at: new Date().toISOString(),
        });
        return new Response(JSON.stringify({ delivered, stats: stats() }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
