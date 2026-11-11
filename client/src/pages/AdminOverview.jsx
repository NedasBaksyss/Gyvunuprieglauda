import useAuth from '../hooks/useAuth.jsx';
import usePageHeading from '../hooks/usePageHeading.js';
import { Link } from 'react-router-dom';
import useAdminData from '../hooks/useAdminData.js';
import AdminDataState from '../components/AdminDataState.jsx';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import Icon from '../components/Icon.jsx';
import { formatAge, statusLabels } from '../lib/catalog.js';
import { formatDate, inquiryClasses, inquiryStatuses } from '../lib/inquiries.js';

export default function AdminOverview() {
  const { user } = useAuth();
  const heading = usePageHeading('Apžvalga');
  const dashboard = useAdminData('/api/admin/dashboard');
  const data = dashboard.data;
  const cards = data && [
    { label: 'Viso gyvūnų', count: data.stats.animals, icon: 'heart', to: '/admin/gyvunai', color: 'green' },
    { label: 'Naujos užklausos', count: data.stats.newInquiries, icon: 'mail', to: '/admin/uzklausos', color: 'blue' },
    { label: 'Gyvūnų rūšys', count: data.stats.species, icon: 'tag', to: user.role === 'admin' ? '/admin/rusys' : '/admin/gyvunai', color: 'orange' },
    user.role === 'admin' ? { label: 'Vartotojai', count: data.stats.users, icon: 'user', to: '/admin/vartotojai', color: 'purple' } : { label: 'Ieško namų', count: data.stats.available, icon: 'home', to: '/admin/gyvunai', color: 'purple' },
  ];
  return <><div className="admin-page-heading"><div><span className="eyebrow">Sveiki, {user.name}</span><h1 ref={heading} tabIndex="-1">Apžvalga</h1></div></div>
    <AdminDataState request={dashboard} />
    {data && <><div className="stat-grid">{cards.map((card) => <Link className="stat-card" key={card.label} to={card.to}><span className={`stat-icon stat-${card.color}`}><Icon name={card.icon} size={26} /></span><div><strong>{card.count}</strong><span>{card.label}</span></div></Link>)}</div>
      <div className="dashboard-grid"><section className="admin-panel"><div className="panel-heading"><h2>Paskutinės užklausos</h2><Link className="text-link" to="/admin/uzklausos">Peržiūrėti visas</Link></div>
        {data.recentInquiries.length ? data.recentInquiries.map((item) => <Link className="dashboard-row" key={item.id} to={`/admin/uzklausos/${item.id}`}><span className="dashboard-avatar"><Icon name="user" size={19} /></span><div className="dashboard-row-copy"><strong>{item.name}</strong><span>Dėl {item.animal.name}</span></div><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time><span className={`status-badge ${inquiryClasses[item.status]}`}>{inquiryStatuses[item.status]}</span></Link>) : <p className="empty-message">Užklausų dar nėra.</p>}
      </section><section className="admin-panel"><div className="panel-heading"><h2>Naujausi gyvūnai</h2><Link className="text-link" to="/admin/gyvunai">Peržiūrėti visus</Link></div>
        {data.recentAnimals.length ? data.recentAnimals.map((animal) => <Link className="dashboard-row" key={animal.id} to={`/admin/gyvunai/${animal.id}`}><div className="table-photo"><AnimalPhoto animal={animal} /></div><div className="dashboard-row-copy"><strong>{animal.name}</strong><span>{animal.species.name} · {formatAge(animal.ageMonths)}</span></div><span className={`status-badge status-${animal.status}`}>{statusLabels[animal.status]}</span></Link>) : <p className="empty-message">Gyvūnų dar nėra.</p>}
      </section></div></>}
    <section className="admin-panel"><h2>Jūsų prieiga</h2><p>Prisijungta kaip <strong>{user.email}</strong>.</p><p>{user.role === 'admin' ? 'Administratoriui suteikta prieiga valdyti gyvūnus, rūšis, užklausas ir vartotojus.' : 'Darbuotojas gali tvarkyti gyvūnus ir priglaudimo užklausas. Rūšis ir vartotojus valdo administratorius.'}</p></section>
  </>;
}
