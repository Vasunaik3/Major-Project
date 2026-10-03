const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const ASSET_BASE = API_BASE.replace(/\/api$/, '');

export function apiAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${ASSET_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchApiAsset(path) {
  const url = apiAssetUrl(path);
  if (/^https?:\/\//i.test(path)) return path;
  const headers = new Headers();
  const token = localStorage.getItem('smart-onion-token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Unable to load the stored image.');
  return URL.createObjectURL(await response.blob());
}

export async function apiRequest(path, options = {}) {
  const { auth = true, headers: suppliedHeaders = {}, ...fetchOptions } = options;
  const headers = new Headers(suppliedHeaders);
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (!isFormData && fetchOptions.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = localStorage.getItem('smart-onion-token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  } catch {
    throw new Error('Cannot reach the backend. Check the API server and VITE_API_URL.');
  }

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
