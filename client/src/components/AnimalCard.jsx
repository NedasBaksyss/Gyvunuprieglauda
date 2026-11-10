import { useState } from 'react';
import Icon from './Icon.jsx';
import { formatAge, statusLabels } from '../lib/catalog.js';

export default function AnimalCard({ animal, favorite, onToggleFavorite }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const hasPhoto = animal.photoUrl && failedPhoto !== animal.photoUrl;

  return (
    <article className="animal-card" aria-labelledby={`animal-${animal.id}`}>
      <div className="animal-photo">
        {hasPhoto ? <img src={animal.photoUrl} alt={`${animal.name} – ${animal.species.name.toLocaleLowerCase('lt')}`}
          loading="lazy" decoding="async" width="600" height="480" onError={() => setFailedPhoto(animal.photoUrl)} />
          : <div className="photo-placeholder"><img src="/favicon.svg" alt="" /><span>Nuotrauka ruošiama</span></div>}
        <button type="button" className={`favorite-button${favorite ? ' is-favorite' : ''}`}
          aria-label={`${favorite ? 'Pašalinti pažymėjimą' : 'Pažymėti'}: ${animal.name}`}
          aria-pressed={favorite} onClick={() => onToggleFavorite(animal)}>
          <Icon name="heart" size={19} />
        </button>
      </div>
      <div className="animal-info">
        <h3 id={`animal-${animal.id}`}>{animal.name}</h3>
        <p className="animal-meta"><span>{animal.species.name}</span><span aria-hidden="true">·</span><span>{formatAge(animal.ageMonths)}</span></p>
        <span className={`status-badge status-${animal.status}`}><span className="status-dot" />{statusLabels[animal.status] || animal.status}</span>
      </div>
    </article>
  );
}
