import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDirectory, '');
  const apiPort = process.env.PORT || env.PORT || '3001';
  const apiHost = process.env.HOST || env.HOST || '127.0.0.1';

  return {
    plugins: [react()],
    test: {
      // Testuose naudojamas jsdom localStorage, o ne Node.js failinis variantas.
      execArgv: ['--no-experimental-webstorage'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': `http://${apiHost}:${apiPort}`,
        '/uploads': `http://${apiHost}:${apiPort}`,
      },
    },
  };
});
