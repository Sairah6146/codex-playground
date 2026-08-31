const TOKEN_KEY = 'pc_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path) => request(path, { method: 'DELETE' });

export const api = {
  register: (email, password, name) => post('/auth/register', { email, password, name }),
  login: (email, password) => post('/auth/login', { email, password }),
  me: () => get('/auth/me'),

  getProfile: () => get('/profile'),
  saveProfile: (profile) => put('/profile', profile),

  subjects: () => get('/subjects'),

  search: (params) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        if (value.length) qs.set(key, value.join(','));
      } else if (value !== false) {
        qs.set(key, value);
      }
    }
    return get(`/search?${qs.toString()}`);
  },

  podcast: (id) => get(`/podcasts/${id}`),
  compare: (ids) => get(`/compare?ids=${ids.join(',')}`),

  saved: () => get('/saved'),
  save: (podcastId) => post('/saved', { podcastId }),
  unsave: (podcastId) => del(`/saved/${podcastId}`),

  pipeline: () => get('/pipeline'),
  addToPipeline: (podcastId, stage, notes) => post('/pipeline', { podcastId, stage, notes }),
  updatePipelineItem: (id, patch) => put(`/pipeline/${id}`, patch),
  removeFromPipeline: (id) => del(`/pipeline/${id}`),

  importPodcasts: (term, limit) => post('/admin/import-podcasts', { term, limit }),
};
