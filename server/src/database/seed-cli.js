import { config } from '../config.js';
import { openDatabase } from './index.js';
import { seedDatabase } from './seed.js';

const database = openDatabase(config.databasePath);
try {
  const result = seedDatabase(database);
  if (result.applied) {
    console.log(`Sukurti pavyzdiniai duomenys: ${result.species} rūšys, ${result.animals} gyvūnai.`);
  } else if (result.reason === 'already_seeded') {
    console.log('Pavyzdiniai duomenys jau buvo sukurti. Esami įrašai nepakeisti.');
  } else {
    console.log('Katalogas netuščias. Pavyzdiniai duomenys nepridėti, esami įrašai nepakeisti.');
  }
} finally {
  database.close();
}
