import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

export default function useAdminData(url) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({});
  const key = `${url}:${revision}`;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    apiRequest(url, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch((error) => { if (!controller.signal.aborted) setResult({ key, error: error.message, status: error.status }); });
    return () => controller.abort();
  }, [url, key]);
  return { data: result.key === key ? result.data : null, error: result.key === key ? result.error : '',
    loading: Boolean(url) && result.key !== key, retry: () => setRevision((value) => value + 1) };
}
