const pluralRules = new Intl.PluralRules('lt');

export const statusLabels = {
  available: 'Ieško namų',
  reserved: 'Rezervuotas',
  adopted: 'Priglaustas',
};

export const sizeLabels = { small: 'Mažas', medium: 'Vidutinis', large: 'Didelis' };

export function isPositiveId(value) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

// Only supported, valid filters reach the API or the return link.
export function readCatalogFilters(params) {
  const single = (name) => params.getAll(name).length === 1 ? params.get(name) : '';
  const q = single('q').trim();
  const speciesId = single('speciesId');
  const status = single('status');
  const page = single('page');
  return {
    q: q.length <= 100 ? q : '',
    speciesId: isPositiveId(speciesId) ? speciesId : '',
    status: Object.hasOwn(statusLabels, status) ? status : '',
    page: isPositiveId(page) && Number(page) <= 1000000 ? Number(page) : 1,
  };
}

export function catalogSearch({ q = '', speciesId = '', status = '', page = 1 }) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (speciesId) params.set('speciesId', speciesId);
  if (status) params.set('status', status);
  if (page > 1) params.set('page', String(page));
  return params.size ? `?${params}` : '';
}

export function formatAge(ageMonths) {
  if (ageMonths === 0) return 'Iki 1 mėnesio';
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (years && months) return `${years} m. ${months} mėn.`;
  if (years) return `${years} ${['one', 'few'].includes(pluralRules.select(years)) ? 'metai' : 'metų'}`;
  const monthWords = { one: 'mėnuo', few: 'mėnesiai', other: 'mėnesių' };
  return `${months} ${monthWords[pluralRules.select(months)] || 'mėnesių'}`;
}

export function catalogUrl({ q = '', speciesId = '', status = '', page = 1 }) {
  const params = new URLSearchParams({ page: String(page), limit: '12' });
  if (q.trim()) params.set('q', q.trim());
  if (speciesId) params.set('speciesId', speciesId);
  if (status) params.set('status', status);
  return `/api/animals?${params}`;
}
