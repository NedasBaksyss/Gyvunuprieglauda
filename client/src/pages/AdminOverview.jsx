import useAuth from '../hooks/useAuth.jsx';
import usePageHeading from '../hooks/usePageHeading.js';

export default function AdminOverview() {
  const { user } = useAuth();
  const heading = usePageHeading('Apžvalga');
  return <><div className="admin-page-heading"><div><span className="eyebrow">Sveiki, {user.name}</span><h1 ref={heading} tabIndex="-1">Apžvalga</h1></div></div>
    <section className="admin-panel"><h2>Jūsų prieiga</h2><p>Prisijungta kaip <strong>{user.email}</strong>.</p><p>{user.role === 'admin' ? 'Administratoriui suteikta prieiga valdyti gyvūnus, rūšis, užklausas ir vartotojus.' : 'Darbuotojas gali tvarkyti gyvūnus ir priglaudimo užklausas. Rūšis ir vartotojus valdo administratorius.'}</p></section>
  </>;
}
