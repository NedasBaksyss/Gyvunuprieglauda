import { Router } from 'express';
import { HttpError } from '../lib/http-error.js';
import { normalizeSearch } from '../lib/search.js';

const statuses = new Set(['available', 'reserved', 'adopted']);
const queryKeys = new Set(['q', 'speciesId', 'status', 'page', 'limit']);
export const publicFields = `a.id, a.name, a.age_months, a.size, a.description,
  a.status, a.photo_path, a.created_at, a.updated_at,
  s.id AS species_id, s.name AS species_name`;

function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)
    || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new HttpError(400, `${label}: nurodykite sveikąjį skaičių nuo 1 iki ${maximum}.`);
  }
  return Number(value);
}

function singleString(value, label, maximum) {
  if (typeof value !== 'string' || value.length > maximum) {
    throw new HttpError(400, `${label}: nurodykite vieną tekstinę reikšmę iki ${maximum} simbolių.`);
  }
  return value.trim();
}

export function serializeAnimal(row) {
  return {
    id: row.id,
    name: row.name,
    species: { id: row.species_id, name: row.species_name },
    ageMonths: row.age_months,
    size: row.size,
    description: row.description,
    status: row.status,
    photoUrl: row.photo_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCatalogRouter(database) {
  const router = Router();

  router.get('/species', (_request, response) => {
    const items = database.prepare(`SELECT s.id, s.name, count(a.id) AS animalCount
      FROM species s LEFT JOIN animals a ON a.species_id = s.id
      GROUP BY s.id ORDER BY s.id`).all();
    response.json({ items });
  });

  router.get('/animals', (request, response) => {
    if (Object.keys(request.query).some((key) => !queryKeys.has(key))) {
      throw new HttpError(400, 'Nežinomas paieškos parametras.');
    }

    const page = request.query.page === undefined ? 1 : positiveInteger(request.query.page, 'Puslapis', 1000000);
    const limit = request.query.limit === undefined ? 12 : positiveInteger(request.query.limit, 'Puslapio dydis', 48);
    const conditions = [];
    const values = [];

    if (request.query.q !== undefined) {
      const query = singleString(request.query.q, 'Paieška', 100);
      if (query) {
        conditions.push('instr(normalize_search(a.name), ?) > 0');
        values.push(normalizeSearch(query));
      }
    }
    if (request.query.speciesId !== undefined) {
      conditions.push('a.species_id = ?');
      values.push(positiveInteger(request.query.speciesId, 'Rūšis'));
    }
    if (request.query.status !== undefined) {
      const status = singleString(request.query.status, 'Būsena', 20);
      if (!statuses.has(status)) throw new HttpError(400, 'Nežinoma gyvūno būsena.');
      conditions.push('a.status = ?');
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = database.prepare(`SELECT count(*) AS total FROM animals a ${where}`).get(...values).total;
    const rows = database.prepare(`SELECT ${publicFields} FROM animals a
      JOIN species s ON s.id = a.species_id ${where}
      ORDER BY a.id LIMIT ? OFFSET ?`).all(...values, limit, (page - 1) * limit);

    response.json({
      items: rows.map(serializeAnimal),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  router.get('/animals/:id', (request, response) => {
    const id = positiveInteger(request.params.id, 'Gyvūno ID');
    const animal = database.prepare(`SELECT ${publicFields} FROM animals a
      JOIN species s ON s.id = a.species_id WHERE a.id = ?`).get(id);
    if (!animal) throw new HttpError(404, 'Gyvūnas nerastas.');
    response.json({ animal: serializeAnimal(animal) });
  });

  return router;
}
