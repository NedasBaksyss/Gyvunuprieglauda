import { useRef, useState } from 'react';
import useAdminData from '../hooks/useAdminData.js';
import useAuth from '../hooks/useAuth.jsx';
import usePageHeading from '../hooks/usePageHeading.js';
import AdminDataState from '../components/AdminDataState.jsx';
import { apiRequest } from '../lib/api.js';

const roles = { admin: 'Administratorius', employee: 'Darbuotojas' };
export default function AdminUsers() {
  const auth = useAuth();
  const heading = usePageHeading('Vartotojai');
  const users = useAdminData('/api/admin/users');
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    const body = { name: editor.name, email: editor.email, role: editor.role, ...(editor.id ? { isActive: editor.isActive } : {}), ...(editor.password ? { password: editor.password } : {}) };
    try {
      await apiRequest(`/api/admin/users${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body });
      const own = editor.id === auth.user.id;
      setEditor(null); setNotice('Vartotojas išsaugotas.'); users.retry(); if (own) auth.refresh();
    } catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }
  async function remove(user) {
    if (!window.confirm(`Pašalinti vartotoją „${user.name}“?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`/api/admin/users/${user.id}`, { method: 'DELETE' }); setNotice('Vartotojas pašalintas.'); if (editor?.id === user.id) setEditor(null); users.retry(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  const field = (name) => ({ value: editor[name], onChange: (event) => setEditor({ ...editor, [name]: event.target.value }) });
  return <><div className="admin-page-heading"><h1 ref={heading} tabIndex="-1">Vartotojai</h1><button className="button" disabled={busy} onClick={() => { setEditor({ name: '', email: '', role: 'employee', password: '', isActive: true }); setError(''); }}>+ Pridėti vartotoją</button></div>
    {notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {editor && <form className="admin-panel form-stack inline-editor" onSubmit={save}><h2>{editor.id ? 'Redaguoti vartotoją' : 'Naujas vartotojas'}</h2><fieldset disabled={busy}><div className="form-grid">
      <label>Vardas *<input required maxLength="100" autoFocus {...field('name')} /></label><label>El. paštas *<input type="email" required maxLength="254" autoComplete="off" {...field('email')} /></label>
      <label>Rolė *<select {...field('role')}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>{editor.id ? 'Naujas slaptažodis' : 'Slaptažodis *'}<input type="password" required={!editor.id} minLength="12" maxLength="128" autoComplete="new-password" {...field('password')} /><small>{editor.id ? 'Palikite tuščią, jei nekeičiate.' : 'Nuo 12 iki 128 simbolių.'}</small></label>
      {editor.id && <label className="checkbox-field"><input type="checkbox" checked={editor.isActive} onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })} />Aktyvi paskyra</label>}
    </div><div className="form-actions"><button className="button">{busy ? 'Saugoma…' : 'Išsaugoti'}</button><button className="button button-secondary" type="button" onClick={() => setEditor(null)}>Atšaukti</button></div></fieldset></form>}
    <section className="admin-panel"><AdminDataState request={users} />{users.data && <div className="table-scroll"><table className="admin-table"><thead><tr><th>Vardas</th><th>El. paštas</th><th>Rolė</th><th>Būsena</th><th>Veiksmai</th></tr></thead><tbody>{users.data.items.map((user) => <tr key={user.id}><td><strong>{user.name}</strong>{user.id === auth.user.id && ' (jūs)'}</td><td>{user.email}</td><td>{roles[user.role]}</td><td><span className={`status-badge ${user.isActive ? 'status-available' : 'status-adopted'}`}>{user.isActive ? 'Aktyvus' : 'Neaktyvus'}</span></td><td><div className="table-actions"><button className="button button-secondary button-small" disabled={busy} onClick={() => { setEditor({ ...user, password: '' }); setError(''); }}>Redaguoti</button><button className="button button-danger button-small" disabled={busy || user.id === auth.user.id} onClick={() => remove(user)}>Trinti</button></div></td></tr>)}</tbody></table></div>}</section>
  </>;
}
