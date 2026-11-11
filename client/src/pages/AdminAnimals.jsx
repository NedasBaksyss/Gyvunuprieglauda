import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAdminData from '../hooks/useAdminData.js';
import usePageHeading from '../hooks/usePageHeading.js';
import { apiRequest } from '../lib/api.js';
import { catalogUrl, formatAge, statusLabels } from '../lib/catalog.js';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import AdminDataState from '../components/AdminDataState.jsx';

export default function AdminAnimals() {
  const heading = usePageHeading('Gyvūnų valdymas');
  const location = useLocation();
  const [filters, setFilters] = useState({ q: '', speciesId: '', page: 1 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const animals = useAdminData(catalogUrl(filters).replace('/api/animals', '/api/admin/animals'));
  const species = useAdminData('/api/admin/species');
  async function remove(animal) {
    if (!window.confirm(`Pašalinti gyvūną „${animal.name}“?`)) return;
    setBusy(true); setError('');
    try { await apiRequest(`/api/admin/animals/${animal.id}`, { method: 'DELETE' }); animals.retry(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">Gyvūnai</h1><Link className="button" to="/admin/gyvunai/naujas">+ Pridėti gyvūną</Link></div>
    {location.state?.notice && <p className="success-message" role="status">{location.state.notice}</p>}
    <section className="admin-panel">
      <div className="admin-filters"><label className="sr-only" htmlFor="admin-species">Rūšis</label><select id="admin-species" value={filters.speciesId} onChange={(event) => setFilters({ ...filters, speciesId: event.target.value, page: 1 })}><option value="">Visos rūšys</option>{species.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label className="sr-only" htmlFor="admin-search">Ieškoti pagal vardą</label><input id="admin-search" type="search" maxLength="100" placeholder="Ieškoti pagal vardą…" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} /></div>
      <AdminDataState request={species} /><AdminDataState request={animals} />{error && <p className="form-error" role="alert">{error}</p>}
      {animals.data && <><div className="table-scroll"><table className="admin-table"><thead><tr><th>Nuotrauka</th><th>Vardas</th><th>Rūšis</th><th>Amžius</th><th>Būsena</th><th>Veiksmai</th></tr></thead><tbody>
        {animals.data.items.map((animal) => <tr key={animal.id}><td><div className="table-photo"><AnimalPhoto animal={animal} /></div></td><td><Link className="text-link" to={`/gyvunai/${animal.id}`}>{animal.name}</Link></td><td>{animal.species.name}</td><td>{formatAge(animal.ageMonths)}</td><td><span className={`status-badge status-${animal.status}`}>{statusLabels[animal.status]}</span></td><td><div className="table-actions"><Link className="button button-secondary button-small" to={`/admin/gyvunai/${animal.id}`}>Redaguoti</Link><button className="button button-danger button-small" disabled={busy} onClick={() => remove(animal)}>Trinti</button></div></td></tr>)}
      </tbody></table></div>{animals.data.items.length === 0 && <p className="empty-message">Gyvūnų nerasta.</p>}
      <div className="pagination"><button className="page-button" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Ankstesnis</button><span>Puslapis {filters.page} · Iš viso {animals.data.pagination.total}</span><button className="page-button" disabled={filters.page >= animals.data.pagination.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Kitas</button></div></>}
    </section></>;
}
