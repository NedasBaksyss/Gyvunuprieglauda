import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createAuth, createUser } from '../src/auth.js';
import { openDatabase } from '../src/database/index.js';

const password = 'Testinis-slaptazodis-2026';
async function setup(context, options = {}) {
  const database = openDatabase(':memory:');
  await createUser(database, { name: 'Admin', email: 'admin@example.com', password, role: 'admin' });
  const server = createApp({ database, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (body = { email: 'admin@example.com', password }, cookie = '') => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'shelter-app', Cookie: cookie }, body: JSON.stringify(body),
  });
  return { database, base, login };
}
const cookieFrom = (response) => response.headers.get('set-cookie').split(';')[0];

test('Prisijungimas saugo tik sesijos maišą, atkuria vartotoją ir atsijungimas panaikina sesiją', async (context) => {
  const { database, base, login } = await setup(context);
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
  const response = await login({ email: ' ADMIN@example.com ', password });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(Object.keys(data.user).sort(), ['email', 'id', 'name', 'role']);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  const cookie = cookieFrom(response);
  assert.ok(!database.prepare('SELECT token_hash FROM sessions').get().token_hash.includes(cookie.split('=')[1]));
  assert.notEqual(database.prepare('SELECT password_hash FROM users').get().password_hash, password);
  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.deepEqual(await me.json(), data);
  assert.equal(me.headers.get('cache-control'), 'no-store');
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'X-Requested-With': 'shelter-app' } });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal(database.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});

test('Slaptažodžio klaida, neegzistuojanti ir neaktyvi paskyra grąžina tą pačią klaidą', async (context) => {
  const { database, login } = await setup(context);
  const wrong = await login({ email: 'admin@example.com', password: 'neteisingas' });
  const absent = await login({ email: 'missing@example.com', password });
  database.prepare('UPDATE users SET is_active = 0').run();
  const inactive = await login();
  assert.equal(wrong.status, 401); assert.equal(absent.status, 401); assert.equal(inactive.status, 401);
  assert.deepEqual(await wrong.json(), await absent.json());
  assert.deepEqual(await inactive.json(), { message: 'Neteisingas el. paštas arba slaptažodis.' });
});

test('Sesija keičiama prisijungus ir iškart reaguoja į rolę, išjungimą bei galiojimą', async (context) => {
  const { database, base, login } = await setup(context);
  const oldCookie = cookieFrom(await login());
  const newCookie = cookieFrom(await login(undefined, oldCookie));
  assert.notEqual(oldCookie, newCookie);
  const me = (cookie) => fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await me(oldCookie)).status, 401);
  database.prepare("UPDATE users SET role = 'employee'").run();
  assert.equal((await (await me(newCookie)).json()).user.role, 'employee');
  database.prepare('UPDATE sessions SET expires_at = 0').run();
  assert.equal((await me(newCookie)).status, 401);
  const activeCookie = cookieFrom(await login());
  database.prepare('UPDATE users SET is_active = 0').run();
  assert.equal((await me(activeCookie)).status, 401);
});

test('CSRF apsauga ir serverio rolės neleidžia neautorizuotų veiksmų', async (context) => {
  const { database, base } = await setup(context);
  for (const headers of [{}, { 'X-Requested-With': 'shelter-app', Origin: 'https://foreign.example' }, { 'X-Requested-With': 'shelter-app', 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 403);
  }
  const auth = createAuth(database);
  assert.throws(() => auth.requireRole('admin')({ user: null }, {}, () => {}), { status: 401 });
  assert.throws(() => auth.requireRole('admin')({ user: { role: 'employee' } }, {}, () => {}), { status: 403 });
  let allowed = false;
  auth.requireRole('admin')({ user: { role: 'admin' } }, {}, () => { allowed = true; });
  assert.ok(allowed);
});

test('Bandymų ribojimas ir Secure slapukas', async (context) => {
  const { login } = await setup(context, { secureCookies: true });
  assert.match((await login()).headers.get('set-cookie'), /; Secure/);
  for (let index = 0; index < 10; index++) assert.equal((await login({ email: 'invalid' })).status, 400);
  const limited = await login();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
