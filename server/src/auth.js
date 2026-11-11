import { Router } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from './lib/http-error.js';

const derive = promisify(scrypt);
const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const cookieName = 'shelter_session';
const lifetime = 8 * 60 * 60 * 1000;
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const digest = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role });

export function validateEmail(value) {
  if (typeof value !== 'string' || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new HttpError(400, 'Įveskite galiojantį el. pašto adresą.');
  }
  return value.trim().toLowerCase();
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'Slaptažodis turi būti nuo 12 iki 128 simbolių.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, passwordOptions);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const valid = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored || '');
  const [, salt, expected] = (valid ? stored : dummyHash).split('$');
  const actual = await derive(password, salt, 64, passwordOptions);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && valid;
}

export async function createUser(database, { name, email, password, role = 'employee' }) {
  email = validateEmail(email);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new HttpError(400, 'Vardas turi būti nuo 1 iki 100 simbolių.');
  if (!['admin', 'employee'].includes(role)) throw new HttpError(400, 'Nežinoma vartotojo rolė.');
  const hash = await hashPassword(password);
  if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'Toks el. paštas jau naudojamas.');
  const result = database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name.trim(), email, hash, role);
  return publicUser(database.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
}

function readToken(request) {
  const matches = (request.headers.cookie || '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function createAuth(database, { secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/api' };
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

  function loadSession(request, response, next) {
    const token = readToken(request);
    request.user = null;
    if (token) {
      const row = database.prepare(`SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`).get(digest(token));
      if (row && row.is_active && row.expires_at > Date.now()) request.user = publicUser(row);
      else {
        database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
        response.clearCookie(cookieName, cookieOptions);
      }
    }
    next();
  }

  function requireUser(request, _response, next) {
    if (!request.user) throw new HttpError(401, 'Prisijunkite prie sistemos.');
    next();
  }

  function requireRole(...roles) {
    return (request, response, next) => requireUser(request, response, () => {
      if (!roles.includes(request.user.role)) throw new HttpError(403, 'Šiam veiksmui nepakanka teisių.');
      next();
    });
  }

  // A custom header prevents simple cross-origin form requests; CORS is not enabled.
  function protectMutation(request, _response, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    if (request.get('X-Requested-With') !== 'shelter-app' || request.get('Sec-Fetch-Site') === 'cross-site') {
      throw new HttpError(403, 'Užklausa negalima. Atnaujinkite puslapį.');
    }
    const origin = request.get('Origin');
    if (origin) {
      let originHost;
      try { const parsed = new URL(origin); if (['http:', 'https:'].includes(parsed.protocol)) originHost = parsed.host; } catch { /* Invalid origin is rejected below. */ }
      if (originHost !== request.get('Host')) throw new HttpError(403, 'Neleistina užklausos kilmė.');
    }
    next();
  }

  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
    standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Per daug bandymų. Bandykite po 15 minučių.' } });

  router.get('/me', loadSession, requireUser, (request, response) => response.json({ user: request.user }));
  router.post('/login', protectMutation, loginLimit, async (request, response) => {
    const email = validateEmail(request.body?.email);
    const password = request.body?.password;
    if (typeof password !== 'string' || !password.length || password.length > 128) throw new HttpError(400, 'Įveskite slaptažodį iki 128 simbolių.');
    const candidate = database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const matches = await verifyPassword(password, candidate?.password_hash);
    const user = candidate && database.prepare('SELECT * FROM users WHERE id = ?').get(candidate.id);
    if (!matches || !user?.is_active || user.password_hash !== candidate.password_hash) throw new HttpError(401, 'Neteisingas el. paštas arba slaptažodis.');
    const oldToken = readToken(request);
    const token = randomBytes(32).toString('base64url');
    database.exec('BEGIN');
    try {
      database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      if (oldToken) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(oldToken));
      database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(digest(token), user.id, Date.now() + lifetime);
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
    response.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime });
    response.json({ user: publicUser(user) });
  });
  router.post('/logout', protectMutation, (request, response) => {
    const token = readToken(request);
    if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    response.clearCookie(cookieName, cookieOptions);
    response.status(204).end();
  });
  return { router, loadSession, requireUser, requireRole, protectMutation };
}
