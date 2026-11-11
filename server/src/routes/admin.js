import { Router } from 'express';
import { createCatalogRouter, publicFields, serializeAnimal } from './catalog.js';
import { HttpError } from '../lib/http-error.js';
import { choice, id, integer, objectBody, text } from '../lib/validation.js';

export function createAdminRouter(database, auth, photos) {
  const router = Router();
  router.use(auth.loadSession, auth.requireUser, auth.protectMutation);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(createCatalogRouter(database));
  const readAnimal = (animalId) => {
    const animal = database.prepare(`SELECT ${publicFields} FROM animals a JOIN species s ON s.id = a.species_id WHERE a.id = ?`).get(animalId);
    if (!animal) throw new HttpError(404, 'Gyvūnas nerastas.');
    return serializeAnimal(animal);
  };
  function animalInput(body) {
    objectBody(body, ['name', 'speciesId', 'ageMonths', 'size', 'status', 'description']);
    const speciesId = integer(body.speciesId, 'Rūšis');
    if (!database.prepare('SELECT id FROM species WHERE id = ?').get(speciesId)) throw new HttpError(400, 'Pasirinkta rūšis neegzistuoja.');
    return [text(body.name, 'Vardas'), speciesId, integer(body.ageMonths, 'Amžius mėnesiais', 0, 1200),
      choice(body.size, ['small', 'medium', 'large'], 'Dydis'), choice(body.status, ['available', 'reserved', 'adopted'], 'Būsena'), text(body.description, 'Aprašymas', 5000)];
  }
  router.post('/animals', (request, response) => {
    const result = database.prepare('INSERT INTO animals (name, species_id, age_months, size, status, description) VALUES (?, ?, ?, ?, ?, ?)').run(...animalInput(request.body));
    response.status(201).json({ animal: readAnimal(result.lastInsertRowid) });
  });
  router.put('/animals/:id', (request, response) => {
    const animalId = id(request.params.id); readAnimal(animalId);
    database.prepare("UPDATE animals SET name = ?, species_id = ?, age_months = ?, size = ?, status = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(...animalInput(request.body), animalId);
    response.json({ animal: readAnimal(animalId) });
  });
  router.delete('/animals/:id', async (request, response) => {
    const animalId = id(request.params.id); const animal = readAnimal(animalId);
    if (database.prepare('SELECT id FROM inquiries WHERE animal_id = ? LIMIT 1').get(animalId)) throw new HttpError(409, 'Gyvūnas turi priglaudimo užklausų. Pirmiausia sutvarkykite susijusias užklausas.');
    database.prepare('DELETE FROM animals WHERE id = ?').run(animalId);
    await photos.remove(animal.photoUrl);
    response.status(204).end();
  });
  router.post('/animals/:id/photo', (request, _response, next) => { readAnimal(id(request.params.id)); next(); }, photos.receive, async (request, response) => {
    const animalId = id(request.params.id);
    const photoUrl = await photos.save(request.file);
    let oldPhoto;
    try {
      oldPhoto = readAnimal(animalId).photoUrl;
      database.prepare("UPDATE animals SET photo_path = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(photoUrl, animalId);
    } catch (error) { await photos.remove(photoUrl); throw error; }
    await photos.remove(oldPhoto);
    response.json({ animal: readAnimal(animalId) });
  });
  router.delete('/animals/:id/photo', async (request, response) => {
    const animalId = id(request.params.id);
    const oldPhoto = readAnimal(animalId).photoUrl;
    database.prepare("UPDATE animals SET photo_path = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(animalId);
    await photos.remove(oldPhoto);
    response.json({ animal: readAnimal(animalId) });
  });
  function speciesName(body, speciesId = 0) {
    objectBody(body, ['name']);
    const name = text(body.name, 'Pavadinimas', 80);
    if (database.prepare('SELECT id FROM species WHERE normalize_search(name) = normalize_search(?) AND id != ?').get(name, speciesId)) throw new HttpError(409, 'Tokia rūšis jau yra.');
    return name;
  }
  function requireSpecies(speciesId) {
    if (!database.prepare('SELECT id FROM species WHERE id = ?').get(speciesId)) throw new HttpError(404, 'Rūšis nerasta.');
  }
  router.post('/species', auth.requireRole('admin'), (request, response) => {
    const name = speciesName(request.body);
    const result = database.prepare('INSERT INTO species (name) VALUES (?)').run(name);
    response.status(201).json({ species: { id: Number(result.lastInsertRowid), name, animalCount: 0 } });
  });
  router.put('/species/:id', auth.requireRole('admin'), (request, response) => {
    const speciesId = id(request.params.id); requireSpecies(speciesId);
    const name = speciesName(request.body, speciesId);
    database.prepare("UPDATE species SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(name, speciesId);
    response.json({ species: { id: speciesId, name } });
  });
  router.delete('/species/:id', auth.requireRole('admin'), (request, response) => {
    const speciesId = id(request.params.id); requireSpecies(speciesId);
    if (database.prepare('SELECT id FROM animals WHERE species_id = ? LIMIT 1').get(speciesId)) throw new HttpError(409, 'Rūšis priskirta gyvūnams. Pirmiausia pakeiskite jų rūšį.');
    database.prepare('DELETE FROM species WHERE id = ?').run(speciesId);
    response.status(204).end();
  });
  return router;
}
