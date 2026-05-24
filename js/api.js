(function () {
  const ACCESS_KEY = 'fx_access_token';
  const REFRESH_KEY = 'fx_refresh_token';

  function cfg() {
    return window.FX_CONFIG || { IDP_URL: 'http://localhost:8083', API_URL: 'http://localhost:8000' };
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
      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
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
    const res = await fetch(cfg().IDP_URL + '/api/v1/auth/login', {
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
    const res = await fetch(cfg().IDP_URL + '/api/v1/auth/refresh', {
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

    let res = await fetch(cfg().API_URL + path, Object.assign({}, options, { headers }));

    if (res.status === 401 && getRefreshToken()) {
      try {
        const newToken = await refreshAccessToken();
        headers.Authorization = 'Bearer ' + newToken;
        res = await fetch(cfg().API_URL + path, Object.assign({}, options, { headers }));
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

  window.fxApi = {
    login,
    logout,
    apiFetch,
    getAccessToken,
    getUserFromToken,
    mapRoleToUi,
    isAuthenticated,
    clearTokens,
  };
})();
