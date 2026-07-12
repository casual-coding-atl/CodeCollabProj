// Production entry: serve the built client assets statically and forward
// everything else (SSR pages + /api/* routes) to the TanStack Start fetch
// handler. Used by `npm start` (the host sets PORT).
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import ssr from './dist/server/server.js';

const app = new Hono();

// Hashed client bundles + CSS.
app.use('/assets/*', serveStatic({ root: './dist/client' }));
// Public files copied to the client build root (e.g. /CC-Logo-ColorBg.png).
// serveStatic calls next() when the path isn't a file, so real routes fall
// through to SSR below.
app.use('/*', serveStatic({ root: './dist/client' }));

// SSR pages + in-process API.
app.all('/*', (c) => ssr.fetch(c.req.raw));

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[web] listening on http://0.0.0.0:${info.port}`);
});
