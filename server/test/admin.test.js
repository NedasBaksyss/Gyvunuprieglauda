import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { createUser } from '../src/auth.js';
import { openDatabase } from '../src/database/index.js';

const password = 'Testinis-slaptazodis-2026';
async function setup(context, options = {}) {
  const database = openDatabase(':memory:');
  for (const role of ['admin', 'employee']) await createUser(database, { name: role, email: `${role}@example.com`, password, role });
  database.prepare('INSERT INTO species (name) VALUES (?)').run('Šuo');
  const server = createApp({ database, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};
  for (const role of ['admin', 'employee']) {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'shelter-app' }, body: JSON.stringify({ email: `${role}@example.com`, password }) });
    assert.equal(response.status, 200);
    cookies[role] = response.headers.get('set-cookie').split(';')[0];
  }
  const request = (role, path, method = 'GET', body) => fetch(base + path, { method,
    headers: { Cookie: cookies[role] || '', 'X-Requested-With': 'shelter-app', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { database, request, base, cookies };
}
const animalInput = { name: 'Tobis', speciesId: 1, ageMonths: 18, size: 'medium', status: 'available', description: 'Draugiškas ir smalsus šuo.' };

test('Gyvūnų CRUD leidžiamas darbuotojui, pakeitimai matomi viešai, susiję įrašai saugomi', async (context) => {
  const { request, database } = await setup(context);
  assert.equal((await request('guest', '/api/admin/animals')).status, 401);
  assert.equal((await request('guest', '/api/admin/animals', 'POST', animalInput)).status, 401);
  const created = await request('employee', '/api/admin/animals', 'POST', animalInput);
  assert.equal(created.status, 201);
  const { animal } = await created.json();
  assert.equal(animal.name, 'Tobis');
  const updated = await request('admin', `/api/admin/animals/${animal.id}`, 'PUT', { ...animalInput, name: 'Tobis II', status: 'reserved' });
  assert.equal(updated.status, 200);
  assert.equal((await (await request('guest', `/api/animals/${animal.id}`)).json()).animal.status, 'reserved');
  for (const body of [{ ...animalInput, speciesId: 999 }, { ...animalInput, ageMonths: -1 }, { ...animalInput, ageMonths: 1.5 }, { ...animalInput, name: ' ' }, { ...animalInput, status: 'unknown' }, { ...animalInput, photoUrl: '/bad' }]) {
    assert.equal((await request('employee', '/api/admin/animals', 'POST', body)).status, 400);
  }
  database.prepare('INSERT INTO inquiries (animal_id, name, email, message) VALUES (?, ?, ?, ?)').run(animal.id, 'Jonas', 'jonas@example.com', 'Noriu priglausti.');
  assert.equal((await request('admin', `/api/admin/animals/${animal.id}`, 'DELETE')).status, 409);
  database.prepare('DELETE FROM inquiries').run();
  assert.equal((await request('employee', `/api/admin/animals/${animal.id}`, 'DELETE')).status, 204);
  assert.equal((await request('guest', `/api/animals/${animal.id}`)).status, 404);
});

test('Nuotraukos tikrinamos pagal turinį, keičiamos ir pašalinamos kartu su gyvūnu', async (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shelter-photos-'));
  const { request, base, cookies } = await setup(context, { uploadsDir: directory });
  context.after(() => { for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file)); rmdirSync(directory); });
  const { animal } = await (await request('admin', '/api/admin/animals', 'POST', animalInput)).json();
  const upload = (bytes, type = 'image/png', cookie = cookies.employee) => {
    const body = new FormData(); body.append('photo', new Blob([bytes], { type }), '../../escape.png');
    return fetch(`${base}/api/admin/animals/${animal.id}/photo`, { method: 'POST', headers: { Cookie: cookie, 'X-Requested-With': 'shelter-app' }, body });
  };
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#007f6d' } }).png().toBuffer();
  assert.equal((await upload(png, 'image/png', '')).status, 401);
  assert.equal((await upload('<script>alert(1)</script>', 'image/jpeg')).status, 400);
  assert.equal((await upload('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')).status, 400);
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  assert.deepEqual(readdirSync(directory), []);
  const first = await upload(png); assert.equal(first.status, 200);
  const firstUrl = (await first.json()).animal.photoUrl;
  assert.match(firstUrl, /^\/uploads\/[a-f0-9-]{36}\.webp$/);
  const publicPhoto = await fetch(base + firstUrl);
  assert.equal(publicPhoto.status, 200); assert.match(publicPhoto.headers.get('content-type'), /image\/webp/);
  assert.equal(publicPhoto.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await upload(png)).status, 200);
  assert.equal(readdirSync(directory).length, 1);
  assert.equal((await fetch(base + firstUrl)).status, 404);
  assert.equal((await request('admin', `/api/admin/animals/${animal.id}/photo`, 'DELETE')).status, 200);
  assert.deepEqual(readdirSync(directory), []);
  await upload(png);
  await request('admin', `/api/admin/animals/${animal.id}`, 'DELETE');
  assert.deepEqual(readdirSync(directory), []);
});
