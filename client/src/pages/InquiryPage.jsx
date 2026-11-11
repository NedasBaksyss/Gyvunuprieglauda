import { useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import useJson from '../hooks/useJson.js';
import usePageHeading from '../hooks/usePageHeading.js';
import { apiRequest } from '../lib/api.js';
import { catalogSearch, formatAge, isPositiveId, readCatalogFilters } from '../lib/catalog.js';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import NotFoundPage from './NotFoundPage.jsx';

export default function InquiryPage() {
  const { id } = useParams();
  return isPositiveId(id) ? <LoadInquiry key={id} id={id} /> : <NotFoundPage animal />;
}
function LoadInquiry({ id }) {
  const request = useJson(`/api/animals/${id}`);
  if (request.status === 404) return <NotFoundPage animal />;
  if (request.loading) return <div className="container page-state"><p role="status">Kraunama gyvūno informacija…</p></div>;
  if (request.error) return <div className="container page-state"><p role="alert">{request.error}</p><button className="button" onClick={request.retry}>Bandyti dar kartą</button></div>;
  return <InquiryForm animal={request.data.animal} />;
}
function InquiryForm({ animal }) {
  const { search } = useLocation();
  const back = `/gyvunai/${animal.id}${catalogSearch(readCatalogFilters(new URLSearchParams(search)))}`;
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pending = useRef(false);
  const heading = usePageHeading(done ? 'Užklausa gauta' : `Užklausa dėl gyvūno priglaudimo`);
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    const body = { ...Object.fromEntries(new FormData(event.currentTarget)), animalId: animal.id };
    pending.current = true; setBusy(true); setError('');
    try { await apiRequest('/api/inquiries', { method: 'POST', body }); setDone(true); }
    catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }
  return <section className="container inquiry-page"><nav className="breadcrumbs" aria-label="Puslapio kelias"><ol><li><Link to="/">Pradžia</Link></li><li><Link to={back}>{animal.name}</Link></li><li aria-current="page">Užklausa</li></ol></nav>
    <div className="inquiry-card"><span className="eyebrow">Naujos draugystės pradžia</span><h1 className="state-title" ref={heading} tabIndex="-1">{done ? 'Užklausa gauta' : 'Užklausa dėl gyvūno priglaudimo'}</h1>
      {done ? <div role="status"><p>Ačiū! Prieglaudos komanda su jumis susisieks nurodytu el. paštu.</p><Link className="button" to="/#gyvunai">Grįžti į gyvūnų sąrašą</Link></div>
        : <><div className="inquiry-animal"><div><AnimalPhoto animal={animal} loading="eager" /></div><p><strong>{animal.name}</strong><span>{animal.species.name} · {formatAge(animal.ageMonths)}</span></p></div>
          {animal.status !== 'available' ? <p role="alert" className="form-error">Šis gyvūnas šiuo metu neieško namų. Pasirinkite kitą globotinį.</p> : <form className="form-stack" aria-label="Priglaudimo užklausa" onSubmit={submit}><fieldset disabled={busy}>
            <label>Jūsų vardas *<input name="name" required maxLength="100" autoComplete="name" placeholder="Įveskite vardą" /></label>
            <label>El. paštas *<input name="email" type="email" required maxLength="254" autoComplete="email" placeholder="vardas@pastas.lt" /></label>
            <label>Žinutė *<textarea name="message" required maxLength="5000" rows="5" placeholder="Papasakokite, kodėl norite priglausti šį gyvūną…" /></label>
            <p className="privacy-note">El. paštą naudosime susisiekti dėl šios užklausos.</p><button className="button" type="submit">{busy ? 'Siunčiama…' : 'Pateikti užklausą'}</button>
          </fieldset></form>}{error && <p className="form-error" role="alert">{error}</p>}<Link className="text-link" to={back}>Grįžti prie gyvūno</Link></>}
    </div></section>;
}
