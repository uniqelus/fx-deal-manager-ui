(function () {
  const ACCESS_KEY = 'fx_access_token';
  const REFRESH_KEY = 'fx_refresh_token';

  const FALLBACK_CFG = {
    IDP_URL: '/auth',
    API_URL: '',
    ENDPOINTS: {
      idp: {
        login: '/api/v1/auth/login',
        refresh: '/api/v1/auth/refresh',
      },
    },
  };

  function cfg() {
    return window.FX_CONFIG || FALLBACK_CFG;
  }

  function endpoints() {
    return (cfg().ENDPOINTS) || FALLBACK_CFG.ENDPOINTS;
  }

  function idpUrl(path) {
    return (cfg().IDP_URL || '') + path;
  }

  function apiUrl(path) {
    return (cfg().API_URL || '') + path;
  }

  function getAccessToken() {
    return sessionStorage.getItem(ACCESS_KEY);
  }

  function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_KEY);
  }

  function setTokens(accessToken, refreshToken) {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  }

  function clearTokens() {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  }

  function decodeJwtPayload(token) {
    try {
      const part = token.split('.')[1];
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '==='.slice((b64.length + 3) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function getUserFromToken() {
    const token = getAccessToken();
    if (!token) return null;
    const claims = decodeJwtPayload(token);
    if (!claims) return null;
    return {
      userId: claims.user_id,
      email: claims.email,
      firstName: claims.first_name,
      lastName: claims.last_name,
      role: claims.role,
      fullName: [claims.first_name, claims.last_name].filter(Boolean).join(' '),
    };
  }

  function mapRoleToUi(apiRole) {
    const map = { TRADER: 'trader', POSITIONER: 'positioner', AUDITOR: 'auditor', ADMIN: 'auditor' };
    return map[apiRole] || 'trader';
  }

  async function login(email, password) {
    const res = await fetch(idpUrl(endpoints().idp.login), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.detail || 'Неверный логин или пароль');
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return getUserFromToken();
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch(idpUrl(endpoints().idp.refresh), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      throw new Error('Session expired');
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  }

  async function apiFetch(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getAccessToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    let res = await fetch(apiUrl(path), Object.assign({}, options, { headers }));

    if (res.status === 401 && getRefreshToken()) {
      try {
        const newToken = await refreshAccessToken();
        headers.Authorization = 'Bearer ' + newToken;
        res = await fetch(apiUrl(path), Object.assign({}, options, { headers }));
      } catch (_) {
        clearTokens();
        location.href = 'index.html';
        throw new Error('Session expired');
      }
    }

    return res;
  }

  function logout() {
    clearTokens();
    localStorage.removeItem('fx_role');
  }

  function isAuthenticated() {
    return Boolean(getAccessToken());
  }

  async function apiJson(path, options) {
    const res = await apiFetch(path, options);
    let body = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text;
      }
    }
    if (!res.ok) {
      const message = (body && (body.detail || body.message)) || res.statusText;
      const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  function qs(params) {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    );
    if (!entries.length) return '';
    return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  }

  const deals = {
    list: (filters) => apiJson('/api/v1/deals' + qs(filters)),
    get: (id) => apiJson('/api/v1/deals/' + id),
    create: (payload) => apiJson('/api/v1/deals', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) =>
      apiJson('/api/v1/deals/' + id, { method: 'PATCH', body: JSON.stringify(payload) }),
    validate: (id) => apiJson('/api/v1/deals/' + id + '/validate', { method: 'POST' }),
    submit: (id) => apiJson('/api/v1/deals/' + id + '/submit', { method: 'POST' }),
    approve: (id) => apiJson('/api/v1/deals/' + id + '/approve', { method: 'POST' }),
    returnForEdit: (id, comment) =>
      apiJson('/api/v1/deals/' + id + '/return', { method: 'POST', body: JSON.stringify({ comment }) }),
    reject: (id, comment) =>
      apiJson('/api/v1/deals/' + id + '/reject', {
        method: 'POST',
        body: comment ? JSON.stringify({ comment }) : undefined,
      }),
    takeForEdit: (id) => apiJson('/api/v1/deals/' + id + '/take-for-edit', { method: 'POST' }),
    cancel: (id, comment) =>
      apiJson('/api/v1/deals/' + id + '/cancel', {
        method: 'POST',
        body: comment ? JSON.stringify({ comment }) : undefined,
      }),
    queue: (filters) => apiJson('/api/v1/deals/queue' + qs(filters)),
  };

  const nsi = {
    counterparties: () => apiJson('/api/v1/nsi/counterparties'),
    currencies: () => apiJson('/api/v1/nsi/currencies'),
    nostro: (currencyCode) => apiJson('/api/v1/nsi/nostro-accounts' + qs({ currency_code: currencyCode })),
    sync: () => apiJson('/api/v1/nsi/sync', { method: 'POST' }),
  };

  const audit = {
    list: (filters) => apiJson('/api/v1/audit-events' + qs(filters)),
  };

  const reports = {
    dealsJson: (filters) => apiJson('/api/v1/reports/deals' + qs({ ...filters, format: 'json' })),
    dealsCsvUrl: (filters) => cfg().API_URL + '/api/v1/reports/deals' + qs({ ...filters, format: 'csv' }),
    downloadDealsCsv: async (filters) => {
      const res = await apiFetch('/api/v1/reports/deals' + qs({ ...filters, format: 'csv' }));
      if (!res.ok) throw new Error('Не удалось получить отчёт');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deals_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  };

  const me = {
    get: () => apiJson('/api/v1/me'),
  };

  window.fxApi = {
    login,
    logout,
    apiFetch,
    apiJson,
    getAccessToken,
    getUserFromToken,
    mapRoleToUi,
    isAuthenticated,
    clearTokens,
    deals,
    nsi,
    audit,
    reports,
    me,
  };
})();
