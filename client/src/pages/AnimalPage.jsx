import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import Icon from '../components/Icon.jsx';
import useJson from '../hooks/useJson.js';
import usePageHeading from '../hooks/usePageHeading.js';
import { catalogSearch, formatAge, isPositiveId, readCatalogFilters, sizeLabels, statusLabels } from '../lib/catalog.js';
import NotFoundPage from './NotFoundPage.jsx';

const statusNotes = {
  available: 'Laukia atsakingos ir mylinčios šeimos.',
  reserved: 'Šiuo metu vyksta susipažinimas su būsima šeima.',
  adopted: 'Jau rado savo namus. Kiti mūsų globotiniai vis dar laukia šeimos.',
};

export default function AnimalPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const catalogHref = `/${catalogSearch(readCatalogFilters(new URLSearchParams(search)))}#gyvunai`;
  if (!isPositiveId(id)) return <NotFoundPage animal catalogHref={catalogHref} />;
  return <AnimalDetails key={id} id={id} catalogHref={catalogHref} />;
}

function AnimalDetails({ id, catalogHref }) {
  const request = useJson(`/api/animals/${id}`);
  if (request.status === 404) return <NotFoundPage animal catalogHref={catalogHref} />;
  if (request.loading || request.error) return <RequestState request={request} catalogHref={catalogHref} />;
  return <AnimalProfile animal={request.data.animal} catalogHref={catalogHref} />;
}

function RequestState({ request, catalogHref }) {
  const title = request.loading ? 'Kraunama gyvūno informacija…' : 'Nepavyko įkelti gyvūno';
  const heading = usePageHeading(title, !request.loading);
  return (
    <section className="container page-state" aria-busy={request.loading}>
      {request.loading ? <div className="detail-skeleton">
        <p role="status">{title}</p><div className="skeleton-grid" aria-hidden="true"><div /><div /></div>
      </div> : <div className="empty-state" role="alert">
        <img src="/favicon.svg" alt="" /><h1 className="state-title" ref={heading} tabIndex="-1">{title}</h1>
        <p>{request.error}</p><button className="button" onClick={request.retry}>Bandyti dar kartą</button>
      </div>}
      <Link className="text-link detail-back" to={catalogHref}><Icon name="chevron" className="flip-icon" size={16} />Grįžti į gyvūnų sąrašą</Link>
    </section>
  );
}

function AnimalProfile({ animal, catalogHref }) {
  const { search } = useLocation();
  const { favorites, toggle } = useOutletContext();
  const favorite = favorites.has(animal.id);
  const heading = usePageHeading(animal.name);

  return (
    <div className="container animal-page">
      <nav className="breadcrumbs" aria-label="Puslapio kelias">
        <ol><li><Link to="/">Pradžia</Link></li><li><Link to={catalogHref}>Gyvūnai</Link></li><li aria-current="page">{animal.name}</li></ol>
      </nav>
      <article className="animal-detail" aria-labelledby="animal-title">
        <div className="detail-photo"><AnimalPhoto animal={animal} loading="eager" /></div>
        <div className="detail-content">
          <span className="eyebrow">Susipažinkime</span>
          <h1 id="animal-title" className="detail-title" ref={heading} tabIndex="-1">{animal.name}</h1>
          <div className="detail-badges"><span className="species-badge">{animal.species.name}</span>
            <span className={`status-badge status-${animal.status}`}><span className="status-dot" />{statusLabels[animal.status]}</span>
          </div>
          <dl className="animal-facts">
            <div><dt>Amžius</dt><dd>{formatAge(animal.ageMonths)}</dd></div>
            <div><dt>Dydis</dt><dd>{sizeLabels[animal.size]}</dd></div>
          </dl>
          <section className="animal-description" aria-labelledby="description-title">
            <h2 id="description-title">Aprašymas</h2><p>{animal.description}</p>
          </section>
          <p className={`detail-status-note status-${animal.status}`}>{statusNotes[animal.status]}</p>
          {animal.status === 'available' && <Link className="button adopt-button" to={`/gyvunai/${animal.id}/uzklausa${catalogSearch(readCatalogFilters(new URLSearchParams(search)))}`}>Noriu priglausti <Icon name="heart" size={18} /></Link>}
          <button className={`button button-secondary detail-favorite${favorite ? ' is-favorite' : ''}`} type="button" aria-pressed={favorite}
            aria-label={`${favorite ? 'Pašalinti pažymėjimą' : 'Pažymėti'}: ${animal.name}`} onClick={() => toggle(animal)}>
            <Icon name="heart" size={19} />{favorite ? 'Pažymėtas draugas' : 'Pažymėti draugą'}
          </button>
          <p className="favorite-hint">Pažymėjimas išsaugomas šioje naršyklėje.</p>
        </div>
      </article>
      <div className="detail-footer">
        <Link className="text-link" to={catalogHref}><Icon name="chevron" className="flip-icon" size={16} />Grįžti į gyvūnų sąrašą</Link>
        <div className="adoption-note"><Icon name="shield" size={25} /><p><strong>Draugystė – visam gyvenimui.</strong><br />Prieš priglausdami įvertinkite gyvūno poreikius ir skirkite laiko pažinčiai.</p></div>
      </div>
    </div>
  );
}
