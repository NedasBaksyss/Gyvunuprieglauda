import { Router } from 'express';
import { createCatalogRouter, publicFields, serializeAnimal } from './catalog.js';
import { HttpError } from '../lib/http-error.js';
import { choice, id, integer, objectBody, text } from '../lib/validation.js';
import { createUser, hashPassword, publicUser, validateEmail } from '../auth.js';

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
  const serializeUser = (row) => ({ ...publicUser(row), isActive: Boolean(row.is_active), createdAt: row.created_at });
  function requireAccount(userId) {
    const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(404, 'Vartotojas nerastas.');
    return user;
  }
  function assertAdmin(request) {
    const actor = requireAccount(request.user.id);
    if (!actor.is_active || actor.role !== 'admin') throw new HttpError(403, 'Šiam veiksmui nepakanka teisių.');
  }
  function protectLastAdmin(user, role, active) {
    if (user.role === 'admin' && user.is_active && (role !== 'admin' || !active)
      && database.prepare("SELECT count(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").get().n <= 1) {
      throw new HttpError(409, 'Sistemoje turi likti bent vienas aktyvus administratorius.');
    }
  }
  router.get('/users', auth.requireRole('admin'), (_request, response) => response.json({ items: database.prepare('SELECT * FROM users ORDER BY id').all().map(serializeUser) }));
  router.post('/users', auth.requireRole('admin'), async (request, response) => {
    objectBody(request.body, ['name', 'email', 'password', 'role']);
    const user = await createUser(database, request.body, () => assertAdmin(request));
    response.status(201).json({ user: serializeUser(requireAccount(user.id)) });
  });
  router.put('/users/:id', auth.requireRole('admin'), async (request, response) => {
    const userId = id(request.params.id); requireAccount(userId);
    const body = objectBody(request.body, ['name', 'email', 'role', 'isActive', 'password']);
    const name = text(body.name, 'Vardas'); const email = validateEmail(body.email);
    const role = choice(body.role, ['admin', 'employee'], 'Rolė');
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Nurodykite paskyros aktyvumą.');
    const passwordHash = body.password === undefined || body.password === '' ? null : await hashPassword(body.password);
    assertAdmin(request);
    database.exec('BEGIN IMMEDIATE');
    try {
      const user = requireAccount(userId);
      protectLastAdmin(user, role, body.isActive);
      if (database.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId)) throw new HttpError(409, 'Toks el. paštas jau naudojamas.');
      database.prepare("UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(name, email, role, Number(body.isActive), passwordHash || user.password_hash, userId);
      if (passwordHash || !body.isActive) database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
    response.json({ user: serializeUser(requireAccount(userId)) });
  });
  router.delete('/users/:id', auth.requireRole('admin'), (request, response) => {
    const userId = id(request.params.id);
    if (userId === request.user.id) throw new HttpError(409, 'Savo paskyros pašalinti negalite.');
    const user = requireAccount(userId); protectLastAdmin(user, '', false);
    database.prepare('DELETE FROM users WHERE id = ?').run(userId);
    response.status(204).end();
  });
  const inquiryFields = `i.*, a.name AS animal_name, a.photo_path`;
  const serializeInquiry = (row) => ({ id: row.id, name: row.name, email: row.email, message: row.message,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    animal: { id: row.animal_id, name: row.animal_name, photoUrl: row.photo_path } });
  function readInquiry(inquiryId) {
    const row = database.prepare(`SELECT ${inquiryFields} FROM inquiries i JOIN animals a ON a.id = i.animal_id WHERE i.id = ?`).get(inquiryId);
    if (!row) throw new HttpError(404, 'Užklausa nerasta.');
    return serializeInquiry(row);
  }
  router.get('/inquiries', (request, response) => {
    if (Object.keys(request.query).some((key) => !['status', 'page'].includes(key))) throw new HttpError(400, 'Nežinomas paieškos parametras.');
    const page = request.query.page === undefined ? 1 : integer(id(request.query.page), 'Puslapis', 1, 1000000);
    const status = request.query.status === undefined || request.query.status === '' ? '' : choice(request.query.status, ['new', 'reviewed', 'completed'], 'Būsena');
    const values = status ? [status] : []; const where = status ? 'WHERE i.status = ?' : '';
    const total = database.prepare(`SELECT count(*) AS n FROM inquiries i ${where}`).get(...values).n;
    const items = database.prepare(`SELECT ${inquiryFields} FROM inquiries i JOIN animals a ON a.id = i.animal_id ${where} ORDER BY i.id DESC LIMIT 20 OFFSET ?`).all(...values, (page - 1) * 20).map(serializeInquiry);
    response.json({ items, pagination: { page, limit: 20, total, totalPages: Math.ceil(total / 20) } });
  });
  router.get('/inquiries/:id', (request, response) => response.json({ inquiry: readInquiry(id(request.params.id)) }));
  router.put('/inquiries/:id', (request, response) => {
    const inquiryId = id(request.params.id); readInquiry(inquiryId);
    const body = objectBody(request.body, ['name', 'email', 'message', 'status']);
    const values = [text(body.name, 'Vardas'), validateEmail(body.email), text(body.message, 'Žinutė', 5000), choice(body.status, ['new', 'reviewed', 'completed'], 'Būsena')];
    database.prepare("UPDATE inquiries SET name = ?, email = ?, message = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(...values, inquiryId);
    response.json({ inquiry: readInquiry(inquiryId) });
  });
  router.delete('/inquiries/:id', (request, response) => {
    const inquiryId = id(request.params.id); readInquiry(inquiryId);
    database.prepare('DELETE FROM inquiries WHERE id = ?').run(inquiryId);
    response.status(204).end();
  });
  return router;
}
