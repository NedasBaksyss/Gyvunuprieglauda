import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import AnimalPhoto from './AnimalPhoto.jsx';
import { formatAge, statusLabels } from '../lib/catalog.js';

export default function AnimalCard({ animal, favorite, onToggleFavorite, catalogSearch = '' }) {
  const href = `/gyvunai/${animal.id}${catalogSearch}`;

  return (
    <article className="animal-card" aria-labelledby={`animal-${animal.id}`}>
      <div className="animal-photo">
        <Link className="animal-photo-link" to={href} aria-label={`Peržiūrėti: ${animal.name}`}><AnimalPhoto animal={animal} /></Link>
        <button type="button" className={`favorite-button${favorite ? ' is-favorite' : ''}`}
          aria-label={`${favorite ? 'Pašalinti pažymėjimą' : 'Pažymėti'}: ${animal.name}`}
          aria-pressed={favorite} onClick={() => onToggleFavorite(animal)}>
          <Icon name="heart" size={19} />
        </button>
      </div>
      <div className="animal-info">
        <h3 id={`animal-${animal.id}`}><Link to={href}>{animal.name}</Link></h3>
        <p className="animal-meta"><span>{animal.species.name}</span><span aria-hidden="true">·</span><span>{formatAge(animal.ageMonths)}</span></p>
        <span className={`status-badge status-${animal.status}`}><span className="status-dot" />{statusLabels[animal.status] || animal.status}</span>
      </div>
    </article>
  );
}
