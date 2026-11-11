import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import useAdminData from '../hooks/useAdminData.js';
import usePageHeading from '../hooks/usePageHeading.js';
import AdminDataState from '../components/AdminDataState.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDate, inquiryClasses, inquiryStatuses } from '../lib/inquiries.js';

export default function AdminInquiries() {
  const heading = usePageHeading('Priglaudimo užklausos');
  const location = useLocation();
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useAdminData(`/api/admin/inquiries?${new URLSearchParams({ status, page: String(page) })}`);
  async function remove(inquiry) {
    if (!window.confirm(`Pašalinti ${inquiry.name} užklausą dėl ${inquiry.animal.name}?`)) return;
    setBusy(true); setError('');
    try { await apiRequest(`/api/admin/inquiries/${inquiry.id}`, { method: 'DELETE' }); request.retry(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">Užklausos</h1></div>{location.state?.notice && <p className="success-message" role="status">{location.state.notice}</p>}
    <section className="admin-panel"><div className="admin-filters"><label className="sr-only" htmlFor="inquiry-status">Užklausos būsena</label><select id="inquiry-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Visos būsenos</option>{Object.entries(inquiryStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <AdminDataState request={request} />{error && <p className="form-error" role="alert">{error}</p>}
      {request.data && <><div className="table-scroll"><table className="admin-table"><thead><tr><th>Vardas</th><th>Gyvūnas</th><th>Data</th><th>Būsena</th><th>Veiksmai</th></tr></thead><tbody>{request.data.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><Link className="text-link" to={`/gyvunai/${item.animal.id}`}>{item.animal.name}</Link></td><td>{formatDate(item.createdAt)}</td><td><span className={`status-badge ${inquiryClasses[item.status]}`}>{inquiryStatuses[item.status]}</span></td><td><div className="table-actions"><Link className="button button-secondary button-small" to={`/admin/uzklausos/${item.id}`}>Peržiūrėti / redaguoti</Link><button className="button button-danger button-small" disabled={busy} onClick={() => remove(item)}>Trinti</button></div></td></tr>)}</tbody></table></div>
        {!request.data.items.length && <p className="empty-message">Užklausų nerasta.{page > 1 && <button className="page-button" onClick={() => setPage(1)}>Grįžti į pirmą puslapį</button>}</p>}
        <div className="pagination"><button className="page-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Ankstesnis</button><span>Puslapis {page} · Iš viso {request.data.pagination.total}</span><button className="page-button" disabled={page >= request.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Kitas</button></div></>}
    </section></>;
}

export function InquiryEditor() {
  const { id } = useParams(); const request = useAdminData(`/api/admin/inquiries/${id}`);
  const heading = usePageHeading('Užklausos peržiūra');
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">Užklausos peržiūra</h1></div><AdminDataState request={request} />{request.data && <EditForm key={id} inquiry={request.data.inquiry} />}</>;
}
function EditForm({ inquiry }) {
  const navigate = useNavigate(); const pending = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    const body = Object.fromEntries(new FormData(event.currentTarget)); pending.current = true; setBusy(true); setError('');
    try { await apiRequest(`/api/admin/inquiries/${inquiry.id}`, { method: 'PUT', body }); navigate('/admin/uzklausos', { state: { notice: 'Užklausa išsaugota.' } }); }
    catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }
  return <form className="admin-panel form-stack admin-form" onSubmit={save}><h2>Dėl <Link className="text-link" to={`/gyvunai/${inquiry.animal.id}`}>{inquiry.animal.name}</Link></h2><p>Gauta {formatDate(inquiry.createdAt)}</p>
    <fieldset disabled={busy}><div className="form-grid"><label>Vardas *<input name="name" required maxLength="100" defaultValue={inquiry.name} /></label><label>El. paštas *<input type="email" name="email" required maxLength="254" defaultValue={inquiry.email} /></label>
      <label>Būsena *<select name="status" defaultValue={inquiry.status}>{Object.entries(inquiryStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="full-width">Žinutė *<textarea name="message" required maxLength="5000" rows="7" defaultValue={inquiry.message} /></label></div>
      <div className="form-actions"><button className="button">{busy ? 'Saugoma…' : 'Išsaugoti'}</button><Link className="button button-secondary" to="/admin/uzklausos">Atšaukti</Link></div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
