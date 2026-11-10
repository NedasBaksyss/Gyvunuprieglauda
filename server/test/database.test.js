import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/database/index.js';

test('Duomenys išlieka paleidus iš naujo, o ryšiai apsaugo susijusius įrašus', (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shelter-test-'));
  const filename = path.join(directory, 'test.sqlite');
  let database;
  context.after(() => {
    database?.close();
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(filename + suffix, { force: true });
    }
    rmdirSync(directory);
  });

  database = openDatabase(filename);
  database.prepare('INSERT INTO species (name) VALUES (?)').run('Šuo');
  database.prepare(`INSERT INTO animals (species_id, name, age_months, size, description)
    VALUES (?, ?, ?, ?, ?)`).run(1, 'Lukas', 36, 'medium', 'Draugiškas šuo.');
  database.prepare(`INSERT INTO inquiries (animal_id, name, email, message)
    VALUES (?, ?, ?, ?)`).run(1, 'Tomas', 'tomas@example.com', 'Norėčiau susipažinti.');

  assert.throws(() => database.prepare('DELETE FROM species WHERE id = ?').run(1), /FOREIGN KEY/);
  assert.throws(() => database.prepare('DELETE FROM animals WHERE id = ?').run(1), /FOREIGN KEY/);
  assert.throws(() => database.prepare('UPDATE animals SET age_months = -1 WHERE id = 1').run(), /CHECK/);

  database.close();
  database = undefined;
  database = openDatabase(filename);
  assert.equal(database.prepare('SELECT name FROM animals WHERE id = 1').get().name, 'Lukas');
  assert.equal(database.prepare('SELECT count(*) AS total FROM inquiries').get().total, 1);
  assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});
