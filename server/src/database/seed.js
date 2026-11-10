const seedName = 'demo-catalog-v1';

const speciesNames = ['Šuo', 'Katė', 'Triušis', 'Jūrų kiaulytė'];
const animals = [
  {
    name: 'Lukas', species: 'Šuo', ageMonths: 36, size: 'medium', status: 'available',
    description: 'Lukas yra draugiškas, aktyvus ir labai meilus šuo. Puikiai sutaria su žmonėmis ir kitais gyvūnais. Mėgsta ilgus pasivaikščiojimus ir žaidimus lauke. Ieško atsakingų ir mylinčių šeimininkų.',
  },
  {
    name: 'Mėja', species: 'Katė', ageMonths: 24, size: 'small', status: 'available',
    description: 'Mėja – smalsi ir švelni katė. Mėgsta stebėti aplinką nuo palangės, žaisti ir snausti šalia žmogaus. Naujoje vietoje jai reikės šiek tiek laiko apsiprasti.',
  },
  {
    name: 'Reksas', species: 'Šuo', ageMonths: 12, size: 'large', status: 'available',
    description: 'Reksas – jaunas, energingas ir žaismingas šuo. Greitai mokosi, mėgsta aktyvų laisvalaikį ir žmogaus draugiją. Ieško šeimos, kuri galėtų skirti laiko pasivaikščiojimams bei mokymui.',
  },
  {
    name: 'Pūkas', species: 'Katė', ageMonths: 48, size: 'medium', status: 'adopted',
    description: 'Pūkas – ramus ir meilus katinas, mėgstantis jaukias vietas ir švelnų dėmesį. Jis jau surado savo šeimą ir džiaugiasi naujais namais.',
  },
];

export function seedDatabase(database) {
  database.exec('BEGIN IMMEDIATE');
  try {
    if (database.prepare('SELECT 1 FROM seed_history WHERE name = ?').get(seedName)) {
      database.exec('COMMIT');
      return { applied: false, reason: 'already_seeded' };
    }

    const occupied = database.prepare(`SELECT
      EXISTS (SELECT 1 FROM species) OR EXISTS (SELECT 1 FROM animals) AS occupied`).get();
    if (occupied.occupied) {
      database.exec('COMMIT');
      return { applied: false, reason: 'catalog_not_empty' };
    }

    const insertSpecies = database.prepare('INSERT INTO species (name) VALUES (?)');
    const speciesIds = new Map(speciesNames.map((name) => [name, insertSpecies.run(name).lastInsertRowid]));
    const insertAnimal = database.prepare(`INSERT INTO animals
      (species_id, name, age_months, size, description, status) VALUES (?, ?, ?, ?, ?, ?)`);

    for (const animal of animals) {
      insertAnimal.run(speciesIds.get(animal.species), animal.name, animal.ageMonths,
        animal.size, animal.description, animal.status);
    }
    database.prepare('INSERT INTO seed_history (name) VALUES (?)').run(seedName);
    database.exec('COMMIT');
    return { applied: true, species: speciesNames.length, animals: animals.length };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
