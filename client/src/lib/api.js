/**
 * API address. By default the API is on the same machine that served this page, port 5000,
 * so it keeps working when the computer's Wi-Fi IP changes (laptop, phones scanning a QR).
 * Set VITE_API_URL only if the API runs somewhere else.
 */
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

/** Call the backend. Throws an Error with .status and .code when the server refuses. */
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.code = data.code;
    err.details = data.details || []; // validation errors: [{ field, message }]
    err.reference = data.reference; // failed payment reference
    err.field = data.field;
    err.suggestion = data.suggestion;
    throw err;
  }
  return data;
}

/** Image address for a dish photo: uploaded photos live on the API server, links are used as they are. */
export const photoSrc = (url) => (url && url.startsWith('/uploads/') ? `${API_URL}${url}` : url);