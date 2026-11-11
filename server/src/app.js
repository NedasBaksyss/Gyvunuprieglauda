import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createCatalogRouter } from './routes/catalog.js';
import { HttpError } from './lib/http-error.js';
import { createAuth } from './auth.js';
import { createAdminRouter } from './routes/admin.js';

export function createApp({ database, clientDist, secureCookies }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  const auth = createAuth(database, { secureCookies });
  app.use('/api/auth', auth.router);
  app.use('/api/admin', createAdminRouter(database, auth));

  app.get('/api/health', (_request, response) => {
    database.prepare('SELECT 1').get();
    response.set('Cache-Control', 'no-store').json({ status: 'ok', database: 'connected' });
  });

  app.use('/api', createCatalogRouter(database));

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'API adresas nerastas.' });
  });

  if (clientDist && existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (request, response, next) => {
      if (path.extname(request.path) || !request.accepts('html')) return next();
      response.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ message: 'Puslapis nerastas.' });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      return response.status(error.status).json({ message: error.message });
    }
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ message: 'Neteisingas JSON formatas.' });
    }
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ message: 'Užklausos duomenys per dideli.' });
    }
    console.error(error);
    response.status(500).json({ message: 'Vidinė serverio klaida.' });
  });

  return app;
}
