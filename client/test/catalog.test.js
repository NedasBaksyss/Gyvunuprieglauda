import { test } from 'vitest';
import assert from 'node:assert/strict';
import { catalogSearch, catalogUrl, formatAge, readCatalogFilters } from '../src/lib/catalog.js';

test('Amžius rodomas taisyklingai ir jaunikliams, ir vyresniems gyvūnams', () => {
  const examples = [[0, 'Iki 1 mėnesio'], [1, '1 mėnuo'], [2, '2 mėnesiai'], [10, '10 mėnesių'],
    [11, '11 mėnesių'], [12, '1 metai'], [18, '1 m. 6 mėn.'], [24, '2 metai'], [132, '11 metų'], [240, '20 metų']];
  for (const [months, expected] of examples) assert.equal(formatAge(months), expected);
});

test('Katalogo adresas atkuria filtrus, atmeta netinkamas ir pasikartojančias reikšmes', () => {
  const expected = { q: 'Mėja & Pūkas', speciesId: '2', status: 'available', page: 2 };
  assert.deepEqual(readCatalogFilters(new URLSearchParams(catalogSearch(expected))), expected);
  for (const query of ['speciesId=-1&page=0&status=unknown', 'speciesId=1&speciesId=2&page=1.5&status=toString',
    'speciesId=9007199254740992&page=1000001', `q=${'x'.repeat(101)}`, 'q=a&q=b']) {
    assert.deepEqual(readCatalogFilters(new URLSearchParams(query)), { q: '', speciesId: '', status: '', page: 1 });
  }
  assert.equal(catalogSearch(readCatalogFilters(new URLSearchParams('redirect=https://example.com&limit=1000'))), '');
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
