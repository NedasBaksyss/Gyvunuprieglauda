export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(path, { method, credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'X-Requested-With': 'shelter-app' } : {}),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status) && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('shelter:session-check'));
      throw new ApiError(response.status, data?.message || 'Nepavyko atlikti veiksmo.');
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError || signal?.aborted) throw error;
    throw new ApiError(0, 'Serveris nepasiekiamas. Patikrinkite ryšį ir bandykite dar kartą.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
