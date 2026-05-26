/* Dynamic view renderers wired to the backend API.
   Each page bootstraps on DOMContentLoaded and replaces hardcoded mock tables
   with data fetched from fx-deal-manager. If the API is unreachable, the
   existing mock content remains visible and a soft warning is shown so the
   UI is still demoable without a running backend. */

(function () {
  const STATUS_PILL = {
    DRAFT: { cls: 'pill draft', label: 'Редактируется' },
    WAITING_FOR_POSITIONER: { cls: 'pill waiting', label: 'На согласовании' },
    APPROVED: { cls: 'pill approved', label: 'Согласована' },
    EXECUTED: { cls: 'pill approved', label: 'Исполнена' },
    REJECTED: { cls: 'pill return', label: 'На исправлении' },
    CANCELLED: { cls: 'pill rejected', label: 'Отменена' },
  };

  function fmtMoney(value) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtRate(value) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toFixed(4);
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hh}:${mm}`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }

  function pillFor(status) {
    return STATUS_PILL[status] || { cls: 'pill', label: status };
  }

  function ensureApi() {
    return Boolean(window.fxApi && window.fxApi.isAuthenticated());
  }

  function softWarn(msg) {
    if (window.toast) {
      window.toast('API недоступен', msg, 'warn');
    } else {
      console.warn(msg);
    }
  }

  function renderDealsTable(tbody, items, opts) {
    opts = opts || {};
    tbody.innerHTML = '';
    if (!items.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="9" class="muted" style="text-align:center;padding:24px">Сделок не найдено</td>`;
      tbody.appendChild(tr);
      return;
    }
    items.forEach((d) => {
      const tr = document.createElement('tr');
      const detailHref = opts.detailHref ? opts.detailHref(d) : `deal-detail.html?id=${d.id}`;
      tr.dataset.go = detailHref;
      const pill = pillFor(d.status);
      const shortId = (d.id || '').slice(0, 8).toUpperCase();
      tr.innerHTML = `
        <td class="tbl-id">D-${shortId}</td>
        <td class="mono">${fmtTime(d.created_at)}</td>
        <td><span class="tbl-pair">${d.buy_currency}</span><span class="tbl-pair-arrow">→</span><span class="tbl-pair">${d.sell_currency}</span></td>
        <td class="mono">${d.deal_type}</td>
        <td class="num">${fmtMoney(d.amount)}</td>
        <td class="num">${fmtRate(d.rate)}</td>
        <td class="tbl-cp">${d.counterparty_id}</td>
        <td><span class="${pill.cls}">${pill.label}</span></td>
        <td class="right"><button class="btn sm ghost" data-go="${detailHref}">→</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function bindRowsNavigate(tbody) {
    tbody.querySelectorAll('tr[data-go]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        location.href = tr.dataset.go;
      });
    });
  }

  function buildFilters(scope) {
    const filters = { page_size: 50 };
    const search = scope.querySelector('.filter-search input');
    if (search && search.value.trim()) filters.search = search.value.trim();
    const dates = scope.querySelectorAll('.filter-bar input[type="date"]');
    if (dates[0] && dates[0].value) filters.trade_date_from = dates[0].value;
    if (dates[1] && dates[1].value) filters.trade_date_to = dates[1].value;
    const activeStatus = scope.querySelector('.chip.on[data-group="status"]');
    if (activeStatus) {
      const map = {
        'На согласовании': 'WAITING_FOR_POSITIONER',
        'На исправлении': 'REJECTED',
        'Согласованные': 'APPROVED',
        'Отклоненные': 'REJECTED',
      };
      const txt = activeStatus.textContent.trim().split(/\s+/)[0];
      const label = activeStatus.textContent.replace(/\s+\d+\s*$/, '').trim();
      const status = map[label] || (txt !== 'Все' && map[txt]);
      if (status) filters.status = status;
    }
    const activeType = scope.querySelector('.chip.on[data-group="type"]');
    if (activeType) {
      const txt = activeType.textContent.trim();
      if (['SPOT', 'TOM', 'TOD', 'FORWARD'].includes(txt)) filters.deal_type = txt;
    }
    return filters;
  }

  async function initDealsPage() {
    if (!ensureApi()) return;
    const tbody = document.querySelector('table.tbl tbody');
    if (!tbody) return;
    const card = tbody.closest('.card');
    const filterBar = card.querySelector('.filter-bar');

    async function reload() {
      try {
        const data = await window.fxApi.deals.list(buildFilters(card));
        renderDealsTable(tbody, data.items || []);
        bindRowsNavigate(tbody);
        const pag = card.querySelector('.pag span');
        if (pag) pag.textContent = `Показано ${data.items.length} из ${data.total}`;
      } catch (e) {
        softWarn('Реестр сделок: ' + e.message);
      }
    }

    if (filterBar) {
      filterBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip')) {
          setTimeout(reload, 0);
        }
      });
      filterBar.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('change', reload);
      });
    }

    await reload();
  }

  async function initQueuePage() {
    if (!ensureApi()) return;
    const tbody = document.querySelector('table.tbl tbody');
    if (!tbody) return;
    try {
      const items = await window.fxApi.deals.queue({ page_size: 50 });
      renderDealsTable(tbody, items, { detailHref: (d) => `deal-review.html?id=${d.id}` });
      bindRowsNavigate(tbody);
    } catch (e) {
      softWarn('Очередь: ' + e.message);
    }
  }

  async function initAuditPage() {
    if (!ensureApi()) return;
    const tbody = document.querySelector('table.tbl tbody');
    if (!tbody) return;
    try {
      const data = await window.fxApi.audit.list({ page_size: 100 });
      tbody.innerHTML = '';
      (data.items || []).forEach((ev) => {
        const tr = document.createElement('tr');
        const pillClass =
          ev.action === 'STATUS_CHANGE'
            ? 'pill approved'
            : ev.action === 'POSITION_SEND'
            ? 'pill waiting'
            : 'pill';
        tr.innerHTML = `
          <td class="tbl-id">${(ev.id || '').slice(0, 8).toUpperCase()}</td>
          <td class="mono" style="font-size:12px">${fmtTime(ev.created_at)}</td>
          <td>${ev.created_by}</td>
          <td class="mono">${ev.entity_type} · ${(ev.entity_id || '').slice(0, 8).toUpperCase()}</td>
          <td><span class="${pillClass}">${ev.action}</span></td>
          <td class="mono muted">${ev.old_value || ''}</td>
          <td class="mono" style="color:var(--danger);font-size:11px">${(ev.old_value || '').slice(0, 60)}</td>
          <td class="mono" style="color:var(--success);font-size:11px">${(ev.new_value || '').slice(0, 60)}</td>
        `;
        tbody.appendChild(tr);
      });
      if (!data.items.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Журнал пуст</td></tr>`;
      }
    } catch (e) {
      softWarn('Журнал аудита: ' + e.message);
    }
  }

  async function initCounterpartiesPage() {
    if (!ensureApi()) return;
    const tbody = document.querySelector('table.tbl tbody');
    if (!tbody) return;
    try {
      const items = await window.fxApi.nsi.counterparties();
      tbody.innerHTML = '';
      (items || []).forEach((cp) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="tbl-id">${cp.id}</td>
          <td>${cp.name}</td>
          <td class="mono">${cp.bic || ''}</td>
          <td class="mono">${cp.country || ''}</td>
          <td><span class="${cp.is_active ? 'pill approved' : 'pill rejected'}">${cp.is_active ? 'Активен' : 'Неактивен'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      softWarn('Контрагенты: ' + e.message);
    }
  }

  async function initAccountsPage() {
    if (!ensureApi()) return;
    const tbody = document.querySelector('table.tbl tbody');
    if (!tbody) return;
    try {
      const items = await window.fxApi.nsi.nostro();
      tbody.innerHTML = '';
      (items || []).forEach((acc) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="tbl-id">${acc.id}</td>
          <td class="mono">NOSTRO</td>
          <td class="mono">${acc.currency_code}</td>
          <td class="mono">${acc.account_number}</td>
          <td>${acc.bank_name}</td>
          <td class="num muted">-</td>
          <td><span class="${acc.is_active ? 'pill approved' : 'pill rejected'}">${acc.is_active ? 'Активен' : 'Неактивен'}</span></td>
          <td class="right"><button class="btn sm ghost" disabled>Выписка</button></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      softWarn('Счета: ' + e.message);
    }
  }

  async function bootstrapCounterpartyDatalist() {
    const list = document.getElementById('cp-list');
    if (!list || !ensureApi()) return;
    try {
      const items = await window.fxApi.nsi.counterparties();
      list.innerHTML = '';
      (items || []).forEach((cp) => {
        const opt = document.createElement('option');
        opt.value = `${cp.id} - ${cp.name}`;
        list.appendChild(opt);
      });
    } catch (_) {
      /* keep static options */
    }
  }

  function parseCounterpartyInput(value) {
    if (!value) return '';
    return value.trim().split(/\s*-\s*|\s*—\s*/)[0];
  }

  async function initDealNewPage() {
    if (!ensureApi()) return;
    await bootstrapCounterpartyDatalist();
    const form = document.querySelector('.row-side');
    if (!form) return;
    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Сохранить/i.test(b.textContent)
    );
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Отправить досрочно/i.test(b.textContent)
    );

    function collectPayload() {
      const cpInput = document.querySelector('input[list="cp-list"]');
      const dealType = document.querySelector('input[name="dealType"]:checked')?.parentElement.querySelector('div')?.textContent || 'SPOT';
      const direction = document.querySelector('input[name="dealSide"]:checked')?.parentElement.querySelector('div')?.textContent || 'Покупка';
      const op = direction.toLowerCase().startsWith('п') && !direction.toLowerCase().startsWith('пр') ? 'BUY' : direction === 'Покупка' ? 'BUY' : 'SELL';
      const dates = form.querySelectorAll('input[type="date"]');
      const tradeDate = dates[0]?.value;
      const valueDate = dates[1]?.value;
      const selects = form.querySelectorAll('.form-grid-4 .form-select');
      const buyCurrency = selects[0]?.value || 'USD';
      const sellCurrency = selects[2]?.value || 'RUB';
      const amountInput = form.querySelector('.input-group input.mono');
      const amount = amountInput ? amountInput.value.replace(/\s+/g, '').replace(',', '.') : '0';
      const rateInput = form.querySelectorAll('.input-group input.mono')[2];
      const rate = rateInput ? rateInput.value.replace(',', '.') : '0';
      const comment = form.querySelector('textarea.form-textarea')?.value || null;
      return {
        trade_date: tradeDate,
        value_date: valueDate,
        deal_type: dealType,
        operation_direction: op,
        buy_currency: buyCurrency,
        sell_currency: sellCurrency,
        amount,
        rate,
        counterparty_id: parseCounterpartyInput(cpInput?.value || ''),
        comment,
      };
    }

    async function persistDraft() {
      try {
        const payload = collectPayload();
        const deal = await window.fxApi.deals.create(payload);
        window.toast && window.toast('Сделка создана', `ID ${deal.id.slice(0, 8)}, статус ${deal.status}`, 'success');
        setTimeout(() => (location.href = `deal-detail.html?id=${deal.id}`), 600);
      } catch (e) {
        window.toast && window.toast('Ошибка создания', e.message, 'danger');
      }
    }

    async function persistAndSubmit() {
      try {
        const payload = collectPayload();
        const deal = await window.fxApi.deals.create(payload);
        await window.fxApi.deals.validate(deal.id);
        const submitted = await window.fxApi.deals.submit(deal.id);
        window.toast && window.toast('Отправлено', `Сделка ${submitted.id.slice(0, 8)} в очереди позиционера`, 'success');
        setTimeout(() => (location.href = `deal-detail.html?id=${submitted.id}`), 600);
      } catch (e) {
        window.toast && window.toast('Ошибка отправки', e.message, 'danger');
      }
    }

    if (saveBtn) {
      saveBtn.removeAttribute('data-toast');
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        persistDraft();
      });
    }
    if (submitBtn) {
      submitBtn.removeAttribute('data-confirm');
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        persistAndSubmit();
      });
    }
  }

  async function initDealDetailPage() {
    if (!ensureApi()) return;
    const params = new URLSearchParams(location.search);
    const dealId = params.get('id');
    if (!dealId) return;
    try {
      const deal = await window.fxApi.deals.get(dealId);
      applyDealHero(deal);
      bindDealActions(deal);
    } catch (e) {
      softWarn('Сделка: ' + e.message);
    }
  }

  function applyDealHero(deal) {
    const heroId = document.querySelector('.deal-hero-id');
    if (heroId) heroId.textContent = 'D-' + deal.id.slice(0, 8).toUpperCase();
    const pill = pillFor(deal.status);
    const pillEl = document.querySelector('.deal-hero-top .pill');
    if (pillEl) {
      pillEl.className = pill.cls;
      pillEl.textContent = pill.label;
    }
    const pair = document.querySelector('.deal-hero-pair');
    if (pair) {
      pair.innerHTML = `<span>${deal.buy_currency}</span><span class="arrow">→</span><span>${deal.sell_currency}</span><span style="font-size:24px;color:var(--muted);margin-left:12px">${deal.deal_type}</span>`;
    }
    const amt = document.querySelector('.deal-hero-amt');
    if (amt) amt.innerHTML = `<span>${fmtMoney(deal.amount)}</span><span class="deal-hero-amt-c">${deal.buy_currency}</span>`;
    const rate = document.querySelector('.deal-hero-rate');
    if (rate) {
      const vDate = deal.value_date ? fmtDate(deal.value_date) : '-';
      rate.innerHTML = `Курс <span class="mono">${fmtRate(deal.rate)}</span> · валютирование <span class="mono">${vDate}</span> · контрагент ${deal.counterparty_id}`;
    }
  }

  function bindDealActions(deal) {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Отменить сделку/i.test(b.textContent)
    );
    if (cancelBtn) {
      cancelBtn.removeAttribute('data-confirm');
      cancelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Отменить сделку? Действие необратимо.')) return;
        try {
          await window.fxApi.deals.cancel(deal.id, 'Отменена через UI');
          window.toast && window.toast('Сделка отменена', 'Статус: CANCELLED', 'info');
          setTimeout(() => (location.href = 'deals.html'), 600);
        } catch (err) {
          window.toast && window.toast('Не удалось отменить', err.message, 'danger');
        }
      });
    }
  }

  async function initDealReviewPage() {
    if (!ensureApi()) return;
    const params = new URLSearchParams(location.search);
    const dealId = params.get('id');
    if (!dealId) return;
    let deal;
    try {
      deal = await window.fxApi.deals.get(dealId);
      applyDealHero(deal);
    } catch (e) {
      softWarn('Сделка: ' + e.message);
      return;
    }
    const approveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Согласовать/i.test(b.textContent)
    );
    const returnBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Вернуть на исправление/i.test(b.textContent)
    );
    const rejectBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Отклонить/i.test(b.textContent)
    );
    const commentEl = document.querySelector('textarea.form-textarea');

    function bind(btn, fn) {
      if (!btn) return;
      btn.removeAttribute('data-confirm');
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await fn();
        } catch (err) {
          window.toast && window.toast('Ошибка', err.message, 'danger');
        }
      });
    }

    bind(approveBtn, async () => {
      const result = await window.fxApi.deals.approve(deal.id);
      window.toast && window.toast('Согласовано', `Статус ${result.status}`, 'success');
      setTimeout(() => (location.href = 'queue.html'), 600);
    });
    bind(returnBtn, async () => {
      const comment = (commentEl && commentEl.value.trim()) || prompt('Причина возврата:');
      if (!comment) {
        window.toast && window.toast('Комментарий обязателен', 'Заполните причину возврата', 'warn');
        return;
      }
      await window.fxApi.deals.returnForEdit(deal.id, comment);
      window.toast && window.toast('Возвращено на исправление', '', 'info');
      setTimeout(() => (location.href = 'queue.html'), 600);
    });
    bind(rejectBtn, async () => {
      const comment = commentEl && commentEl.value.trim();
      await window.fxApi.deals.reject(deal.id, comment || null);
      window.toast && window.toast('Отклонено', '', 'info');
      setTimeout(() => (location.href = 'queue.html'), 600);
    });
  }

  async function initReportsPage() {
    if (!ensureApi()) return;
    const printBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Печать|Экспорт/i.test(b.textContent)
    );
    if (printBtn) {
      printBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await window.fxApi.reports.downloadDealsCsv({});
          window.toast && window.toast('Отчёт сформирован', 'Файл deals_report.csv готов', 'success');
        } catch (err) {
          window.toast && window.toast('Не удалось сформировать отчёт', err.message, 'danger');
        }
      });
    }
  }

  function greetingFor(date) {
    const h = date.getHours();
    if (h < 5) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }

  function applyDashboardGreeting(user) {
    const title = document.querySelector('.page-title');
    if (!title) return;
    const name = (user && (user.firstName || user.first_name)) || (user && user.email) || 'коллега';
    title.textContent = `${greetingFor(new Date())}, ${name}.`;
  }

  function fmtVolumeRub(rub) {
    if (rub >= 1e9) return { val: (rub / 1e9).toFixed(2).replace('.', ','), unit: 'млрд' };
    if (rub >= 1e6) return { val: (rub / 1e6).toFixed(1).replace('.', ','), unit: 'млн' };
    if (rub >= 1e3) return { val: (rub / 1e3).toFixed(0), unit: 'тыс' };
    return { val: Math.round(rub).toString(), unit: '' };
  }

  function setKpi(card, value, unit, deltaText, deltaCls, metaText) {
    if (!card) return;
    const valEl = card.querySelector('.kpi-value');
    if (valEl) valEl.innerHTML = `${value}${unit ? `<span class="kpi-unit">${unit}</span>` : ''}`;
    const metaEl = card.querySelector('.kpi-meta');
    if (metaEl) metaEl.innerHTML = `<span class="kpi-delta ${deltaCls || 'flat'}">${deltaText}</span><span>${metaText}</span>`;
  }

  function renderDashboardRecent(tbody, items) {
    tbody.innerHTML = '';
    if (!items.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" class="muted" style="text-align:center;padding:24px">Сделок пока нет</td>`;
      tbody.appendChild(tr);
      return;
    }
    items.forEach((d) => {
      const tr = document.createElement('tr');
      const href = `deal-detail.html?id=${d.id}`;
      tr.dataset.go = href;
      const pill = pillFor(d.status);
      const shortId = (d.id || '').slice(0, 8).toUpperCase();
      tr.innerHTML = `
        <td class="tbl-id">D-${shortId}</td>
        <td class="mono">${fmtTime(d.created_at)}</td>
        <td><span class="tbl-pair">${d.buy_currency}</span><span class="tbl-pair-arrow">→</span><span class="tbl-pair">${d.sell_currency}</span></td>
        <td class="mono">${d.deal_type}</td>
        <td class="num">${fmtMoney(d.amount)}</td>
        <td class="num">${fmtRate(d.rate)}</td>
        <td><span class="${pill.cls}">${pill.label}</span></td>
        <td class="right"><button class="btn sm ghost" data-go="${href}">→</button></td>
      `;
      tbody.appendChild(tr);
    });
    bindRowsNavigate(tbody);
  }

  function pickKpiCard(idx) {
    return document.querySelectorAll('.kpi-grid .kpi-card')[idx];
  }

  async function renderTraderDashboard() {
    const payload = await window.fxApi.deals.list({ page_size: 100 });
    const items = (payload && payload.items) || [];
    const today = new Date().toISOString().slice(0, 10);

    const todayDeals = items.filter((d) => (d.trade_date || '').slice(0, 10) === today);
    const inProgress = items.filter((d) => d.status === 'WAITING_FOR_POSITIONER' || d.status === 'DRAFT');
    const rejected = items.filter((d) => d.status === 'REJECTED' || d.status === 'CANCELLED');

    let volumeRub = 0;
    items.forEach((d) => {
      const amt = Number(d.amount) || 0;
      const rate = Number(d.rate) || 0;
      if (d.sell_currency === 'RUB') volumeRub += amt * rate;
      else if (d.buy_currency === 'RUB') volumeRub += amt;
    });
    const v = fmtVolumeRub(volumeRub);

    setKpi(pickKpiCard(0), todayDeals.length, 'шт', `${todayDeals.length}`, 'flat', 'создано сегодня');
    setKpi(pickKpiCard(1), v.val, v.unit, '-', 'flat', 'оборот за все время');
    setKpi(pickKpiCard(2), inProgress.length, '', `${inProgress.length}`, 'flat', 'DRAFT + на согласовании');
    setKpi(pickKpiCard(3), rejected.length, '', `${rejected.length}`, 'flat', 'возвращено / отменено');

    const tbody = document.querySelector('.row-2 .card table tbody');
    if (tbody) {
      const recent = items
        .slice()
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, 6);
      renderDashboardRecent(tbody, recent);
    }
  }

  async function renderPositionerDashboard() {
    const queue = await window.fxApi.deals.queue({ page_size: 100 });
    // queue endpoint returns a bare array; deals.list returns { items, total, ... }
    const items = Array.isArray(queue) ? queue : (queue && queue.items) || [];
    const today = new Date().toISOString().slice(0, 10);
    const newToday = items.filter((d) => (d.created_at || '').slice(0, 10) === today);

    setKpi(pickKpiCard(0), items.length, 'шт', `${items.length}`, 'flat', 'в очереди');
    setKpi(pickKpiCard(1), newToday.length, 'шт', `${newToday.length}`, 'flat', 'пришло сегодня');
    setKpi(pickKpiCard(2), '-', '', '-', 'flat', 'среднее время согласования');
    setKpi(pickKpiCard(3), '-', '', '-', 'flat', 'нарушено лимитов');

    const tbody = document.querySelector('.row-2 .card table tbody');
    if (tbody) renderDashboardRecent(tbody, items.slice(0, 6));
  }

  async function renderAuditorDashboard() {
    const audit = await window.fxApi.audit.list({ page_size: 100 });
    const events = (audit && audit.items) || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = events.filter((e) => (e.occurred_at || e.created_at || '').slice(0, 10) === today);
    const creates = events.filter((e) => /CREATE/i.test(e.event_type || e.action || ''));
    const statusChanges = events.filter((e) => /STATUS/i.test(e.event_type || e.action || ''));

    setKpi(pickKpiCard(0), events.length, '', `${events.length}`, 'flat', 'всего событий');
    setKpi(pickKpiCard(1), todayEvents.length, '', `${todayEvents.length}`, 'flat', 'за сегодня');
    setKpi(pickKpiCard(2), creates.length, '', '-', 'flat', 'создания сделок');
    setKpi(pickKpiCard(3), statusChanges.length, '', '-', 'flat', 'смены статусов');
  }

  async function initDashboardPage() {
    const user = (window.fxApi && window.fxApi.getUserFromToken && window.fxApi.getUserFromToken()) || null;
    applyDashboardGreeting(user || {});
    if (!ensureApi()) return;
    try {
      const role = (user && user.role) || 'TRADER';
      if (role === 'TRADER') await renderTraderDashboard();
      else if (role === 'POSITIONER') await renderPositionerDashboard();
      else if (role === 'AUDITOR' || role === 'ADMIN') await renderAuditorDashboard();
    } catch (e) {
      softWarn('Дашборд: ' + e.message);
    }
  }

  function bootstrap() {
    const page = document.body.dataset.page;
    const map = {
      dashboard: initDashboardPage,
      deals: initDealsPage,
      queue: initQueuePage,
      audit: initAuditPage,
      counterparties: initCounterpartiesPage,
      accounts: initAccountsPage,
      'deal-new': initDealNewPage,
      'deal-detail': initDealDetailPage,
      'deal-review': initDealReviewPage,
      reports: initReportsPage,
    };
    const init = map[page];
    if (init) init();

    const exportBtn = Array.from(document.querySelectorAll('.page-actions button')).find((b) =>
      /Экспорт|Печать отчёта/i.test(b.textContent)
    );
    if (page === 'deals' && exportBtn && ensureApi()) {
      exportBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const card = document.querySelector('.card');
        try {
          await window.fxApi.reports.downloadDealsCsv(buildFilters(card));
          window.toast && window.toast('Отчёт сформирован', 'deals_report.csv', 'success');
        } catch (err) {
          window.toast && window.toast('Не удалось сформировать отчёт', err.message, 'danger');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.fxViews = {
    renderDealsTable,
    bindRowsNavigate,
    fmtMoney,
    fmtRate,
    fmtTime,
    pillFor,
  };
})();
