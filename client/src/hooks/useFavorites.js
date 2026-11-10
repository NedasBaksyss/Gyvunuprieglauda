import { useState } from 'react';

const storageKey = 'shelter:favorites';

export function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 1000) : []);
  } catch {
    return new Set();
  }
}

export default function useFavorites() {
  const [favorites, setFavorites] = useState(readFavorites);
  const [notice, setNotice] = useState('');

  function toggle(animal) {
    const next = new Set(favorites);
    if (next.has(animal.id)) next.delete(animal.id);
    else next.add(animal.id);
    setFavorites(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      setNotice(`${next.has(animal.id) ? 'Pažymėta' : 'Pažymėjimas pašalintas'}: ${animal.name}.`);
    } catch {
      setNotice('Pažymėjimai išliks tik kol neuždarysite šio puslapio.');
    }
  }

  return { favorites, toggle, notice };
}
