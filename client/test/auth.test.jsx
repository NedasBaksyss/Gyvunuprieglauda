// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
const user = { id: 1, name: 'Administratorius', email: 'admin@example.com', role: 'admin' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
test('Neprisijungęs lankytojas nukreipiamas iš administravimo į prisijungimą', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: 'Prisijunkite.' }) })));
  render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
  await screen.findByLabelText('El. paštas');
  expect(screen.queryByRole('navigation', { name: 'Administravimo meniu' })).toBeNull();
});

test('Atkurta darbuotojo sesija leidžia pasiekti skydelį ir rodo jo prieigą', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { ...user, name: 'Tomas', role: 'employee' } }) })));
  render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Apžvalga' });
  expect(screen.getByText('Darbuotojas')).toBeTruthy();
  expect(screen.getByText(/Darbuotojas gali tvarkyti gyvūnus/)).toBeTruthy();
});
test('Prisijungimo klaida, slaptažodžio rodymas, sesija ir atsijungimas', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  let authenticated = false;
  let fail = true;
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url.endsWith('/login')) {
      expect(options.headers['X-Requested-With']).toBe('shelter-app');
      if (fail) return { ok: false, status: 401, json: async () => ({ message: 'Neteisingi duomenys.' }) };
      authenticated = true;
    }
    if (url.endsWith('/logout')) { authenticated = false; return { ok: true, status: 204 }; }
    return { ok: authenticated, status: authenticated ? 200 : 401, json: async () => ({ user }) };
  }));
  render(<MemoryRouter initialEntries={['/prisijungti']}><App /></MemoryRouter>);
  const email = await screen.findByLabelText('El. paštas');
  const password = screen.getByLabelText('Slaptažodis');
  fireEvent.change(email, { target: { value: user.email } });
  fireEvent.change(password, { target: { value: 'Slaptazodis-12345' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rodyti slaptažodį' }));
  expect(password.type).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Prisijungti' }));
  await screen.findByText('Neteisingi duomenys.');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Prisijungti' }));
  await screen.findByRole('heading', { name: 'Apžvalga' });
  fireEvent.click(screen.getByRole('link', { name: 'Mano paskyra' }));
  await screen.findByRole('heading', { name: 'Mano paskyra' });
  expect(screen.getByText(user.email)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Atsijungti' }));
  await screen.findByLabelText('El. paštas');
  await waitFor(() => expect(authenticated).toBe(false));
});
