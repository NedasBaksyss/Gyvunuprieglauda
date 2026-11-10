import { createApp } from './app.js';
import { config } from './config.js';
import { openDatabase } from './database/index.js';

const database = openDatabase(config.databasePath);
const app = createApp({ database, clientDist: config.clientDist });
const server = app.listen(config.port, config.host, () => {
  console.log(`Express serveris: http://${config.host}:${config.port}`);
});

server.on('error', (error) => {
  console.error(`Nepavyko paleisti serverio: ${error.message}`);
  database.close();
  process.exitCode = 1;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => database.close());
  server.closeIdleConnections();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
