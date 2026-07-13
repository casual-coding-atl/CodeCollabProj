import { createFileRoute } from '@tanstack/react-router';
import { getAuthUser, error } from '../server/http';
import { subscribe } from '../server/notifications';

/**
 * GET /api/notifications/stream — authenticated Server-Sent Events endpoint.
 * Holds a long-lived text/event-stream connection; createNotification() pushes
 * new notifications to it via the subscriber registry. A heartbeat keeps the
 * connection alive; disconnect runs cancel() → unsubscribe (no leaked connections).
 *
 * Viability of this exact shape was proven by the proto/notifications-sse spike.
 */
export const Route = createFileRoute('/api/notifications/stream')({
  server: {
    handlers: {
      // Deliberately not wrapped in handler() (the convention for JSON routes):
      // this returns a long-lived streaming Response, so once the stream is open a
      // thrown error can't be turned into a JSON body. Auth is done up front via
      // getAuthUser + a manual 401 instead of requireUser's throw-a-Response.
      GET: async ({ request }) => {
        const user = await getAuthUser(request).catch(() => null);
        if (!user) return error(401, 'Not authenticated');
        const userId = String(user._id);

        const encoder = new TextEncoder();
        let unsubscribe = () => {};
        let heartbeat: ReturnType<typeof setInterval>;

        const stream = new ReadableStream({
          start(controller) {
            const send = (chunk: string) => {
              try {
                controller.enqueue(encoder.encode(chunk));
              } catch {
                // controller closed; the cancel() path will clean up.
              }
            };
            send('retry: 3000\n\n');
            send(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
            unsubscribe = subscribe(userId, send);
            heartbeat = setInterval(() => send(': ping\n\n'), 25000);
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
