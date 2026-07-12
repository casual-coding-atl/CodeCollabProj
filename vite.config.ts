import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: {
    port: 3000,
    // No proxy: the /api/* endpoints are served IN-PROCESS by TanStack Start
    // server routes (src/routes/api/**). The legacy Express server is retired.
  },
  resolve: {
    alias: {
      // Lift-and-shift bridge: legacy imports of react-router-dom resolve to the
      // TanStack Router compat shim. Remove per-file as components are deepened.
      'react-router-dom': fileURLToPath(
        new URL('./src/compat/react-router-shim.tsx', import.meta.url),
      ),
    },
  },
  // Bundle MUI/emotion into the SSR build. Externalized, their internal
  // directory imports (e.g. @mui/utils/formatMuiErrorMessage) break Node's ESM
  // loader (ERR_UNSUPPORTED_DIR_IMPORT) in the production server.
  ssr: {
    noExternal: [/@mui\//, /@emotion\//],
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
});
