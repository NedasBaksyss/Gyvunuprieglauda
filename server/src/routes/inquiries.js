import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../lib/http-error.js';
import { integer, objectBody, text } from '../lib/validation.js';
import { validateEmail } from '../auth.js';

export function createInquiryRouter(database, auth) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Pateikta per daug užklausų. Bandykite po 15 minučių.' } });
  router.post('/inquiries', auth.protectMutation, limiter, (request, response) => {
    const body = objectBody(request.body, ['animalId', 'name', 'email', 'message']);
    const animalId = integer(body.animalId, 'Gyvūnas');
    const name = text(body.name, 'Vardas'); const email = validateEmail(body.email); const message = text(body.message, 'Žinutė', 5000);
    const animal = database.prepare('SELECT status FROM animals WHERE id = ?').get(animalId);
    if (!animal) throw new HttpError(404, 'Gyvūnas nerastas.');
    if (animal.status !== 'available') throw new HttpError(409, 'Šis gyvūnas šiuo metu neieško namų. Pasirinkite kitą globotinį.');
    database.prepare('INSERT INTO inquiries (animal_id, name, email, message) VALUES (?, ?, ?, ?)').run(animalId, name, email, message);
    response.status(201).set('Cache-Control', 'no-store').json({ message: 'Užklausa gauta. Prieglaudos komanda su jumis susisieks el. paštu.' });
  });
  return router;
}
