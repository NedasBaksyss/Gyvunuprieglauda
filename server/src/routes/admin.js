import { Router } from 'express';
import { createCatalogRouter, publicFields, serializeAnimal } from './catalog.js';
import { HttpError } from '../lib/http-error.js';
import { choice, id, integer, objectBody, text } from '../lib/validation.js';

export function createAdminRouter(database, auth) {
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
  router.delete('/animals/:id', (request, response) => {
    const animalId = id(request.params.id); readAnimal(animalId);
    if (database.prepare('SELECT id FROM inquiries WHERE animal_id = ? LIMIT 1').get(animalId)) throw new HttpError(409, 'Gyvūnas turi priglaudimo užklausų. Pirmiausia sutvarkykite susijusias užklausas.');
    database.prepare('DELETE FROM animals WHERE id = ?').run(animalId);
    response.status(204).end();
  });
  return router;
}
