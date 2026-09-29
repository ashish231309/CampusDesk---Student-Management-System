import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 0.0.0.0 keeps the dev server reachable from containers and preview hosts.
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // The dev server is reached through container/preview proxies whose host
      // names are not known in advance, so Vite's host allowlist is disabled.
      // This applies to the dev server only — never to a build.
      allowedHosts: true,
      // Proxy API calls so the browser only ever talks to the Vite origin.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
