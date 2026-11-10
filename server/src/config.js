import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT turi būti sveikasis skaičius nuo 1 iki 65535.');
}

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port,
  databasePath: path.resolve(projectRoot, process.env.DATABASE_PATH || 'server/data/shelter.sqlite'),
  clientDist: path.join(projectRoot, 'client/dist'),
};
