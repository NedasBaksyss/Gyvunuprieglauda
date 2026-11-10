import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database/index.js';

test('API pasiekia duomenų bazę ir grąžina saugias klaidas', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp({ database }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' });

  const unknown = await fetch(`${url}/api/unknown`);
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { message: 'API adresas nerastas.' });

  const malformed = await fetch(`${url}/api/unknown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { message: 'Neteisingas JSON formatas.' });
});
