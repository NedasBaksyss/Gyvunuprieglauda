import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database/index.js';
import { seedDatabase } from '../src/database/seed.js';
import { createUser } from '../src/auth.js';

// The check uses an isolated database; user accounts and uploaded files are untouched.
const database = openDatabase(':memory:');
seedDatabase(database);
const password = randomBytes(24).toString('base64url');
await createUser(database, { name: 'Patikra', email: 'verify@example.com', password, role: 'admin' });
const server = createApp({ database, clientDist: config.clientDist, secureCookies: false }).listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/gyvunai/1', '/gyvunai/1/uzklausa', '/prisijungti', '/admin', '/admin/uzklausos']) {
    const response = await fetch(base + route, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200, route);
    const html = await response.text(); assert.match(html, /id="root"/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) assert.equal((await fetch(base + asset[1])).status, 200);
  }
  const animal = (await (await fetch(`${base}/api/animals/1`)).json()).animal;
  assert.equal((await fetch(base + animal.photoUrl)).status, 200);
  assert.equal((await fetch(`${base}/api/admin/dashboard`)).status, 401);
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'shelter-app', Origin: base };
  const inquiry = await fetch(`${base}/api/inquiries`, { method: 'POST', headers,
    body: JSON.stringify({ animalId: 1, name: 'Patikra', email: 'verify@example.com', message: 'Norėčiau susipažinti su gyvūnu.' }) });
  assert.equal(inquiry.status, 201);
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'verify@example.com', password }) });
  assert.equal(login.status, 200);
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  const dashboard = await (await fetch(`${base}/api/admin/dashboard`, { headers })).json();
  assert.equal(dashboard.stats.animals, 4); assert.equal(dashboard.stats.newInquiries, 1);
  assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 204);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401);
  assert.equal((await fetch(`${base}/uploads/missing.webp`)).status, 404);
  console.log('Gamybinė HTTP patikra sėkminga: puslapiai, failai, užklausa, prisijungimas, apžvalga ir atsijungimas.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  database.close();
}
