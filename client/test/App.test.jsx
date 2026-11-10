// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';
import useJson from '../src/hooks/useJson.js';

const species = [{ id: 1, name: 'Šuo', animalCount: 1 }, { id: 2, name: 'Katė', animalCount: 2 }];
const animals = [
  { id: 1, name: 'Lukas', species: species[0], ageMonths: 36, status: 'available', photoUrl: '/images/animals/lukas.webp' },
  { id: 2, name: 'Mėja', species: species[1], ageMonths: 24, status: 'available', photoUrl: '/images/animals/meja.webp' },
  { id: 3, name: 'Pūkas', species: species[1], ageMonths: 48, status: 'adopted', photoUrl: null },
];

const response = (data) => ({ ok: true, json: async () => data });
const page = (items, number = 1, total = items.length) => ({ items, pagination: { page: number, limit: 12, total, totalPages: Math.ceil(total / 12) } });
let fetchMock;

beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock = vi.fn(async (url) => {
    if (url === '/api/species') return response({ items: species });
    const params = new URL(url, 'http://localhost').searchParams;
    let items = animals;
    if (params.has('speciesId')) items = items.filter((animal) => String(animal.species.id) === params.get('speciesId'));
    if (params.has('status')) items = items.filter((animal) => animal.status === params.get('status'));
    if (params.has('q')) items = params.get('q') === 'meja' ? [animals[1]] : [];
    return response(page(items));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('Lankytojas gali derinti filtrus, juos išvalyti ir ieškoti pagal vardą', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Lukas' });
  expect(screen.getAllByRole('article')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Rūšis'), { target: { value: '2' } });
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.queryByRole('heading', { name: 'Lukas' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Būsena'), { target: { value: 'adopted' } });
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.getByRole('heading', { name: 'Pūkas' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Išvalyti filtrus' }));
  await screen.findByRole('heading', { name: 'Lukas' });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'meja' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.getByRole('heading', { name: 'Mėja' })).toBeTruthy();
});

test('Pradžios juostos paieška pritaiko rūšį ir perkelia fokusą į katalogą', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Lukas' });
  fireEvent.change(screen.getByLabelText('Gyvūno rūšis'), { target: { value: '1' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Rasti gyvūną pagal rūšį' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.getByLabelText('Rūšis').value).toBe('1');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mūsų gyvūnai' }));
});

test('Tuščios paieškos rezultatas leidžia grįžti į visą sąrašą', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Lukas' });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nerandamas' } });
  fireEvent.submit(screen.getByRole('search'));
  await screen.findByRole('heading', { name: 'Tokio draugo kol kas neradome' });
  fireEvent.click(screen.getByRole('button', { name: 'Rodyti visus gyvūnus' }));
  await screen.findByRole('heading', { name: 'Lukas' });
  expect(screen.getByRole('searchbox').value).toBe('');
  expect(screen.getAllByRole('article')).toHaveLength(3);
});

test('Po tinklo klaidos pakartojimo mygtukas vėl užkrauna katalogą', async () => {
  let fail = true;
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/species') return response({ items: species });
    if (fail) throw new Error('Network error');
    return response(page(animals));
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Nepavyko įkelti gyvūnų' });
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
  await screen.findByRole('heading', { name: 'Lukas' });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Širdutė išlieka per naują puslapio atvėrimą, sugadintas saugojimas nesugriauna vaizdo', async () => {
  localStorage.setItem('shelter:favorites', 'broken JSON');
  const first = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pažymėti: Mėja' }));
  expect(screen.getByRole('button', { name: 'Pašalinti pažymėjimą: Mėja' }).getAttribute('aria-pressed')).toBe('true');
  expect(JSON.parse(localStorage.getItem('shelter:favorites'))).toEqual([2]);
  first.unmount();
  render(<App />);
  const saved = await screen.findByRole('button', { name: 'Pašalinti pažymėjimą: Mėja' });
  expect(saved.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(saved);
  expect(JSON.parse(localStorage.getItem('shelter:favorites'))).toEqual([]);
});

test('Puslapiavimas rodo kitą puslapį, o filtras grąžina į pirmą', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/species') return response({ items: species });
    const params = new URL(url, 'http://localhost').searchParams;
    if (params.has('speciesId')) return response(page([animals[1]]));
    if (params.get('page') === '2') return response(page([{ ...animals[0], id: 13, name: 'Tryliktas' }], 2, 13));
    return response(page(Array.from({ length: 12 }, (_, index) => ({ ...animals[0], id: index + 1, name: `Gyvūnas ${index + 1}` })), 1, 13));
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Gyvūnas 1' });
  expect(screen.getByRole('button', { name: 'Ankstesnis' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Kitas' }));
  await screen.findByRole('heading', { name: 'Tryliktas' });
  expect(screen.getByRole('button', { name: 'Kitas' }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Rūšis'), { target: { value: '2' } });
  await screen.findByRole('heading', { name: 'Mėja' });
  const lastRequest = fetchMock.mock.calls.at(-1)[0];
  expect(new URL(lastRequest, 'http://localhost').searchParams.get('page')).toBe('1');
});

test('Neįkelta nuotrauka pakeičiama aiškiu pakaitiniu vaizdu', async () => {
  render(<App />);
  const photo = await screen.findByRole('img', { name: 'Lukas – šuo' });
  fireEvent.error(photo);
  expect(screen.queryByRole('img', { name: 'Lukas – šuo' })).toBeNull();
  expect(screen.getAllByText('Nuotrauka ruošiama')).toHaveLength(2);
});

test('Sumažėjus sąrašui lankytojas neužstringa ištuštėjusiame puslapyje', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url === '/api/species') return response({ items: species });
    const params = new URL(url, 'http://localhost').searchParams;
    return response(params.get('page') === '2' ? page([], 2, 1) : page(animals, 1, 13));
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Lukas' });
  fireEvent.click(screen.getByRole('button', { name: 'Kitas' }));
  await screen.findByRole('heading', { name: 'Šiame puslapyje gyvūnų nebėra' });
  fireEvent.click(screen.getByRole('button', { name: 'Grįžti į pirmą puslapį' }));
  await screen.findByRole('heading', { name: 'Lukas' });
});

test('Pavėluotas senas atsakymas nepakeičia naujausios paieškos rezultatų', async () => {
  let resolveOld;
  let oldSignal;
  fetchMock.mockImplementation((url, options) => {
    if (url === '/slow') {
      oldSignal = options.signal;
      return new Promise((resolve) => { resolveOld = resolve; });
    }
    return Promise.resolve(response({ value: 'new' }));
  });
  const hook = renderHook(({ url }) => useJson(url), { initialProps: { url: '/slow' } });
  hook.rerender({ url: '/fast' });
  await waitFor(() => expect(hook.result.current.data).toEqual({ value: 'new' }));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => resolveOld(response({ value: 'old' })));
  expect(hook.result.current.data).toEqual({ value: 'new' });
});
