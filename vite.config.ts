import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
    // No proxy: the /api/* endpoints are served IN-PROCESS by TanStack Start
    // server routes (src/routes/api/**). The legacy Express server is retired.
  },
  resolve: {
    alias: {
      // shadcn/ui imports use the @ alias for src.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Lift-and-shift bridge: legacy imports of react-router-dom resolve to the
      // TanStack Router compat shim. Remove per-file as components are deepened.
      'react-router-dom': fileURLToPath(
        new URL('./src/compat/react-router-shim.tsx', import.meta.url),
      ),
    },
  },
  ssr: {
    // Bundle MUI/emotion into the SSR build ONLY for production: externalized,
    // their internal directory imports (e.g. @mui/utils/formatMuiErrorMessage)
    // break Node's ESM loader (ERR_UNSUPPORTED_DIR_IMPORT). In dev, leave them
    // externalized — Vite's dev module runner can't evaluate MUI's CJS if inlined.
    noExternal: command === 'build' ? [/@mui\//, /@emotion\//] : [],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));
