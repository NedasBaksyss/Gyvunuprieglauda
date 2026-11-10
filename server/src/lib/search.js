// SQLite NOCASE neapima visų lietuviškų raidžių.
export function normalizeSearch(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('lt');
}
