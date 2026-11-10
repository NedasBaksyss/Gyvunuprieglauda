const pluralRules = new Intl.PluralRules('lt');

export const statusLabels = {
  available: 'Ieško namų',
  reserved: 'Rezervuotas',
  adopted: 'Priglaustas',
};

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
