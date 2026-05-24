/* Shared UI helpers across all pages.
   - Auth via identity-provider JWT (sessionStorage)
   - Sidebar nav: role-based show/hide + active highlight + dynamic dashboard link
   - Topbar clock
   - Toast helper
   - Modal helper
   - Button handlers via data-* attributes
*/

(function () {
  const ROLE_LABEL = {
    trader: 'Трейдер',
    positioner: 'Позиционер',
    auditor: 'Аудитор',
    admin: 'Администратор',
  };

  function getRole() {
    if (window.fxApi && window.fxApi.isAuthenticated()) {
      const user = window.fxApi.getUserFromToken();
      if (user) return window.fxApi.mapRoleToUi(user.role);
    }
    return localStorage.getItem('fx_role') || 'trader';
  }

  function setRole(r) {
    localStorage.setItem('fx_role', r);
  }

  function clearRole() {
    localStorage.removeItem('fx_role');
  }

  function getRoleUser() {
    if (window.fxApi && window.fxApi.isAuthenticated()) {
      const user = window.fxApi.getUserFromToken();
      if (user) {
        const initials = (user.firstName[0] || '') + (user.lastName[0] || '');
        return {
          name: user.fullName || user.email,
          login: user.email,
          initials: initials.toUpperCase() || '?',
          dept: user.role,
        };
      }
    }
    return null;
  }

  // ===== Toast =====
  function toast(title, desc, kind) {
    kind = kind || 'info';
    let stack = document.getElementById('toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const icon = ({ success: '✓', warn: '!', danger: '!', info: 'i', accent: '↗' })[kind] || 'i';
    const node = document.createElement('div');
    node.className = 'toast ' + kind;
    node.innerHTML =
      '<div class="toast-icon">' + icon + '</div>' +
      '<div class="toast-c">' +
        '<div class="toast-t"></div>' +
        (desc ? '<div class="toast-d"></div>' : '') +
      '</div>' +
      '<button class="toast-x">×</button>';
    node.querySelector('.toast-t').textContent = title;
    if (desc) node.querySelector('.toast-d').textContent = desc;
    node.querySelector('.toast-x').onclick = () => node.remove();
    stack.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  }

  // ===== Modal =====
  function modal(opts) {
    let mount = document.getElementById('modal-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'modal-mount';
      document.body.appendChild(mount);
    }
    mount.innerHTML = '';
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal">' +
        '<div class="modal-h"><h3></h3><button class="modal-x">×</button></div>' +
        '<div class="modal-b"></div>' +
        '<div class="modal-f"></div>' +
      '</div>';
    back.querySelector('h3').textContent = opts.title || '';
    back.querySelector('.modal-b').innerHTML = opts.body || '';

    const close = () => mount.innerHTML = '';
    back.querySelector('.modal-x').onclick = close;
    back.onclick = e => { if (e.target === back) close(); };

    const f = back.querySelector('.modal-f');
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.kind || '');
      b.textContent = a.label;
      b.onclick = () => {
        if (typeof a.handler === 'function') a.handler();
        close();
      };
      f.appendChild(b);
    });

    mount.appendChild(back);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', esc);
        close();
      }
    });
  }

  // ===== Sidebar / shell setup =====
  function setupShell() {
    const role = getRole();
    const roleUser = getRoleUser();

    const av = document.getElementById('side-user-av');
    const un = document.getElementById('side-user-name');
    const ur = document.getElementById('side-user-role');
    if (av && roleUser) av.textContent = roleUser.initials;
    if (un && roleUser) un.textContent = roleUser.name;
    if (ur) ur.textContent = ROLE_LABEL[role] || roleUser?.dept || '';

    document.querySelectorAll('.side-nav-link[data-page="dashboard"]').forEach(a => {
      a.href = 'dashboard-' + role + '.html';
    });

    document.querySelectorAll('.side-nav-link[data-roles]').forEach(a => {
      const allowed = a.dataset.roles.split(',');
      if (!allowed.includes(role)) a.style.display = 'none';
    });
    document.querySelectorAll('.side-nav-section[data-roles]').forEach(s => {
      const allowed = s.dataset.roles.split(',');
      if (!allowed.includes(role)) s.style.display = 'none';
    });

    const cur = document.body.dataset.page;
    if (cur) {
      document.querySelectorAll('.side-nav-link[data-page="' + cur + '"]').forEach(a => a.classList.add('active'));
    }
  }

  function setupLoginPage() {
    const form = document.getElementById('login-form');
    if (!form || !window.fxApi) return;

    if (window.fxApi.isAuthenticated()) {
      const role = getRole();
      location.href = 'dashboard-' + role + '.html';
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const user = await window.fxApi.login(email, password);
        const uiRole = window.fxApi.mapRoleToUi(user.role);
        setRole(uiRole);
        toast('Добро пожаловать', user.fullName || user.email, 'success');
        location.href = 'dashboard-' + uiRole + '.html';
      } catch (err) {
        toast('Ошибка входа', err.message || 'Проверьте email и пароль', 'danger');
        btn.disabled = false;
      }
    });
  }

  function enforceAuthGuard() {
    if (document.body.dataset.page === 'login') return;
    if (!window.fxApi || !window.fxApi.isAuthenticated()) {
      location.href = 'index.html';
    }
  }

  // ===== Button handlers via data-* =====
  function attachHandlers() {
    document.querySelectorAll('[data-toast]').forEach(b => {
      b.addEventListener('click', () => {
        const [title, desc, kind] = b.dataset.toast.split('|');
        toast(title, desc, kind);
      });
    });
    document.querySelectorAll('[data-go]').forEach(b => {
      b.addEventListener('click', () => { location.href = b.dataset.go; });
    });
    document.querySelectorAll('[data-confirm]').forEach(b => {
      b.addEventListener('click', () => {
        const [title, body, actionLabel, kind, after] = b.dataset.confirm.split('|');
        modal({
          title: title,
          body: '<p>' + (body || '') + '</p>',
          actions: [
            { label: 'Отмена' },
            { label: actionLabel || 'OK', kind: kind || 'accent', handler: () => {
              toast(actionLabel + ' (имитация)', 'Запрос отправлен на бэкенд.', kind || 'success');
              if (after) setTimeout(() => location.href = after, 600);
            } },
          ],
        });
      });
    });
    document.querySelectorAll('[data-logout]').forEach(b => {
      b.addEventListener('click', () => {
        modal({
          title: 'Выйти из системы?',
          body: '<p>Текущий сеанс будет завершен.</p>',
          actions: [
            { label: 'Отмена' },
            { label: 'Выйти', kind: 'primary', handler: () => {
              if (window.fxApi) window.fxApi.logout();
              clearRole();
              location.href = 'index.html';
            } },
          ],
        });
      });
    });
    document.querySelectorAll('[data-back]').forEach(b => {
      b.addEventListener('click', () => history.back());
    });
    document.querySelectorAll('.filter-bar [data-group]').forEach(b => {
      b.addEventListener('click', () => {
        const grp = b.dataset.group;
        document.querySelectorAll('.filter-bar [data-group="' + grp + '"]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
    });
    document.querySelectorAll('[data-tab-group]').forEach(b => {
      b.addEventListener('click', () => {
        const grp = b.dataset.tabGroup;
        document.querySelectorAll('[data-tab-group="' + grp + '"]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
    });

    const required = document.body.dataset.roleRequired;
    if (required) {
      const allowed = required.split(',');
      const r = getRole();
      if (!allowed.includes(r)) {
        toast('Нет доступа', 'Эта страница доступна для ролей: ' + allowed.map(a => ROLE_LABEL[a]).join(', '), 'danger');
        setTimeout(() => location.href = 'dashboard-' + r + '.html', 1200);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    enforceAuthGuard();
    setupLoginPage();
    setupShell();
    attachHandlers();
  });

  window.fxToast = toast;
  window.fxModal = modal;
  window.fxRole = { get: getRole, set: setRole, clear: clearRole };
})();
