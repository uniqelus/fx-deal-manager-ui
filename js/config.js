// Frontend configuration.
//
// Default URLs are nginx-relative: requests go through the same origin
// (see default.conf.template) so the browser never needs to know where IdP and
// API are actually running. Override window.FX_CONFIG before app.js loads to
// point at absolute URLs (useful when serving the UI from python -m http.server
// without nginx).
window.FX_CONFIG = {
  // Base URLs prepended to ENDPOINTS paths.
  // '' or '/auth' => relative, served by nginx reverse proxy.
  IDP_URL: '/auth',
  API_URL: '',

  // All endpoint paths in one place. Functions take args; constants are plain
  // strings. fxApi reads from here, so changing a path is one edit.
  ENDPOINTS: {
    idp: {
      login: '/api/v1/auth/login',
      refresh: '/api/v1/auth/refresh',
    },
    deals: {
      list: '/api/v1/deals',
      queue: '/api/v1/deals/queue',
      byId: (id) => '/api/v1/deals/' + encodeURIComponent(id),
      validate: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/validate',
      submit: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/submit',
      approve: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/approve',
      returnForEdit: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/return',
      reject: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/reject',
      takeForEdit: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/take-for-edit',
      cancel: (id) => '/api/v1/deals/' + encodeURIComponent(id) + '/cancel',
    },
    nsi: {
      counterparties: '/api/v1/nsi/counterparties',
      currencies: '/api/v1/nsi/currencies',
      nostroAccounts: '/api/v1/nsi/nostro-accounts',
      sync: '/api/v1/nsi/sync',
    },
    audit: '/api/v1/audit-events',
    reports: {
      deals: '/api/v1/reports/deals',
    },
    me: '/api/v1/me',
  },
};
