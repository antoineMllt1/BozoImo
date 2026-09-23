// Client API authentifié — comptes agents + historique des dossiers côté serveur.
// Le token JWT est gardé en localStorage (pas de cookie : le frontend peut
// être servi depuis un domaine différent du backend, cf. vercel.json).

const TOKEN_KEY = 'estimia_auth_token_v1';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée, etc.) — la session ne survivra pas au rechargement.
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Serveur injoignable — vérifie ta connexion', 0);
  }

  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

  if (!response.ok) {
    if (response.status === 401 && auth) setToken(null); // session expirée : on nettoie le token local
    throw new ApiError(data?.error || `Erreur serveur (${response.status})`, response.status);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────
export const signup = (email, password, name, inviteCode) =>
  request('/auth/signup', { method: 'POST', body: { email, password, name, inviteCode }, auth: false });

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password }, auth: false });

export const fetchMe = () => request('/auth/me');

// ── Dossiers ──────────────────────────────────────────────────────────
export const fetchDossiers = () => request('/dossiers').then(data => data?.dossiers || []);

export const upsertDossierRemote = (dossier) =>
  request(`/dossiers/${encodeURIComponent(dossier.id)}`, { method: 'PUT', body: dossier });

export const deleteDossierRemote = (id) =>
  request(`/dossiers/${encodeURIComponent(id)}`, { method: 'DELETE' });

export { ApiError };
