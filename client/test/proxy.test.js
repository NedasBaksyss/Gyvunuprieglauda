import { expect, test } from 'vitest';
import { createServer, loadConfigFromFile } from 'vite';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createApp } from '../../server/src/app.js';
import { createUser } from '../../server/src/auth.js';
import { openDatabase } from '../../server/src/database/index.js';

test('Prisijungimas per tikrą Vite proxy išlaiko Origin ir Host atitikimą', async () => {
  const database = openDatabase(':memory:');
  let backend;
  let frontend;
  try {
    const password = 'Testinis-slaptazodis-2026';
    await createUser(database, { name: 'Admin', email: 'proxy@example.com', password, role: 'admin' });
    backend = createApp({ database, secureCookies: false }).listen(0, '127.0.0.1');
    await once(backend, 'listening');
    const target = `http://127.0.0.1:${backend.address().port}`;
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, fileURLToPath(new URL('../vite.config.js', import.meta.url)));
    const proxy = Object.fromEntries(Object.entries(loaded.config.server.proxy).map(([prefix, rule]) => [prefix,
      typeof rule === 'string' ? target : { ...rule, target },
    ]));
    frontend = await createServer({ ...loaded.config, configFile: false, root: fileURLToPath(new URL('../', import.meta.url)),
      logLevel: 'silent', server: { ...loaded.config.server, port: 0, strictPort: false, watch: null, hmr: false, proxy } });
    await frontend.listen();
    const port = frontend.httpServer.address().port;
    for (const host of ['localhost', '127.0.0.1']) {
      const origin = `http://${host}:${port}`;
      const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-Requested-With': 'shelter-app', 'Sec-Fetch-Site': 'same-origin' };
      const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'proxy@example.com', password }) });
      expect(login.status, `${origin}: ${JSON.stringify(await login.json())}`).toBe(200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
      expect(me.status).toBe(200);
      expect((await me.json()).user.email).toBe('proxy@example.com');
      const foreign = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: cookie, Origin: 'https://foreign.example' } });
      expect(foreign.status).toBe(403);
      const logout = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: cookie } });
      expect(logout.status).toBe(204);
    }
  } finally {
    await frontend?.close();
    if (backend) await new Promise((resolve) => backend.close(resolve));
    database.close();
  }
}, 20000);
