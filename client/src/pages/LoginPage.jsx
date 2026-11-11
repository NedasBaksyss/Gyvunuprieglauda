import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth.jsx';
import usePageHeading from '../hooks/usePageHeading.js';
import Icon from '../components/Icon.jsx';

export default function LoginPage() {
  const auth = useAuth();
  const heading = usePageHeading(auth.user ? 'Mano paskyra' : 'Prisijungti');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try { await auth.login({ email: data.get('email'), password: data.get('password') }); form.reset(); }
    catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await auth.logout(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="container login-section">
    <div className="login-picture"><img src="/images/animals/lukas.webp" alt="" /><div><img src="/favicon.svg" alt="" /><h2>Gyvūnų prieglauda</h2><p>Kartu galime suteikti jiems<br />geresnį gyvenimą.</p></div></div>
    <div className="login-panel">
      <span className="eyebrow">Prieglaudos komanda</span>
      <h1 className="state-title" ref={heading} tabIndex="-1">{auth.user ? 'Mano paskyra' : <>Prisijungti<br />prie sistemos</>}</h1>
      {auth.loading ? <p role="status">Tikrinama sesija…</p> : auth.error ? <div role="alert"><p>{auth.error}</p><button className="button" onClick={() => auth.refresh()}>Bandyti dar kartą</button></div>
        : auth.user ? <div className="account-card"><p><strong>{auth.user.name}</strong><br />{auth.user.email}</p><span className="status-badge status-available">{auth.user.role === 'admin' ? 'Administratorius' : 'Darbuotojas'}</span><button className="button" disabled={busy} onClick={logout}>{busy ? 'Atsijungiama…' : 'Atsijungti'}</button></div>
          : <form onSubmit={submit} className="form-stack">
            <label>El. paštas<input type="email" name="email" autoComplete="username" required maxLength="254" placeholder="vardas@prieglauda.lt" disabled={busy} /></label>
            <label>Slaptažodis<span className="password-field"><input type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" required maxLength="128" placeholder="Įveskite slaptažodį" disabled={busy} />
              <button type="button" aria-label={visible ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį'} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name="eye" /></button></span></label>
            <button className="button" type="submit" disabled={busy}>{busy ? 'Jungiamasi…' : 'Prisijungti'}</button>
          </form>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Link className="text-link" to="/#gyvunai"><Icon name="chevron" className="flip-icon" size={16} />Grįžti į gyvūnų sąrašą</Link>
    </div>
  </section>;
}
