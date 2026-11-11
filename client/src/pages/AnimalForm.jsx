import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAdminData from '../hooks/useAdminData.js';
import usePageHeading from '../hooks/usePageHeading.js';
import AdminDataState from '../components/AdminDataState.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import { apiRequest } from '../lib/api.js';
import { sizeLabels, statusLabels } from '../lib/catalog.js';

export default function AnimalForm() {
  const { id } = useParams();
  const animal = useAdminData(id ? `/api/admin/animals/${id}` : null);
  const species = useAdminData('/api/admin/species');
  const heading = usePageHeading(id ? 'Redaguoti gyvūną' : 'Pridėti gyvūną');
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">{id ? 'Redaguoti gyvūną' : 'Pridėti naują gyvūną'}</h1></div><AdminDataState request={animal} /><AdminDataState request={species} />
    {species.data && (!id || animal.data) && <Editor key={id || 'new'} animal={animal.data?.animal} species={species.data.items} />}</>;
}

function Editor({ animal, species }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form);
    body.ageMonths = Number(body.ageMonths); body.speciesId = Number(body.speciesId);
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await apiRequest(`/api/admin/animals${animal ? `/${animal.id}` : ''}`, { method: animal ? 'PUT' : 'POST', body });
      navigate(animal ? '/admin/gyvunai' : `/admin/gyvunai/${result.animal.id}`, { state: { notice: 'Gyvūno duomenys išsaugoti.' } });
    }
    catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }
  return <><form className="admin-panel form-stack admin-form" onSubmit={submit}><fieldset disabled={busy}><div className="form-grid">
    <label>Vardas *<input name="name" required maxLength="100" defaultValue={animal?.name} /></label>
    <label>Rūšis *<select name="speciesId" required defaultValue={animal?.species.id || ''}><option value="">Pasirinkite rūšį</option>{species.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Amžius mėnesiais *<input name="ageMonths" type="number" required min="0" max="1200" step="1" defaultValue={animal?.ageMonths ?? 0} /></label>
    <label>Dydis *<select name="size" defaultValue={animal?.size || 'medium'}>{Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Būsena *<select name="status" defaultValue={animal?.status || 'available'}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="full-width">Aprašymas *<textarea name="description" required maxLength="5000" rows="6" defaultValue={animal?.description} /></label>
  </div><div className="form-actions"><button className="button" disabled={!species.length} type="submit">{busy ? 'Saugoma…' : 'Išsaugoti'}</button><Link className="button button-secondary" to="/admin/gyvunai">Atšaukti</Link></div></fieldset>{!animal && <p>Nuotrauką galėsite pridėti išsaugoję gyvūno duomenis.</p>}{!species.length && <p role="alert">Pirmiausia administratorius turi sukurti gyvūno rūšį.</p>}{error && <p className="form-error" role="alert">{error}</p>}</form>{animal && <PhotoUpload animal={animal} />}</>;
}
