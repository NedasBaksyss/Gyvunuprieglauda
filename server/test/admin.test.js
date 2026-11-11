import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createUser } from '../src/auth.js';
import { openDatabase } from '../src/database/index.js';

const password = 'Testinis-slaptazodis-2026';
async function setup(context) {
  const database = openDatabase(':memory:');
  for (const role of ['admin', 'employee']) await createUser(database, { name: role, email: `${role}@example.com`, password, role });
  database.prepare('INSERT INTO species (name) VALUES (?)').run('Šuo');
  const server = createApp({ database }).listen(0, '127.0.0.1');
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
