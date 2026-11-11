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

test('Darbuotojas peržiūri, filtruoja, redaguoja ir pašalina priglaudimo užklausą', async (context) => {
  const { request } = await setup(context);
  const { animal } = await (await request('admin', '/api/admin/animals', 'POST', animalInput)).json();
  const body = { animalId: animal.id, name: 'Tomas', email: 'tomas@example.com', message: 'Noriu susipažinti.' };
  await request('guest', '/api/inquiries', 'POST', body);
  assert.equal((await request('guest', '/api/admin/inquiries')).status, 401);
  const list = await (await request('employee', '/api/admin/inquiries?status=new')).json();
  assert.equal(list.pagination.total, 1); const inquiry = list.items[0];
  assert.equal(inquiry.email, body.email);
  assert.equal((await request('employee', `/api/admin/inquiries/${inquiry.id}`)).status, 200);
  const updated = { name: 'Tomas II', email: body.email, message: 'Patikslinta žinutė.', status: 'reviewed' };
  assert.equal((await request('employee', `/api/admin/inquiries/${inquiry.id}`, 'PUT', updated)).status, 200);
  assert.equal((await (await request('admin', '/api/admin/inquiries?status=new')).json()).pagination.total, 0);
  assert.equal((await request('employee', `/api/admin/inquiries/${inquiry.id}`, 'PUT', { ...updated, status: 'bad' })).status, 400);
  assert.equal((await request('admin', '/api/admin/inquiries?status=bad')).status, 400);
  assert.equal((await request('employee', `/api/admin/inquiries/${inquiry.id}`, 'DELETE')).status, 204);
  assert.equal((await request('employee', `/api/admin/inquiries/${inquiry.id}`)).status, 404);
});

test('Vieša užklausa išsaugoma, privati informacija neviešinama, užimtų gyvūnų užklausos atmetamos', async (context) => {
  const { request, database } = await setup(context);
  const { animal } = await (await request('admin', '/api/admin/animals', 'POST', animalInput)).json();
  const body = { animalId: animal.id, name: 'Tomas', email: 'tomas@example.com', message: 'Norėčiau susipažinti su Tobiu.' };
  const created = await request('guest', '/api/inquiries', 'POST', body);
  assert.equal(created.status, 201);
  assert.equal(database.prepare('SELECT name FROM inquiries').get().name, 'Tomas');
  assert.ok(!JSON.stringify(await created.json()).includes(body.email));
  assert.equal((await request('guest', '/api/inquiries')).status, 404);
  for (const input of [{ ...body, name: ' ' }, { ...body, email: 'bad' }, { ...body, animalId: 999 }, { ...body, message: '' }]) {
    assert.ok([400, 404].includes((await request('guest', '/api/inquiries', 'POST', input)).status));
  }
  await request('admin', `/api/admin/animals/${animal.id}`, 'PUT', { ...animalInput, status: 'adopted' });
  assert.equal((await request('guest', '/api/inquiries', 'POST', body)).status, 409);
  assert.equal(database.prepare('SELECT count(*) AS n FROM inquiries').get().n, 1);
});

test('Vartotojų valdymas slepia slaptažodžius, tikrina teises ir apsaugo paskutinį administratorių', async (context) => {
  const { request } = await setup(context);
  assert.equal((await request('employee', '/api/admin/users')).status, 403);
  assert.equal((await request('guest', '/api/admin/users')).status, 401);
  const list = await (await request('admin', '/api/admin/users')).json();
  assert.ok(list.items.every((user) => !('password_hash' in user) && !('password' in user)));
  const admin = list.items.find((user) => user.role === 'admin');
  assert.equal((await request('admin', `/api/admin/users/${admin.id}`, 'PUT', { name: admin.name, email: admin.email, role: 'employee', isActive: true })).status, 409);
  assert.equal((await request('admin', `/api/admin/users/${admin.id}`, 'DELETE')).status, 409);
  const body = { name: 'Naujas', email: 'new@example.com', password, role: 'employee' };
  assert.equal((await request('employee', '/api/admin/users', 'POST', body)).status, 403);
  const response = await request('admin', '/api/admin/users', 'POST', body);
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal((await request('admin', '/api/admin/users', 'POST', body)).status, 409);
  assert.equal((await request('admin', `/api/admin/users/${user.id}`, 'PUT', { name: user.name, email: user.email, role: 'admin', isActive: true, password: 'Naujas-slaptazodis-2026' })).status, 200);
  assert.equal((await request('admin', `/api/admin/users/${user.id}`, 'DELETE')).status, 204);
  const employee = list.items.find((item) => item.role === 'employee');
  assert.equal((await request('admin', `/api/admin/users/${employee.id}`, 'PUT', { name: employee.name, email: employee.email, role: employee.role, isActive: false })).status, 200);
  assert.equal((await request('employee', '/api/admin/animals')).status, 401);
});

test('Rūšių CRUD skirtas tik administratoriui ir saugo naudojamas bei pasikartojančias rūšis', async (context) => {
  const { request } = await setup(context);
  for (const [method, url] of [['POST', '/api/admin/species'], ['PUT', '/api/admin/species/1'], ['DELETE', '/api/admin/species/1']]) {
    assert.equal((await request('employee', url, method, { name: 'Katė' })).status, 403);
  }
  const created = await request('admin', '/api/admin/species', 'POST', { name: 'Katė' });
  assert.equal(created.status, 201);
  const { species } = await created.json();
  assert.equal((await request('admin', '/api/admin/species', 'POST', { name: 'katė' })).status, 409);
  assert.equal((await request('admin', '/api/admin/species', 'POST', { name: ' ' })).status, 400);
  assert.equal((await request('admin', `/api/admin/species/${species.id}`, 'PUT', { name: 'Triušis' })).status, 200);
  assert.ok((await (await request('guest', '/api/species')).json()).items.some((item) => item.name === 'Triušis'));
  await request('admin', '/api/admin/animals', 'POST', animalInput);
  assert.equal((await request('admin', '/api/admin/species/1', 'DELETE')).status, 409);
  assert.equal((await request('admin', `/api/admin/species/${species.id}`, 'DELETE')).status, 204);
});

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
