import { useState } from 'react';

export default function AnimalPhoto({ animal, loading = 'lazy' }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  return animal.photoUrl && failedPhoto !== animal.photoUrl
    ? <img src={animal.photoUrl} alt={`${animal.name} – ${animal.species.name.toLocaleLowerCase('lt')}`}
      loading={loading} decoding="async" width="600" height="480" onError={() => setFailedPhoto(animal.photoUrl)} />
    : <div className="photo-placeholder"><img src="/favicon.svg" alt="" /><span>Nuotrauka ruošiama</span></div>;
}
