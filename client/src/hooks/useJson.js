import { useEffect, useState } from 'react';

export default function useJson(url) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const key = `${url}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 12000);

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Nepavyko gauti duomenų.');
        if (active) setResult({ key, data, error: '' });
      } catch (error) {
        if (active) setResult({ key, data: null, error: error.name === 'TimeoutError'
          ? 'Serveris neatsako. Pabandykite dar kartą.'
          : 'Nepavyko įkelti duomenų. Patikrinkite ryšį ir bandykite dar kartą.' });
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [url, key]);

  return {
    data: result.key === key ? result.data : null,
    error: result.key === key ? result.error : '',
    loading: result.key !== key,
    retry: () => setRevision((value) => value + 1),
  };
}
