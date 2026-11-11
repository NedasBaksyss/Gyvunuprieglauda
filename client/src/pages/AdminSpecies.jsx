import { useRef, useState } from 'react';
import useAdminData from '../hooks/useAdminData.js';
import usePageHeading from '../hooks/usePageHeading.js';
import AdminDataState from '../components/AdminDataState.jsx';
import { apiRequest } from '../lib/api.js';

export default function AdminSpecies() {
  const heading = usePageHeading('Gyvūnų rūšys');
  const species = useAdminData('/api/admin/species');
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/api/admin/species${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body: { name: editor.name } });
      setEditor(null); setNotice('Rūšis išsaugota.'); species.retry();
    } catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Pašalinti rūšį „${item.name}“?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`/api/admin/species/${item.id}`, { method: 'DELETE' }); setNotice('Rūšis pašalinta.'); if (editor?.id === item.id) setEditor(null); species.retry(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">Gyvūnų rūšys</h1><button className="button" disabled={busy} onClick={() => { setEditor({ name: '' }); setError(''); }}>+ Pridėti rūšį</button></div>
    {notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {editor && <form className="admin-panel form-stack inline-editor" onSubmit={save}><h2>{editor.id ? 'Redaguoti rūšį' : 'Pridėti rūšį'}</h2><label>Pavadinimas *<input autoFocus required maxLength="80" value={editor.name} disabled={busy} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label><div className="form-actions"><button className="button" disabled={busy}>{busy ? 'Saugoma…' : 'Išsaugoti'}</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Atšaukti</button></div></form>}
    <section className="admin-panel"><AdminDataState request={species} />{species.data && <><div className="table-scroll"><table className="admin-table"><thead><tr><th>Pavadinimas</th><th>Gyvūnų skaičius</th><th>Veiksmai</th></tr></thead><tbody>{species.data.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.animalCount}</td><td><div className="table-actions"><button className="button button-secondary button-small" disabled={busy} onClick={() => { setEditor(item); setError(''); }}>Redaguoti</button><button className="button button-danger button-small" disabled={busy} onClick={() => remove(item)}>Trinti</button></div></td></tr>)}</tbody></table></div>{!species.data.items.length && <p className="empty-message">Rūšių dar nėra. Pridėkite pirmą rūšį.</p>}</>}</section>
  </>;
}
