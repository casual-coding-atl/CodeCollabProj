// Production entry: serve the built TanStack Start fetch handler on a Node port.
// The vite build emits `dist/server/server.js` exporting a Web `fetch` handler;
// @hono/node-server adapts it to a Node HTTP listener. Used by `npm start`
// (Railway sets PORT).
import { serve } from '@hono/node-server';
import handler from './dist/server/server.js';

const port = Number(process.env.PORT) || 3000;
serve({ fetch: handler.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[web] listening on http://0.0.0.0:${info.port}`);
});
