import { useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';

export default function PhotoUpload({ animal }) {
  const [photo, setPhoto] = useState(animal.photoUrl);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef(null);
  async function update(remove = false) {
    if (busy) return;
    if (remove && !window.confirm('Pašalinti gyvūno nuotrauką?')) return;
    setError(''); setNotice('');
    if (!remove && (!file || file.size > 5 * 1024 * 1024)) { setError('Pasirinkite nuotrauką iki 5 MB.'); return; }
    const body = new FormData(); if (file) body.append('photo', file);
    setBusy(true);
    try {
      const result = await apiRequest(`/api/admin/animals/${animal.id}/photo`, { method: remove ? 'DELETE' : 'POST', ...(!remove ? { body } : {}) });
      setPhoto(result.animal.photoUrl); setFile(null); input.current.value = ''; setNotice(remove ? 'Nuotrauka pašalinta.' : 'Nuotrauka išsaugota.');
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="admin-panel photo-editor"><h2>Gyvūno nuotrauka</h2>
    {photo && <img className="upload-preview" src={photo} alt={animal.name} />}
    <label className="upload-zone">Pasirinkti nuotrauką<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { setFile(event.target.files[0] || null); setError(''); setNotice(''); }} /><span>JPG, PNG arba WebP · iki 5 MB</span></label>
    <div className="form-actions"><button className="button" disabled={busy || !file} onClick={() => update()}>{busy ? 'Vykdoma…' : 'Įkelti nuotrauką'}</button>{photo && <button className="button button-danger" disabled={busy} onClick={() => update(true)}>Pašalinti nuotrauką</button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
  </section>;
}
