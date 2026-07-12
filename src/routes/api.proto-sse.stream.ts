// ⚠️ PROTOTYPE — throwaway. Verifies SSE viability; delete after. See src/server/proto-sse.ts.
import { createFileRoute } from '@tanstack/react-router';
import { subscribe } from '../server/proto-sse';

export const Route = createFileRoute('/api/proto-sse/stream')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const user = new URL(request.url).searchParams.get('user') || 'anon';
        const encoder = new TextEncoder();
        let unsubscribe = () => {};
        let heartbeat: ReturnType<typeof setInterval>;

        const stream = new ReadableStream({
          start(controller) {
            const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
            send('retry: 3000\n\n');
            send(`data: ${JSON.stringify({ type: 'connected', user })}\n\n`);
            unsubscribe = subscribe(user, send);
            heartbeat = setInterval(() => send(': ping\n\n'), 20000);
          },
          cancel() {
            clearInterval(heartbeat);
            unsubscribe();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      },
    },
  },
});
