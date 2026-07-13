import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(() => ({
  server: {
    port: 3000,
    // No proxy: the /api/* endpoints are served IN-PROCESS by TanStack Start
    // server routes (src/routes/api/**). The legacy Express server is retired.
  },
  resolve: {
    alias: {
      // shadcn/ui imports use the @ alias for src.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));
