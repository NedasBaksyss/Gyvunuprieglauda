import { HttpError } from './http-error.js';
export function objectBody(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new HttpError(400, 'Neteisingi formos laukai.');
  return value;
}
export function text(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${label}: įveskite nuo 1 iki ${max} simbolių.`);
  return value.trim();
}
export function integer(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, `${label}: įveskite sveikąjį skaičių nuo ${min} iki ${max}.`);
  return value;
}
export function id(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Neteisingas ID.');
  return integer(Number(value), 'ID');
}
export function choice(value, choices, label) {
  if (!choices.includes(value)) throw new HttpError(400, `${label}: netinkama reikšmė.`);
  return value;
}
