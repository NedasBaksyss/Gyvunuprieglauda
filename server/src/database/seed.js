const seedName = 'demo-catalog-v1';

// Demonstracinių nuotraukų šaltiniai (https://unsplash.com/license):
// Lukas: Shayna Douglas, https://unsplash.com/photos/mUPR-sjtvn4
// Mėja: Lloyd Henneman, https://unsplash.com/photos/mBRfYA0dYYE
// Reksas: Faber Leonardo, https://unsplash.com/photos/7tcLuB2lQCM
// Pūkas: Welcome, https://unsplash.com/photos/omgGyoQgPh0

const speciesNames = ['Šuo', 'Katė', 'Triušis', 'Jūrų kiaulytė'];
const animals = [
  {
    name: 'Lukas', species: 'Šuo', ageMonths: 36, size: 'medium', status: 'available', photo: '/images/animals/lukas.webp',
    description: 'Lukas yra draugiškas, aktyvus ir labai meilus šuo. Puikiai sutaria su žmonėmis ir kitais gyvūnais. Mėgsta ilgus pasivaikščiojimus ir žaidimus lauke. Ieško atsakingų ir mylinčių šeimininkų.',
  },
  {
    name: 'Mėja', species: 'Katė', ageMonths: 24, size: 'small', status: 'available', photo: '/images/animals/meja.webp',
    description: 'Mėja – smalsi ir švelni katė. Mėgsta stebėti aplinką nuo palangės, žaisti ir snausti šalia žmogaus. Naujoje vietoje jai reikės šiek tiek laiko apsiprasti.',
  },
  {
    name: 'Reksas', species: 'Šuo', ageMonths: 12, size: 'large', status: 'available', photo: '/images/animals/reksas.webp',
    description: 'Reksas – jaunas, energingas ir žaismingas šuo. Greitai mokosi, mėgsta aktyvų laisvalaikį ir žmogaus draugiją. Ieško šeimos, kuri galėtų skirti laiko pasivaikščiojimams bei mokymui.',
  },
  {
    name: 'Pūkas', species: 'Katė', ageMonths: 48, size: 'medium', status: 'adopted', photo: '/images/animals/pukas.webp',
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
      (species_id, name, age_months, size, description, status, photo_path) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    for (const animal of animals) {
      insertAnimal.run(speciesIds.get(animal.species), animal.name, animal.ageMonths,
        animal.size, animal.description, animal.status, animal.photo);
    }
    database.prepare('INSERT INTO seed_history (name) VALUES (?)').run(seedName);
    database.exec('COMMIT');
    return { applied: true, species: speciesNames.length, animals: animals.length };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

// Vienkartinis antro etapo pavyzdžių papildymas. Kitų įrašų ir pasirinktų nuotraukų neliečia.
export function addDemoPhotos(database) {
  const photoSeed = 'demo-photos-v1';
  database.exec('BEGIN IMMEDIATE');
  try {
    const hasCatalog = database.prepare('SELECT 1 FROM seed_history WHERE name = ?').get(seedName);
    const hasPhotos = database.prepare('SELECT 1 FROM seed_history WHERE name = ?').get(photoSeed);
    let updated = 0;
    if (hasCatalog && !hasPhotos) {
      const update = database.prepare(`UPDATE animals SET photo_path = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND name = ? AND description = ? AND photo_path IS NULL
        AND species_id = (SELECT id FROM species WHERE name = ?)`);
      animals.forEach((animal, index) => {
        updated += update.run(animal.photo, index + 1, animal.name, animal.description, animal.species).changes;
      });
      database.prepare('INSERT INTO seed_history (name) VALUES (?)').run(photoSeed);
    }
    database.exec('COMMIT');
    return updated;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
