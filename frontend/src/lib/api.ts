const BASE = (window as any).__BASE_PATH__ || '';
const TELEMT_BASE = `${BASE}/api/telemt`;
const AUTH_BASE = `${BASE}/api/auth`;
const INSTANCES_BASE = `${BASE}/api/instances`;

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(base: string, path: string, options?: RequestInit): Promise<T> {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401 && (base === TELEMT_BASE || base.startsWith(INSTANCES_BASE))) {
    window.location.href = `${BASE}/login`;
    throw new ApiError('unauthorized', 'Session expired');
  }

  const json = await res.json();
  if (!json.ok) {
    const message = json.error?.message || 'Unknown error';
    throw new ApiError(json.error?.code || 'unknown', `${message} (${options?.method || 'GET'} ${path})`);
  }

  return json.data;
}

// Legacy API - uses first instance by default
export const telemt = {
  get: <T>(path: string) => request<T>(TELEMT_BASE, path),
  post: <T>(path: string, body: unknown) =>
    request<T>(TELEMT_BASE, path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(TELEMT_BASE, path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(TELEMT_BASE, path, { method: 'DELETE' }),
};

// Instance-aware API - uses specific instance
export const instancesApi = {
  get: <T>(instanceName: string, path: string) => 
    request<T>(`${INSTANCES_BASE}/${instanceName}`, path),
  post: <T>(instanceName: string, path: string, body: unknown) =>
    request<T>(`${INSTANCES_BASE}/${instanceName}`, path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(instanceName: string, path: string, body: unknown) =>
    request<T>(`${INSTANCES_BASE}/${instanceName}`, path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(instanceName: string, path: string) =>
    request<T>(`${INSTANCES_BASE}/${instanceName}`, path, { method: 'DELETE' }),
};

// Fetch instances list
export const instancesListApi = {
  get: () => request<TelemtInstance[]>(`${BASE}/api`, '/instances'),
};

export interface TelemtInstance {
  name: string;
  url: string;
  healthy: boolean;
}

const PANEL_BASE = `${BASE}/api`;


export const panelApi = {
  get: <T>(path: string) => request<T>(PANEL_BASE, path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(PANEL_BASE, path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(PANEL_BASE, path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
};

export const authApi = {
  login: (username: string, password: string) =>
    request<{ username: string }>(AUTH_BASE, '/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    request<null>(AUTH_BASE, '/logout', { method: 'POST' }),
  me: () =>
    request<{ username: string }>(AUTH_BASE, '/me'),
};
