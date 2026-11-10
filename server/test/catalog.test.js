import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database/index.js';
import { seedDatabase } from '../src/database/seed.js';

async function createFixture(context, { seed = true } = {}) {
  const database = openDatabase(':memory:');
  if (seed) seedDatabase(database);
  const server = createApp({ database }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  return {
    database,
    async get(endpoint) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${endpoint}`);
      return { status: response.status, body: await response.json() };
    },
  };
}

test('Tuščias katalogas grąžina tuščius sąrašus', async (context) => {
  const { get } = await createFixture(context, { seed: false });
  assert.deepEqual(await get('/species'), { status: 200, body: { items: [] } });
  assert.deepEqual(await get('/animals'), {
    status: 200,
    body: { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } },
  });
});

test('Katalogas ir detalės grąžina tik viešus gyvūno duomenis', async (context) => {
  const { get, database } = await createFixture(context);
  database.prepare(`INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)`).run('Admin', 'private@example.com', 'private-password-hash', 'admin');
  database.prepare(`INSERT INTO inquiries (animal_id, name, email, message)
    VALUES (?, ?, ?, ?)`).run(1, 'Privatus vardas', 'sender@example.com', 'Privati žinutė');

  const { status, body } = await get('/animals');
  assert.equal(status, 200);
  assert.deepEqual(body.items.map((animal) => animal.name), ['Lukas', 'Mėja', 'Reksas', 'Pūkas']);
  assert.equal(body.pagination.total, 4);
  const detail = await get('/animals/1');
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.animal, body.items[0]);
  assert.deepEqual(Object.keys(detail.body.animal).sort(), [
    'id', 'name', 'species', 'ageMonths', 'size', 'description', 'status', 'photoUrl', 'createdAt', 'updatedAt',
  ].sort());
  assert.deepEqual(detail.body.animal.species, { id: 1, name: 'Šuo' });
  assert.equal(detail.body.animal.ageMonths, 36);
  assert.equal(detail.body.animal.photoUrl, '/images/animals/lukas.webp');
  assert.ok(detail.body.animal.description.includes('Lukas'));
  assert.equal((await get('/users')).status, 404);
  assert.equal((await get('/inquiries')).status, 404);
});

test('Rūšių skaičiai įtraukia ir priglaustus gyvūnus bei tuščias rūšis', async (context) => {
  const { get } = await createFixture(context);
  assert.deepEqual(await get('/species'), {
    status: 200,
    body: { items: [
      { id: 1, name: 'Šuo', animalCount: 2 },
      { id: 2, name: 'Katė', animalCount: 2 },
      { id: 3, name: 'Triušis', animalCount: 0 },
      { id: 4, name: 'Jūrų kiaulytė', animalCount: 0 },
    ] },
  });
});

test('Paieška palaiko lietuviškas raides, dalinį vardą ir filtrų derinius', async (context) => {
  const { get, database } = await createFixture(context);
  for (const query of ['MĖJA', 'meja', ' mėJ ', 'ME\u0307JA']) {
    const result = await get(`/animals?q=${encodeURIComponent(query)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.items.map((animal) => animal.name), ['Mėja']);
  }
  assert.deepEqual((await get('/animals?q=pukas')).body.items.map((animal) => animal.name), ['Pūkas']);
  const cats = await get('/animals?speciesId=2&status=available&q=ja');
  assert.deepEqual(cats.body.items.map((animal) => animal.name), ['Mėja']);
  assert.equal((await get('/animals?status=available')).body.pagination.total, 3);
  assert.deepEqual((await get('/animals?status=adopted')).body.items.map((animal) => animal.name), ['Pūkas']);
  assert.equal((await get('/animals?speciesId=3')).body.pagination.total, 0);
  assert.equal((await get('/animals?speciesId=999')).body.pagination.total, 0);
  assert.equal((await get('/animals?q=%20%20')).body.pagination.total, 4);

  database.prepare('UPDATE animals SET status = ? WHERE id = ?').run('reserved', 3);
  assert.deepEqual((await get('/animals?status=reserved')).body.items.map((animal) => animal.name), ['Reksas']);
  assert.equal((await get('/animals?speciesId=2&status=reserved')).body.pagination.total, 0);
});

test('Puslapiavimas stabilus, bendras skaičius atitinka filtrus', async (context) => {
  const { get } = await createFixture(context);
  const first = await get('/animals?limit=2');
  const second = await get('/animals?limit=2&page=2');
  assert.deepEqual(first.body.items.map((animal) => animal.id), [1, 2]);
  assert.deepEqual(second.body.items.map((animal) => animal.id), [3, 4]);
  assert.deepEqual(second.body.pagination, { page: 2, limit: 2, total: 4, totalPages: 2 });
  const beyond = await get('/animals?limit=2&page=3');
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.items, []);
  const filtered = await get('/animals?status=available&limit=2&page=2');
  assert.deepEqual(filtered.body.items.map((animal) => animal.name), ['Reksas']);
  assert.deepEqual(filtered.body.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test('Netinkami parametrai atmetami, nerastas gyvūnas grąžina 404', async (context) => {
  const { get } = await createFixture(context);
  const invalidQueries = [
    'page=0', 'page=-1', 'page=1.5', 'page=1000001', 'page=9007199254740992',
    'limit=0', 'limit=49', 'limit=1&limit=2', 'speciesId=abc', 'speciesId=',
    'speciesId=1&speciesId=2', 'status=unknown', 'status=', 'q=a&q=b',
    'q[name]=Lukas', `q=${'a'.repeat(101)}`, 'unexpected=1',
  ];
  for (const query of invalidQueries) {
    const result = await get(`/animals?${query}`);
    assert.equal(result.status, 400, query);
    assert.deepEqual(Object.keys(result.body), ['message']);
  }
  for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
    assert.equal((await get(`/animals/${id}`)).status, 400, id);
  }
  assert.deepEqual(await get('/animals/999'), { status: 404, body: { message: 'Gyvūnas nerastas.' } });
});

test('Paieškos tekstas nevykdomas kaip SQL ir nėra LIKE šablonas', async (context) => {
  const { get } = await createFixture(context);
  for (const query of ["' OR 1=1 --", '%', '_', "'; DROP TABLE animals; --"]) {
    const result = await get(`/animals?q=${encodeURIComponent(query)}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
  }
  assert.equal((await get('/animals')).body.pagination.total, 4);
});
