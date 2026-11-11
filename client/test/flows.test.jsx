// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

const animal = { id: 1, name: 'Lukas', species: { id: 1, name: 'Šuo' }, ageMonths: 36, size: 'medium', status: 'available', description: 'Draugiškas šuo.', photoUrl: null };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('Lankytojas iš gyvūno puslapio pateikia vieną užklausą ir gauna patvirtinimą', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  let submitted;
  const fetchMock = vi.fn(async (url, options) => {
    if (url === '/api/auth/me') return response({}, 401);
    if (url === '/api/animals/1') return response({ animal });
    if (url === '/api/inquiries') { submitted = JSON.parse(options.body); return response({ message: 'Gauta.' }, 201); }
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter initialEntries={['/gyvunai/1?speciesId=1']}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link', { name: 'Noriu priglausti' }));
  await screen.findByRole('heading', { name: 'Užklausa dėl gyvūno priglaudimo' });
  fireEvent.change(screen.getByLabelText('Jūsų vardas *'), { target: { value: 'Tomas' } });
  fireEvent.change(screen.getByLabelText('El. paštas *'), { target: { value: 'tomas@example.com' } });
  fireEvent.change(screen.getByLabelText('Žinutė *'), { target: { value: 'Norėčiau susipažinti.' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Priglaudimo užklausa' }));
  await screen.findByRole('heading', { name: 'Užklausa gauta' });
  expect(submitted).toEqual({ animalId: 1, name: 'Tomas', email: 'tomas@example.com', message: 'Norėčiau susipažinti.' });
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/inquiries')).toHaveLength(1);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Užklausa gauta' }));
});

test('Darbuotojui nerodomas vartotojų meniu ir tiesioginė nuoroda nesuteikia prieigos', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  const fetchMock = vi.fn(async () => response({ user: { id: 1, name: 'Tomas', email: 'tomas@example.com', role: 'employee' } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter initialEntries={['/admin/vartotojai']}><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Nepakanka teisių' });
  expect(screen.queryByRole('link', { name: 'Vartotojai' })).toBeNull();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/me']);
});
