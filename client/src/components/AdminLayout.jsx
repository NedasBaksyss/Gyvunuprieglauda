import { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.jsx';
import Icon from './Icon.jsx';

export default function AdminLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (auth.loading) return <main className="container page-state"><p role="status">Tikrinama sesija…</p></main>;
  if (auth.error) return <main className="container page-state"><p role="alert">{auth.error}</p><button className="button" onClick={() => auth.refresh()}>Bandyti dar kartą</button></main>;
  if (!auth.user) return <Navigate to="/prisijungti" replace state={{ from: location.pathname + location.search }} />;
  async function logout() {
    setBusy(true); setError('');
    try { await auth.logout(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-content">Pereiti prie turinio</a>
    <aside className="admin-sidebar">
      <Link className="brand" to="/"><img src="/favicon.svg" alt="" />Gyvūnų prieglauda</Link>
      <nav aria-label="Administravimo meniu">
        <NavLink to="/admin" end><Icon name="home" />Apžvalga</NavLink>
        <Link to="/prisijungti"><Icon name="user" />Mano paskyra</Link>
        <Link to="/"><Icon name="arrow" />Viešasis puslapis</Link>
      </nav>
      <button className="admin-logout" onClick={logout} disabled={busy}><Icon name="logout" />{busy ? 'Atsijungiama…' : 'Atsijungti'}</button>
      {error && <p role="alert">{error}</p>}
    </aside>
    <div className="admin-workspace"><header className="admin-topbar"><span>Prieglaudos valdymas</span><span><Icon name="user" size={18} />{auth.user.name}<small>{auth.user.role === 'admin' ? 'Administratorius' : 'Darbuotojas'}</small></span></header>
      <main id="admin-content" className="admin-content" tabIndex="-1"><Outlet /></main>
    </div>
  </div>;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <section className="empty-state"><h1 className="state-title">Nepakanka teisių</h1><p>Šią skiltį gali valdyti tik administratorius.</p><Link className="button" to="/admin">Grįžti į apžvalgą</Link></section>;
}
