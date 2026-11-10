import { test } from 'vitest';
import assert from 'node:assert/strict';
import { catalogUrl, formatAge } from '../src/lib/catalog.js';

test('Amžius rodomas taisyklingai ir jaunikliams, ir vyresniems gyvūnams', () => {
  const examples = [[0, 'Iki 1 mėnesio'], [1, '1 mėnuo'], [2, '2 mėnesiai'], [10, '10 mėnesių'],
    [11, '11 mėnesių'], [12, '1 metai'], [18, '1 m. 6 mėn.'], [24, '2 metai'], [132, '11 metų'], [240, '20 metų']];
  for (const [months, expected] of examples) assert.equal(formatAge(months), expected);
});

test('Paieškos URL išlaiko tekstą, neleidžia jam pakeisti kitų filtrų ir praleidžia tuščius filtrus', () => {
  const url = new URL(catalogUrl({ q: ' Mėja&status=adopted ', speciesId: '2', status: 'available', page: 2 }), 'http://localhost');
  assert.equal(url.pathname, '/api/animals');
  assert.equal(url.searchParams.get('q'), 'Mėja&status=adopted');
  assert.equal(url.searchParams.get('status'), 'available');
  assert.equal(url.searchParams.get('speciesId'), '2');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('limit'), '12');
  assert.equal(catalogUrl({ q: '  ' }), '/api/animals?page=1&limit=12');
});
