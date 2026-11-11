// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App.jsx';
import useJson from '../src/hooks/useJson.js';

const species = [{ id: 1, name: 'Šuo', animalCount: 1 }, { id: 2, name: 'Katė', animalCount: 2 }];
const animals = [
  { id: 1, name: 'Lukas', species: species[0], ageMonths: 36, size: 'medium', description: 'Draugiškas ir aktyvus šuo.\nMėgsta ilgus pasivaikščiojimus.', status: 'available', photoUrl: '/images/animals/lukas.webp' },
  { id: 2, name: 'Mėja', species: species[1], ageMonths: 24, size: 'small', description: 'Rami ir smalsi katė.', status: 'available', photoUrl: '/images/animals/meja.webp' },
  { id: 3, name: 'Pūkas', species: species[1], ageMonths: 48, size: 'medium', description: 'Jau gyvena naujuose namuose.', status: 'adopted', photoUrl: null },
];

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const page = (items, number = 1, total = items.length) => ({ items, pagination: { page: number, limit: 12, total, totalPages: Math.ceil(total / 12) } });
let fetchMock;

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <div>
    <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => navigate(-1)}>Atgal istorijoje</button>
    <button onClick={() => navigate(1)}>Pirmyn istorijoje</button>
  </div>;
}

function renderApp(initialEntries = ['/'], withHistory = false) {
  return render(<MemoryRouter initialEntries={initialEntries}><App />{withHistory && <NavigationProbe />}</MemoryRouter>);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock = vi.fn(async (url) => {
    if (url === '/api/species') return response({ items: species });
    if (url.startsWith('/api/animals/')) {
      const animal = animals.find((item) => item.id === Number(url.split('/').at(-1)));
      return response({ animal }, animal ? 200 : 404);
    }
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
  renderApp();
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
  renderApp();
  await screen.findByRole('heading', { name: 'Lukas' });
  fireEvent.change(screen.getByLabelText('Gyvūno rūšis'), { target: { value: '1' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Rasti gyvūną pagal rūšį' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.getByLabelText('Rūšis').value).toBe('1');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mūsų gyvūnai' }));
});

test('Tuščios paieškos rezultatas leidžia grįžti į visą sąrašą', async () => {
  renderApp();
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
  renderApp();
  await screen.findByRole('heading', { name: 'Nepavyko įkelti gyvūnų' });
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
  await screen.findByRole('heading', { name: 'Lukas' });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Širdutė išlieka per naują puslapio atvėrimą, sugadintas saugojimas nesugriauna vaizdo', async () => {
  localStorage.setItem('shelter:favorites', 'broken JSON');
  const first = renderApp();
  fireEvent.click(await screen.findByRole('button', { name: 'Pažymėti: Mėja' }));
  expect(screen.getByRole('button', { name: 'Pašalinti pažymėjimą: Mėja' }).getAttribute('aria-pressed')).toBe('true');
  expect(JSON.parse(localStorage.getItem('shelter:favorites'))).toEqual([2]);
  first.unmount();
  renderApp();
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
  renderApp();
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
  renderApp();
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
  renderApp();
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

test('Tiesioginė gyvūno nuoroda rodo jo duomenis, antraštę ir pasiekiamą fokusą', async () => {
  renderApp(['/gyvunai/1']);
  const heading = await screen.findByRole('heading', { name: 'Lukas', level: 1 });
  expect(screen.getByText('3 metai')).toBeTruthy();
  expect(screen.getByText('Vidutinis')).toBeTruthy();
  expect(screen.getByText(/Draugiškas ir aktyvus šuo/).textContent).toBe(animals[0].description);
  expect(screen.getByRole('img', { name: 'Lukas – šuo' }).getAttribute('src')).toBe(animals[0].photoUrl);
  expect(document.title).toBe('Lukas | Gyvūnų prieglauda');
  expect(document.activeElement).toBe(heading);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/animals/1']);
});

test('Nuoroda iš filtruoto antro puslapio ir grįžimas išsaugo visus filtrus', async () => {
  const originalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (url, options) => {
    if (url.startsWith('/api/animals?')) return response(page([animals[1]], 2, 13));
    return originalFetch(url, options);
  });
  const query = '?q=meja&speciesId=2&status=available&page=2';
  renderApp([`/${query}#gyvunai`], true);
  const photoLink = await screen.findByRole('link', { name: 'Peržiūrėti: Mėja' });
  expect(photoLink.getAttribute('href')).toBe(`/gyvunai/2${query}`);
  expect(screen.getByRole('link', { name: 'Mėja' }).getAttribute('href')).toBe(`/gyvunai/2${query}`);
  fireEvent.click(photoLink);
  await screen.findByRole('heading', { name: 'Mėja', level: 1 });
  fireEvent.click(screen.getByRole('link', { name: 'Grįžti į gyvūnų sąrašą' }));
  await screen.findByRole('heading', { name: 'Mėja', level: 3 });
  expect(screen.getByTestId('location').textContent).toBe(`/${query}#gyvunai`);
  expect(screen.getByRole('searchbox').value).toBe('meja');
  expect(screen.getByLabelText('Rūšis').value).toBe('2');
  expect(screen.getByLabelText('Būsena').value).toBe('available');
  expect(screen.getByRole('button', { name: 'Kitas' }).disabled).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mūsų gyvūnai' }));
});

test('Istorijos atgal ir pirmyn veiksmai atkuria katalogą ir gyvūną', async () => {
  renderApp(['/?speciesId=2'], true);
  fireEvent.click(await screen.findByRole('link', { name: 'Mėja' }));
  await screen.findByRole('heading', { name: 'Mėja', level: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Atgal istorijoje' }));
  await screen.findByRole('heading', { name: 'Mėja', level: 3 });
  expect(screen.getByLabelText('Rūšis').value).toBe('2');
  expect(screen.queryByRole('heading', { name: 'Lukas' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Pirmyn istorijoje' }));
  await screen.findByRole('heading', { name: 'Mėja', level: 1 });
  expect(screen.getByTestId('location').textContent).toBe('/gyvunai/2?speciesId=2');
});

test('Pažymėjimas bendras abiem puslapiams net kai naršyklė neleidžia saugoti', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  renderApp();
  fireEvent.click(await screen.findByRole('button', { name: 'Pažymėti: Mėja' }));
  expect(screen.queryByRole('heading', { name: 'Mėja', level: 1 })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mėja' }));
  const favorite = await screen.findByRole('button', { name: 'Pašalinti pažymėjimą: Mėja' });
  expect(favorite.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(favorite);
  fireEvent.click(screen.getByRole('link', { name: 'Grįžti į gyvūnų sąrašą' }));
  expect((await screen.findByRole('button', { name: 'Pažymėti: Mėja' })).getAttribute('aria-pressed')).toBe('false');
});

test('Nerastas įrašas išlaiko grįžimo filtrus, o klaidingas adresas nekviečia API', async () => {
  const first = renderApp(['/gyvunai/999?speciesId=2']);
  await screen.findByRole('heading', { name: 'Gyvūnas nerastas' });
  expect(screen.queryByRole('button', { name: 'Bandyti dar kartą' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Grįžti į gyvūnų sąrašą' }).getAttribute('href')).toBe('/?speciesId=2#gyvunai');
  first.unmount();
  fetchMock.mockClear();
  const second = renderApp(['/gyvunai/neteisingas']);
  expect(screen.getByRole('heading', { name: 'Gyvūnas nerastas' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  second.unmount();
  renderApp(['/nezinomas-puslapis']);
  expect(screen.getByRole('heading', { name: 'Puslapis nerastas' })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('Serverio klaida nesupainiojama su 404 ir leidžia pakartoti užklausą', async () => {
  fetchMock.mockResolvedValueOnce(response({ message: 'Klaida' }, 500));
  renderApp(['/gyvunai/1']);
  await screen.findByRole('heading', { name: 'Nepavyko įkelti gyvūno' });
  expect(screen.queryByRole('heading', { name: 'Gyvūnas nerastas' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
  await screen.findByRole('heading', { name: 'Lukas', level: 1 });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Priglausto gyvūno būsena ir trūkstama nuotrauka pateikiamos aiškiai', async () => {
  renderApp(['/gyvunai/3']);
  await screen.findByRole('heading', { name: 'Pūkas', level: 1 });
  expect(screen.getByText('Priglaustas')).toBeTruthy();
  expect(screen.getByText(/Jau rado savo namus/)).toBeTruthy();
  expect(screen.getByText('Nuotrauka ruošiama')).toBeTruthy();
});

test('Meniu iš gyvūno puslapio nuveda į pradžios skiltį ir išlaiko filtrą', async () => {
  renderApp(['/gyvunai/2?speciesId=2']);
  await screen.findByRole('heading', { name: 'Mėja', level: 1 });
  fireEvent.click(screen.getByRole('link', { name: 'Apie mus' }));
  await screen.findByRole('heading', { name: 'Mėja', level: 3 });
  expect(screen.getByLabelText('Rūšis').value).toBe('2');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Kol atsiras namai/ }));
});

test('Filtruojant katalogas nešokinėja, o pakartotinė meniu nuoroda grąžina fokusą', async () => {
  renderApp(['/#gyvunai'], true);
  await screen.findByRole('heading', { name: 'Lukas' });
  const speciesFilter = screen.getByLabelText('Rūšis');
  speciesFilter.focus();
  Element.prototype.scrollIntoView.mockClear();
  fireEvent.change(speciesFilter, { target: { value: '2' } });
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(document.activeElement).toBe(speciesFilter);
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  expect(screen.getByTestId('location').textContent).toBe('/?speciesId=2#gyvunai');
  fireEvent.click(screen.getByRole('link', { name: 'Gyvūnai' }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mūsų gyvūnai' }));
});
