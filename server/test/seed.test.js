import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/database/index.js';
import { seedDatabase, addDemoPhotos } from '../src/database/seed.js';
import { readFileSync } from 'node:fs';

test('Pavyzdiniai duomenys įterpiami vieną kartą, pakeitimai ir trynimai išlieka', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  assert.deepEqual(seedDatabase(database), { applied: true, species: 4, animals: 4 });
  database.prepare('UPDATE animals SET name = ? WHERE id = ?').run('Naujas vardas', 1);
  database.prepare('DELETE FROM animals WHERE id = ?').run(4);
  assert.deepEqual(seedDatabase(database), { applied: false, reason: 'already_seeded' });
  assert.equal(database.prepare('SELECT count(*) AS total FROM animals').get().total, 3);
  assert.equal(database.prepare('SELECT name FROM animals WHERE id = 1').get().name, 'Naujas vardas');
  database.exec('DELETE FROM animals; DELETE FROM species;');
  assert.equal(seedDatabase(database).reason, 'already_seeded');
  assert.equal(database.prepare('SELECT count(*) AS total FROM animals').get().total, 0);
});

test('Netuščias naudotojo katalogas neliečiamas', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  database.prepare('INSERT INTO species (name) VALUES (?)').run('Paukštis');
  assert.deepEqual(seedDatabase(database), { applied: false, reason: 'catalog_not_empty' });
  assert.equal(database.prepare('SELECT count(*) AS total FROM species').get().total, 1);
  assert.equal(database.prepare('SELECT name FROM species').get().name, 'Paukštis');
  assert.equal(database.prepare('SELECT count(*) AS total FROM animals').get().total, 0);
  assert.equal(database.prepare('SELECT count(*) AS total FROM seed_history').get().total, 0);
});

test('Nepavykęs įterpimas atšaukiamas visas ir gali būti pakartotas', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  database.exec(`CREATE TRIGGER reject_demo_animal BEFORE INSERT ON animals
    WHEN NEW.name = 'Reksas' BEGIN SELECT RAISE(ABORT, 'test seed failure'); END;`);
  assert.throws(() => seedDatabase(database), /test seed failure/);
  for (const table of ['animals', 'species', 'seed_history']) {
    assert.equal(database.prepare(`SELECT count(*) AS total FROM ${table}`).get().total, 0);
  }
  database.exec('DROP TRIGGER reject_demo_animal');
  assert.equal(seedDatabase(database).applied, true);
});

test('Ankstesnio etapo pavyzdžiams pridedamos vietinės veikiančios WebP nuotraukos', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  seedDatabase(database);
  database.exec('UPDATE animals SET photo_path = NULL');
  assert.equal(addDemoPhotos(database), 4);
  for (const animal of database.prepare('SELECT photo_path FROM animals').all()) {
    const file = new URL(`../../client/public${animal.photo_path}`, import.meta.url);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  assert.equal(addDemoPhotos(database), 0);
});

test('Nuotraukų papildymas neperrašo pasirinkimų ir neatkuria pašalintų pavyzdžių', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  seedDatabase(database);
  database.exec('UPDATE animals SET photo_path = NULL');
  database.prepare('UPDATE animals SET photo_path = ? WHERE id = 1').run('/uploads/own.webp');
  database.prepare('UPDATE animals SET name = ? WHERE id = 2').run('Kitas vardas');
  database.exec('DELETE FROM animals WHERE id = 4');
  assert.equal(addDemoPhotos(database), 1);
  assert.equal(database.prepare('SELECT photo_path FROM animals WHERE id = 1').get().photo_path, '/uploads/own.webp');
  assert.equal(database.prepare('SELECT photo_path FROM animals WHERE id = 2').get().photo_path, null);
  assert.equal(database.prepare('SELECT count(*) AS total FROM animals').get().total, 3);
  database.exec('UPDATE animals SET photo_path = NULL');
  assert.equal(addDemoPhotos(database), 0);
});

test('Nuotraukos nepriskiriamos katalogui, kuris nesukurtas pavyzdžių komanda', (context) => {
  const database = openDatabase(':memory:');
  context.after(() => database.close());
  seedDatabase(database);
  database.exec('DELETE FROM seed_history; UPDATE animals SET photo_path = NULL');
  assert.equal(addDemoPhotos(database), 0);
  assert.equal(database.prepare('SELECT count(*) AS total FROM animals WHERE photo_path IS NOT NULL').get().total, 0);
});
