/*!
 * My Finance Planner — user interface.
 * Vanilla JavaScript. All calculations live in js/engine.js; persistence in js/store.js.
 * Every piece of user-provided text is HTML-escaped by the `html` template tag.
 */
(function () {
  'use strict';
  const E = window.MFP.Engine;
  const Store = window.MFP.Store;
  const Sample = window.MFP.Sample;

  /* ======================================================================
   * 1. Helpers
   * ====================================================================== */
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = function (s) { return new Safe(String(s)); };
  function fmt(v) {
    if (v === null || v === undefined || v === false) return '';
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(fmt).join('');
    return E.escapeHtml(v);
  }
  /** Tagged template: interpolated values are escaped unless wrapped in raw()/html``. */
  function html(strings) {
    let out = '';
    for (let i = 0; i < strings.length; i++) { out += strings[i]; if (i + 1 < arguments.length) out += fmt(arguments[i + 1]); }
    return new Safe(out);
  }
  const $ = function (sel, el) { return (el || document).querySelector(sel); };
  const $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  const money = function (p, o) { return E.formatGBP(p, o); };
  const attr = function (p) { return p == null ? '' : E.penceToDecimal(p); };
  const catLabel = function (key) { const c = Store.EXPENSE_CATEGORIES.find(function (x) { return x.key === key; }); return c ? c.label : key; };
  const incomeTypeLabel = function (key) { const c = Store.INCOME_TYPES.find(function (x) { return x.key === key; }); return c ? c.label : key; };
  const spendLabel = function (key) { const c = E.SPEND_CATS.find(function (x) { return x.key === key; }); return c ? c.label : key; };
  const plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  function todayISOFor(m) {
    const t = new Date();
    return E.monthKey(t) === m ? E.isoDate(t) : m + '-01';
  }

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    income: '<path d="M12 3v14"/><path d="M6 11l6 6 6-6"/><path d="M5 21h14"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2" fill="currentColor"/><path d="M7 6V5a2 2 0 012-2h8"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    route: '<path d="M3 6l6 6 4-4 8 8"/><path d="M15 16h6v-6"/>',
    piggy: '<path d="M5 11a7 6 0 0113-2h1.5a1.5 1.5 0 010 3H19a7 6 0 01-3 4.3V19h-3v-1.5h-3V19H7v-2.8A6 6 0 015 11z"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    restore: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    chevronR: '<path d="M9 6l6 6-6 6"/>',
    chevronL: '<path d="M15 6l-6 6 6 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/>',
    upload: '<path d="M12 15V3m0 0L8 7m4-4l4 4M5 21h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.9-3M4 13a8 8 0 0014.9 3"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.4-2.9-5.5-3"/>',
    minus: '<path d="M5 12h14"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>'
  };
  function icon(name, cls) {
    return raw('<svg class="' + (cls || '') + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>');
  }

  /* ======================================================================
   * 2. State and persistence
   * ====================================================================== */
  let S = null;
  let storageOk = true;
  const ui = {
    route: 'dashboard',
    month: E.monthKey(new Date()),
    expanded: new Set(),
    expFilter: 'all',
    pickerOpen: false,
    pickerYear: new Date().getFullYear(),
    drawerOpen: false
  };
  let lastCtx = null;

  function persist() {
    const r = Store.save(S);
    if (!r.ok) toast(r.error, 'danger', 9000);
    return r.ok;
  }
  /** Applies a change, saves it and re-renders everything that depends on it. */
  function commit(fn, message, kind) {
    fn(S);
    persist();
    render();
    if (message) toast(message, kind || 'success');
  }
  function monthRec(m) {
    if (!S.months[m]) S.months[m] = Store.emptyMonth();
    return S.months[m];
  }
  function hasAnyData() {
    return S.debts.length > 0 || S.expenses.length > 0 || S.incomeSources.length > 0 ||
      Object.keys(S.months).some(function (k) { return E.monthHasData(S.months[k]); });
  }
  function findDebt(id) { return S.debts.find(function (d) { return d.id === id; }); }

  /* ======================================================================
   * 3. Theme, sidebar and drawer
   * ====================================================================== */
  function applyTheme() {
    const theme = S.settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('myFinancePlanner.theme', theme); } catch (e) { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F5F7FA' : '#101C2B');
    $$('[data-action="toggle-theme"]').forEach(function (b) { b.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'); });
  }
  function applySidebar() {
    const app = $('#app');
    app.classList.toggle('is-collapsed', !!S.settings.sidebarCollapsed);
    const b = $('.sidebar__collapse');
    b.setAttribute('aria-expanded', String(!S.settings.sidebarCollapsed));
    b.setAttribute('aria-label', S.settings.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    b.querySelector('.label').textContent = S.settings.sidebarCollapsed ? 'Expand' : 'Collapse';
  }
  function setDrawer(open) {
    ui.drawerOpen = open;
    $('#app').classList.toggle('is-drawer-open', open);
    $('[data-action="open-drawer"]').setAttribute('aria-expanded', String(open));
    if (open) { const first = $('#nav a'); if (first) first.focus(); }
  }

  /* ======================================================================
   * 4. Navigation chrome
   * ====================================================================== */
  const ROUTES = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    { key: 'income', label: 'Income', icon: 'income' },
    { key: 'expenses', label: 'Expenses', icon: 'receipt' },
    { key: 'spending', label: 'Spending', icon: 'wallet' },
    { key: 'debts', label: 'Debts', icon: 'card' },
    { key: 'plan', label: 'Repayment Plan', icon: 'route' },
    { key: 'savings', label: 'Savings', icon: 'piggy' },
    { key: 'sheet', label: 'Monthly Spreadsheet', icon: 'table' },
    { key: 'settings', label: 'Settings', icon: 'gear' }
  ];
  const BOTTOM = [
    { key: 'dashboard', label: 'Home', icon: 'home' },
    { key: 'spending', label: 'Spending', icon: 'wallet' },
    { key: 'debts', label: 'Debts', icon: 'card' },
    { key: 'sheet', label: 'Sheet', icon: 'table' }
  ];

  function renderChrome() {
    const route = ROUTES.find(function (r) { return r.key === ui.route; }) || ROUTES[0];
    $('#nav').innerHTML = ROUTES.map(function (r) {
      return html`<a class="nav__link" href="#${r.key}" ${r.key === ui.route ? raw('aria-current="page"') : ''} title="${r.label}">${icon(r.icon)}<span class="label">${r.label}</span></a>`.s;
    }).join('');
    $('#bottom-nav').innerHTML = BOTTOM.map(function (r) {
      return html`<a href="#${r.key}" ${r.key === ui.route ? raw('aria-current="page"') : ''}>${icon(r.icon)}<span>${r.label}</span></a>`.s;
    }).join('') + html`<button type="button" data-action="open-drawer" aria-label="More pages">${icon('more')}<span>More</span></button>`.s;
    $('#topbar-title').textContent = route.label;
    document.title = route.label + ' · My Finance Planner';
    renderMonthPicker();
  }

  function renderMonthPicker() {
    const current = E.monthKey(new Date());
    const isCurrent = ui.month === current;
    let pop = '';
    if (ui.pickerOpen) {
      const y = ui.pickerYear;
      const cells = E.MONTHS.map(function (name, i) {
        const k = y + '-' + String(i + 1).padStart(2, '0');
        const has = S.months[k] && E.monthHasData(S.months[k]);
        const cls = 'month-pop__cell' + (k === current ? ' is-current' : '') + (has ? ' has-data' : '');
        return html`<button type="button" class="${cls}" data-action="pick-month" data-month="${k}" aria-pressed="${k === ui.month ? 'true' : 'false'}" aria-label="${name} ${y}${k === current ? ' (this month)' : ''}${has ? ', has records' : ''}">${name.slice(0, 3)}</button>`;
      });
      pop = html`<div class="month-pop" role="dialog" aria-label="Choose a month" id="month-pop">
        <div class="month-pop__head">
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="picker-year" data-delta="-1" aria-label="Previous year">${icon('chevronL')}</button>
          <strong>${y}</strong>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="picker-year" data-delta="1" aria-label="Next year">${icon('chevronR')}</button>
        </div>
        <div class="month-pop__grid">${cells}</div>
        <div class="month-pop__foot">
          <button type="button" class="btn btn--ghost btn--sm" data-action="pick-month" data-month="${current}">This month</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="close-picker">Close</button>
        </div>
      </div>`;
    }
    $('#month-picker').innerHTML = html`
      <button type="button" class="month-picker__step" data-action="step-month" data-delta="-1" aria-label="Previous month">${icon('chevronL')}</button>
      <button type="button" class="month-picker__label" data-action="toggle-picker" aria-haspopup="dialog" aria-expanded="${ui.pickerOpen ? 'true' : 'false'}" aria-label="Selected month: ${E.monthLabel(ui.month)}. Choose month">
        ${icon('calendar')}<span>${E.monthLabel(ui.month)}</span>${isCurrent ? raw('<span class="month-picker__dot" title="This month" aria-hidden="true"></span>') : ''}
      </button>
      <button type="button" class="month-picker__step" data-action="step-month" data-delta="1" aria-label="Next month">${icon('chevronR')}</button>
      ${pop}`.s;
  }

  function setMonth(m) {
    if (!E.isMonthKey(m)) return;
    ui.month = m;
    ui.pickerOpen = false;
    render();
  }

  /* ======================================================================
   * 5. Compute and render
   * ====================================================================== */
  function compute() {
    const today = new Date();
    const sim = E.simulate(S, { today: today, includeMonth: ui.month });
    const row = E.rowFor(sim, ui.month);
    const plan = E.spendingPlan(S, ui.month, row, { today: today });
    return { today: today, sim: sim, row: row, plan: plan, m: ui.month, current: sim.current };
  }

  /** Keeps a snapshot of the current month's forecast so past months can show forecast vs actual. */
  function snapshotForecast(ctx) {
    const rec = S.months[ctx.current];
    const row = E.rowFor(ctx.sim, ctx.current);
    if (!rec || !row) return;
    const snap = {
      incomePence: row.incomePence, essentialPence: row.essentialPence, debtPaidPence: row.debtPaidPence,
      savingsPence: row.savingsPence, safeToSpendPence: row.safeToSpendPence, incomeBasis: row.incomeBasis
    };
    const prev = rec.forecast;
    const same = prev && Object.keys(snap).every(function (k) { return prev[k] === snap[k]; });
    if (!same) { snap.savedAt = new Date().toISOString(); rec.forecast = snap; persist(); }
  }

  function render() {
    const focusId = document.activeElement && document.activeElement.id;
    const ctx = compute();
    lastCtx = ctx;
    renderChrome();
    const page = PAGES[ui.route] || PAGES.dashboard;
    $('#main').innerHTML = html`<div class="page">${page(ctx)}</div>`.s;
    if (!storageOk) $('#main').insertAdjacentHTML('afterbegin', alertBox('danger', 'Saving is not available', 'This browser is blocking local storage, so nothing you enter will be kept. Allow site data for this page, or use another browser.').s);
    snapshotForecast(ctx);
    if (focusId && !$('#modal').open) { const el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
  }

  /* ======================================================================
   * 6. Components
   * ====================================================================== */
  function pageHead(title, sub, actions) {
    return html`<header class="page-head"><div><h1 id="page-title" tabindex="-1">${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ''}</div>${actions ? html`<div class="page-actions">${actions}</div>` : ''}</header>`;
  }
  function metric(o) {
    return html`<div class="metric ${o.tone ? 'metric--' + o.tone : ''}">
      <div class="metric__label">${o.icon ? icon(o.icon) : ''}${o.label}</div>
      <div class="metric__value">${o.value}</div>
      ${o.sub ? html`<div class="metric__sub">${o.sub}</div>` : ''}
    </div>`;
  }
  function badge(text, kind, ic) { return html`<span class="badge ${kind ? 'badge--' + kind : ''}">${ic ? icon(ic) : ''}${text}</span>`; }
  const STATUS = {
    ok: { text: 'On track', kind: 'positive', icon: 'ok' },
    tight: { text: 'Tight', kind: 'debt', icon: 'info' },
    over: { text: 'Over-allocated', kind: 'danger', icon: 'alert' },
    shortfall: { text: 'Shortfall', kind: 'danger', icon: 'alert' }
  };
  function statusBadge(st) { const s = STATUS[st]; return badge(s.text, s.kind, s.icon); }
  function basisBadge(b) {
    if (b === 'confirmed') return badge('Confirmed', 'positive', 'check');
    if (b === 'assumed-manual') return badge('Assumed · your figure', 'outline');
    if (b === 'assumed-latest') return badge('Assumed · latest confirmed', 'outline');
    return badge('Not entered', 'danger', 'alert');
  }
  function phaseBadge(p) {
    if (p === 'actual') return badge('Actual', 'savings', 'check');
    if (p === 'current') return badge('This month', 'positive', 'calendar');
    return badge('Forecast', 'outline');
  }
  function progress(value, kind, label, extraCls) {
    const pct = Math.max(0, Math.min(1, value || 0)) * 100;
    return html`<div class="progress ${kind ? 'progress--' + kind : ''} ${extraCls || ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${label}"><div class="progress__bar" style="width:${pct.toFixed(1)}%"></div></div>`;
  }
  function alertBox(kind, title, body, actions) {
    const ic = { info: 'info', warning: 'alert', danger: 'alert', success: 'ok' }[kind];
    return html`<div class="alert alert--${kind}" role="${kind === 'danger' ? 'alert' : 'note'}">${icon(ic)}<div class="alert__body">${title ? html`<div class="alert__title">${title}</div>` : ''}${body ? html`<div>${body}</div>` : ''}${actions ? html`<div class="row">${actions}</div>` : ''}</div></div>`;
  }
  function empty(ic, title, text, action) {
    return html`<div class="empty"><div class="empty__icon">${icon(ic)}</div><h2>${title}</h2><p>${text}</p>${action || ''}</div>`;
  }
  function btn(label, action, opts) {
    opts = opts || {};
    const data = Object.keys(opts.data || {}).map(function (k) { return ' data-' + k + '="' + E.escapeHtml(opts.data[k]) + '"'; }).join('');
    return html`<button type="${opts.type || 'button'}" class="btn ${opts.cls || 'btn--secondary'}" ${action ? raw('data-action="' + action + '"') : ''}${raw(data)} ${opts.label ? raw('aria-label="' + E.escapeHtml(opts.label) + '"') : ''} ${opts.title ? raw('title="' + E.escapeHtml(opts.title) + '"') : ''}>${opts.icon ? icon(opts.icon) : ''}${opts.iconOnly ? '' : label}</button>`;
  }
  function iconBtn(ic, label, action, data, cls) {
    return btn(label, action, { icon: ic, iconOnly: true, label: label, title: label, data: data, cls: 'btn--ghost btn--icon btn--sm ' + (cls || '') });
  }
  function moneyField(o) {
    const id = o.id || ('f-' + o.name);
    return html`<div class="field ${o.span ? 'span-2' : ''}">
      <label for="${id}">${o.label}${o.optional ? html` <span class="subtle">(optional)</span>` : ''}</label>
      <div class="money-input ${o.sm ? 'money-input--sm' : ''}"><input class="input" id="${id}" name="${o.name}" inputmode="decimal" autocomplete="off" value="${o.value != null ? o.value : ''}" placeholder="${o.placeholder || '0.00'}" ${o.required ? raw('required') : ''} ${o.describedby ? raw('aria-describedby="' + o.describedby + '"') : ''}></div>
      ${o.hint ? html`<div class="field__hint" id="${id}-hint">${o.hint}</div>` : ''}
    </div>`;
  }
  function textField(o) {
    const id = o.id || ('f-' + o.name);
    return html`<div class="field ${o.span ? 'span-2' : ''}">
      <label for="${id}">${o.label}${o.optional ? html` <span class="subtle">(optional)</span>` : ''}</label>
      <input class="input" id="${id}" name="${o.name}" type="${o.type || 'text'}" value="${o.value != null ? o.value : ''}" ${o.placeholder ? raw('placeholder="' + E.escapeHtml(o.placeholder) + '"') : ''} ${o.required ? raw('required') : ''} ${o.attrs ? raw(o.attrs) : ''} autocomplete="off">
      ${o.hint ? html`<div class="field__hint">${o.hint}</div>` : ''}
    </div>`;
  }
  /** British date entry (DD/MM/YYYY) regardless of the browser's locale. */
  function dateField(o) {
    return textField(Object.assign({}, o, { type: 'text', value: o.value ? E.formatDate(o.value) : '', placeholder: 'DD/MM/YYYY', attrs: 'inputmode="numeric" maxlength="10" pattern="\\d{1,2}/\\d{1,2}/\\d{4}"', hint: o.hint || 'Format: DD/MM/YYYY' }));
  }
  function selectField(o) {
    const id = o.id || ('f-' + o.name);
    return html`<div class="field ${o.span ? 'span-2' : ''}">
      <label for="${id}">${o.label}</label>
      <select class="select" id="${id}" name="${o.name}">${o.options.map(function (op) { return html`<option value="${op.value}" ${String(op.value) === String(o.value) ? raw('selected') : ''}>${op.label}</option>`; })}</select>
      ${o.hint ? html`<div class="field__hint">${o.hint}</div>` : ''}
    </div>`;
  }

  /** Accessible SVG line chart of projected debt and savings balances. */
  function projectionChart(sim, opts) {
    opts = opts || {};
    const rows = sim.rows.filter(function (r) { return r.month >= sim.current; });
    if (rows.length < 2) return '';
    const main = $('#main');
    const W = Math.max(300, Math.min(1000, (main ? main.clientWidth : 800) - (opts.inset || 90)));
    const H = W < 500 ? 200 : 240;
    const padL = 64, padR = 16, padT = 16, padB = 28;
    const showSav = opts.savings !== false && rows.some(function (r) { return r.savingsBalancePence; });
    const maxV = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Math.max(opts.debt === false ? 0 : r.closingDebtPence, showSav ? (r.savingsBalancePence || 0) : 0); })));
    const niceMax = niceCeil(maxV);
    const n = rows.length;
    const x = function (i) { return padL + (W - padL - padR) * (n === 1 ? 0 : i / (n - 1)); };
    const y = function (v) { return padT + (H - padT - padB) * (1 - v / niceMax); };
    const path = function (fn) { return rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(fn(r)).toFixed(1); }).join(' '); };
    let svg = '';
    [0, 0.5, 1].forEach(function (f) {
      const v = niceMax * f;
      svg += '<line class="gridline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      svg += '<text x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + E.escapeHtml(E.formatGBP(Math.round(v), { whole: true })) + '</text>';
    });
    if (opts.debt !== false && sim.hasDebts) {
      svg += '<path class="area-debt" d="' + path(function (r) { return r.closingDebtPence; }) + ' L' + x(n - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z"/>';
      svg += '<path class="line-debt" d="' + path(function (r) { return r.closingDebtPence; }) + '"/>';
    }
    if (showSav) svg += '<path class="line-savings" d="' + path(function (r) { return r.savingsBalancePence || 0; }) + '"/>';
    const labels = [0, Math.floor((n - 1) / 2), n - 1];
    labels.forEach(function (i, j) {
      svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="' + (j === 0 ? 'start' : j === 2 ? 'end' : 'middle') + '">' + E.escapeHtml(E.monthLabel(rows[i].month, true)) + '</text>';
    });
    if (sim.debtFreeMonth && opts.debt !== false) {
      const i = rows.findIndex(function (r) { return r.month === sim.debtFreeMonth; });
      if (i > 0) {
        svg += '<line class="marker" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + padT + '" y2="' + (H - padB) + '"/>';
        svg += '<text class="marker-label" x="' + (x(i) - 6) + '" y="' + (padT + 12) + '" text-anchor="end">Debt-free ' + E.escapeHtml(E.monthLabel(sim.debtFreeMonth, true)) + '</text>';
      }
    }
    const first = rows[0], last = rows[n - 1];
    const summary = (sim.hasDebts ? 'Projected total debt goes from ' + money(first.closingDebtPence) + ' at the end of ' + E.monthLabel(first.month) + ' to ' + money(last.closingDebtPence) + ' by ' + E.monthLabel(last.month) + '. ' : '') +
      (showSav ? 'Projected savings reach ' + money(last.savingsBalancePence || 0) + '.' : '');
    return html`<figure class="chart" style="margin:0">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${summary}">${raw(svg)}</svg>
      <figcaption class="legend" style="margin-top:8px">
        ${sim.hasDebts && opts.debt !== false ? html`<span class="legend__item"><span class="dot seg-debt"></span>Total debt (solid line)</span>` : ''}
        ${showSav ? html`<span class="legend__item"><span class="dot seg-savings"></span>Savings balance (dashed line)</span>` : ''}
      </figcaption>
    </figure>`;
  }
  function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return nice * p;
  }

  /** Stacked bar showing where income goes this month. */
  function allocationBar(row) {
    const parts = [
      { key: 'essential', label: 'Essential expenses', v: row.essentialPence, cls: 'seg-essential' },
      { key: 'debt', label: 'Debt payments', v: row.debtPaidPence, cls: 'seg-debt' },
      { key: 'savings', label: 'Savings', v: row.savingsPence, cls: 'seg-savings' },
      { key: 'buffer', label: 'Financial buffer', v: row.bufferPence, cls: 'seg-buffer' },
      { key: 'spend', label: 'Safe to spend', v: row.safeToSpendPence, cls: 'seg-spend' }
    ];
    if (row.shortfallPence > 0) parts.push({ key: 'shortfall', label: 'Shortfall (not covered)', v: row.shortfallPence, cls: 'seg-shortfall' });
    const total = E.sum(parts, function (p) { return p.v; });
    if (total <= 0) return html`<p class="muted">Nothing to show yet. Add your income and expenses for this month.</p>`;
    return html`<div class="stackbar" role="img" aria-label="${parts.filter(function (p) { return p.v > 0; }).map(function (p) { return p.label + ' ' + money(p.v); }).join(', ')}">
        ${parts.filter(function (p) { return p.v > 0; }).map(function (p) { return html`<div class="stackbar__seg ${p.cls}" style="width:${(p.v / total * 100).toFixed(2)}%" title="${p.label}: ${money(p.v)}"></div>`; })}
      </div>
      <div class="legend">${parts.map(function (p) { return html`<div class="legend__item"><span class="dot ${p.cls}"></span>${p.label}<span class="money">${money(p.v)}</span></div>`; })}</div>`;
  }

  function calcExplanation(row, opts) {
    opts = opts || {};
    const basis = row.incomeBasis === 'confirmed' ? 'Confirmed income' : row.incomeBasis === 'none' ? 'Income (not entered)' : 'Assumed income (forecast)';
    const raw_ = row.incomePence - row.essentialPence - row.debtPaidPence - row.savingsPence - row.bufferPence;
    const minus = function (label, v, note) { return html`<dt>− ${label}${note ? html` <span class="subtle">${note}</span>` : ''}</dt><dd>${money(v)}</dd>`; };
    return html`<dl class="calc">
      <dt>${basis}</dt><dd>${money(row.incomePence)}</dd>
      ${minus('Essential expenses', row.essentialPence, '(' + plural(row.expenseCount, 'bill') + ')')}
      ${minus('Minimum debt payments', row.minDebtPence, '(contractual)')}
      ${minus('Additional debt payments', row.extraPaidPence, row.overrides.extraDebtPence != null ? '(your amount)' : '(recommended)')}
      ${minus('Savings allocation', row.savingsPence, row.overrides.savingsPence != null ? '(your amount)' : '(recommended)')}
      ${minus('Financial buffer', row.bufferPence, '(kept aside)')}
      <dt class="total">= Safe-to-spend allowance</dt><dd class="total ${raw_ < 0 ? 't-danger' : 't-positive'}">${raw_ < 0 ? html`${money(0)} <span class="small">(short by ${money(-raw_)})</span>` : money(raw_)}</dd>
    </dl>
    ${opts.notes !== false ? html`<p class="subtle" style="margin-top:12px">Extra debt payments and savings are only recommended from money left after essentials, minimums, your buffer and a protected living reserve of ${money(row.reservePence)}. Safe-to-spend is never shown below £0 — a shortfall is shown instead. Debt payments are counted once, as repayments, never as expenses.</p>` : ''}`;
  }

  /* ======================================================================
   * 7. Pages
   * ====================================================================== */
  const PAGES = {};

  /* ---------- Dashboard ---------- */
  PAGES.dashboard = function (ctx) {
    const row = ctx.row, plan = ctx.plan, sim = ctx.sim, m = ctx.m;
    const isCur = m === ctx.current, isPast = m < ctx.current;
    const out = [];
    out.push(pageHead(E.monthLabel(m), isCur ? 'Your monthly overview' : isPast ? 'Past month — actual results' : 'Future month — forecast using labelled assumptions',
      html`${btn('Record spending', 'add-spend', { icon: 'plus', cls: 'btn--secondary' })}${btn('Record payment', 'add-payment', { icon: 'card', cls: 'btn--primary' })}`));

    if (!hasAnyData()) {
      out.push(html`<section class="card"><div class="stack--lg stack">
        <div><h2>Welcome to My Finance Planner</h2><p class="muted" style="margin-top:6px">A private planner for your monthly budget, debts and savings. Everything stays in this browser — nothing is sent anywhere.</p></div>
        <ol class="steps">
          <li><div><strong>Enter this month's income</strong><div class="muted small">Salary, benefits and anything else you receive.</div></div></li>
          <li><div><strong>Add your regular bills</strong><div class="muted small">Rent, Council Tax, utilities and subscriptions — entered once, carried forward automatically.</div></div></li>
          <li><div><strong>Register each debt</strong><div class="muted small">Balance, interest rate and minimum payment for every card, loan or overdraft.</div></div></li>
          <li><div><strong>See what is safe to spend</strong><div class="muted small">Plus a repayment plan, savings suggestion and debt-free date.</div></div></li>
        </ol>
        <div class="row">${btn('Add income', 'add-income', { icon: 'plus', cls: 'btn--primary' })}${btn('Add a bill', 'add-expense', { icon: 'plus' })}${btn('Add a debt', 'add-debt', { icon: 'plus' })}${btn('Try with example data', 'load-sample', { cls: 'btn--ghost' })}</div>
      </div></section>`);
      return out;
    }

    // Income prompt
    if (row.incomeBasis !== 'confirmed' && !isPast) {
      const sug = incomeSuggestions(m);
      out.push(alertBox(isCur ? 'warning' : 'info', isCur ? 'Confirm your income for ' + E.monthLabel(m) : 'No confirmed income for this future month',
        isCur ? 'Safe-to-spend is calculated from confirmed income only.' + (sug.length ? ' You have ' + plural(sug.length, 'income suggestion') + ' ready to confirm.' : '')
          : (row.incomeBasis === 'none' ? 'This forecast has no income assumption.' : 'This forecast assumes ' + money(row.incomePence) + ' (' + (row.incomeBasis === 'assumed-manual' ? 'your figure' : 'latest confirmed, from ' + E.monthLabel(row.incomeFrom)) + '). It will not be treated as received.'),
        btn(isCur ? 'Enter income' : 'Enter income for this month', 'monthly-checkin', { cls: 'btn--primary btn--sm', icon: 'income' })));
    }
    if (isPast && row.incomeBasis !== 'confirmed') out.push(alertBox('info', 'No income was recorded for this month', 'Past months only show what was recorded.', btn('Add income', 'add-income', { cls: 'btn--sm' })));

    // Overdue
    if (isCur) {
      const od = E.overdueItems(S, sim, ctx.today);
      if (od.length) {
        out.push(alertBox('danger', plural(od.length, 'overdue obligation'), html`<ul>${od.slice(0, 6).map(function (o) {
          return html`<li>${o.label} — ${money(o.shortByPence)} ${o.kind === 'debt' ? 'minimum payment' : 'bill'} ${o.month < ctx.current ? html`missed in ${E.monthLabel(o.month)}` : html`was due ${E.formatDate(o.dueDate)}`}</li>`;
        })}</ul>${od.length > 6 ? html`<div class="small">…and ${od.length - 6} more.</div>` : ''}`,
          html`${btn('Review debts', 'go', { data: { route: 'debts' }, cls: 'btn--sm' })}${btn('Review bills', 'go', { data: { route: 'expenses' }, cls: 'btn--sm btn--ghost' })}`));
      }
    }
    // Shortfall
    if (row.status === 'shortfall' || row.status === 'over') {
      out.push(alertBox('danger', row.status === 'shortfall' ? 'Your income does not cover this month’s obligations' : 'Your planned allocations exceed your income',
        html`<div>Short by <strong>${money(row.shortfallPence)}</strong>. These cannot be fully funded:</div><ul>${row.unfunded.map(function (u) { return html`<li>${u.label}: ${money(u.amountPence)} — short by ${money(u.shortByPence)}</li>`; })}</ul>
        <div class="small">Contractual minimum payments have not been reduced. Consider contacting creditors early, or free debt advice (e.g. StepChange, National Debtline, Citizens Advice).</div>`,
        row.status === 'over' ? btn('Adjust plan', 'go', { data: { route: 'plan' }, cls: 'btn--sm' }) : ''));
    }
    if (sim.nonAmortising.length && !isPast) {
      out.push(alertBox('warning', 'A debt will never be repaid at its minimum payment', html`${sim.nonAmortising.map(function (n) { return html`<div>${n.name}: minimum ${money(n.minPence)} does not cover estimated interest of ${money(n.interestPence)} a month.</div>`; })}`, btn('See repayment plan', 'go', { data: { route: 'plan' }, cls: 'btn--sm' })));
    }

    // Hero: safe to spend
    const remaining = plan.remainingTotalPence;
    out.push(html`<section class="hero" aria-label="Safe to spend">
      <div>
        <div class="hero__label">${icon('wallet')}Safe to spend in ${E.monthLabel(m)}</div>
        <div class="hero__value ${row.safeToSpendPence > 0 ? 'hero__value--positive' : 'hero__value--zero'}">${money(row.safeToSpendPence)}</div>
        <div class="row">${statusBadge(row.status)}${basisBadge(row.incomeBasis)}</div>
        <details class="disclosure" style="margin-top:16px"><summary>${icon('chevronR')}How this was calculated</summary><div class="disclosure__body">${calcExplanation(row)}</div></details>
      </div>
      <div class="hero__side">
        <div class="mini"><div class="mini__label">Remaining this month</div><div class="mini__value ${remaining < 0 ? 't-danger' : ''}">${remaining < 0 ? '−' : ''}${money(Math.abs(remaining))}</div></div>
        <div class="mini"><div class="mini__label">Spent so far</div><div class="mini__value">${money(plan.totalSpentPence)}</div></div>
        <div class="mini"><div class="mini__label">Per day (${plural(plan.daysLeft, 'day')} left)</div><div class="mini__value">${money(plan.perDayPence)}</div></div>
        <div class="mini"><div class="mini__label">Per week</div><div class="mini__value">${money(plan.perWeekPence)}</div></div>
      </div>
    </section>`);

    // Metrics
    const ds = E.debtSummaries(S, sim, m).filter(function (d) { return !d.debt.archived; });
    const totalDebt = E.sum(ds, function (d) { return d.openingPence || 0; });
    const exps = E.monthObligations(S, sim, m, ctx.today).filter(function (o) { return o.kind === 'expense'; });
    const paidExp = exps.filter(function (o) { return o.paid; }).length;
    out.push(html`<section class="grid grid--metrics" aria-label="Monthly summary">
      ${metric({ label: 'Monthly income', icon: 'income', tone: 'positive', value: money(row.incomePence), sub: row.incomeBasis === 'confirmed' ? 'Confirmed' : row.incomeBasis === 'none' ? 'Not entered yet' : 'Assumed for forecast' })}
      ${metric({ label: 'Essential expenses', icon: 'receipt', value: money(row.essentialPence), sub: paidExp + ' of ' + exps.length + ' paid' })}
      ${metric({ label: 'Debt obligations', icon: 'card', tone: 'debt', value: money(row.debtPaidPence), sub: money(row.minDebtPence) + ' minimum + ' + money(row.extraPaidPence) + ' extra' })}
      ${metric({ label: 'Total outstanding debt', icon: 'card', tone: 'debt', value: money(totalDebt), sub: 'Start of month, estimated' })}
      ${metric({ label: 'Planned savings', icon: 'piggy', tone: 'savings', value: money(row.savingsPence), sub: money(row.savingsDepositedPence) + ' deposited' })}
      ${metric({ label: 'Remaining budget', icon: 'wallet', tone: remaining < 0 ? 'danger' : 'spend', value: (remaining < 0 ? '−' : '') + money(Math.abs(remaining)), sub: remaining < 0 ? 'Overspent' : 'Of safe-to-spend' + (plan.carryTotalPence ? ' + carried forward' : '') })}
      ${metric({ label: 'Estimated debt-free', icon: 'flag', tone: 'positive', value: !sim.hasDebts ? 'No debts' : sim.debtFreeMonth ? E.monthLabel(sim.debtFreeMonth) : 'Not within plan', sub: !sim.hasDebts ? 'Nothing registered' : sim.debtFreeMonth ? (sim.debtFreeMonth <= ctx.current ? 'All debts repaid' : plural(E.monthsBetween(ctx.current, sim.debtFreeMonth) + 1, 'month') + ' · estimate') : 'Beyond ' + sim.horizonMonths + '-month horizon' })}
      ${metric({ label: 'Savings balance', icon: 'coins', tone: 'savings', value: money(row.savingsBalancePence || 0), sub: 'End of month, projected' })}
    </section>`);

    // Allocation + obligations
    const obligations = E.monthObligations(S, sim, m, ctx.today);
    const unpaid = obligations.filter(function (o) { return !o.paid; });
    out.push(html`<div class="grid grid--2">
      <section class="card"><div class="card__head"><div><h2>Where your income goes</h2><p class="subtle">${E.monthLabel(m)}</p></div></div>${allocationBar(row)}</section>
      <section class="card">
        <div class="card__head"><div><h2>Unpaid obligations</h2><p class="subtle">${unpaid.length ? plural(unpaid.length, 'item') + ' · ' + money(E.sum(unpaid, function (o) { return o.amountPence - o.paidPence; })) : 'Everything is paid'}</p></div></div>
        ${unpaid.length ? html`<ul class="list">${unpaid.slice(0, 8).map(function (o) { return obligationItem(o, m); })}</ul>${unpaid.length > 8 ? html`<p class="subtle" style="margin-top:8px">${btn('See all', 'go', { data: { route: 'expenses' }, cls: 'btn--ghost btn--sm' })}</p>` : ''}`
          : html`<p class="muted">${obligations.length ? 'All bills and minimum payments for this month are marked as paid.' : 'No bills or debts registered for this month.'}</p>`}
      </section>
    </div>`);

    // Spending categories compact
    out.push(html`<section class="card">
      <div class="card__head"><div><h2>Spending budget</h2><p class="subtle">${plan.basis === 'history' ? 'Based on your recent spending' : 'Based on your percentage split'}</p></div>${btn('Open spending', 'go', { data: { route: 'spending' }, cls: 'btn--ghost btn--sm', icon: 'chevronR' })}</div>
      <div class="grid grid--3">${plan.cats.map(function (c) {
        return html`<div class="stack" style="gap:6px">
          <div class="row row--between small"><span class="t-strong">${c.label}</span><span class="${c.over ? 't-danger t-strong' : 'muted'}">${c.over ? html`${icon('alert', 'inline')} Over by ${money(-c.remainingPence)}` : money(c.remainingPence) + ' left'}</span></div>
          ${progress(c.pctUsed, c.over ? 'over' : 'spend', c.label + ': ' + money(c.spentPence) + ' of ' + money(c.availablePence) + ' used')}
          <div class="subtle">${money(c.spentPence)} of ${money(c.availablePence)}</div>
        </div>`;
      })}</div>
    </section>`);

    // Projection chart
    if (sim.hasDebts || row.savingsBalancePence) {
      out.push(html`<section class="card"><div class="card__head"><div><h2>Projection</h2><p class="subtle">Estimates using ${E.STRATEGIES[sim.strategy].label.toLowerCase()} — not guaranteed</p></div>${btn('Open spreadsheet', 'go', { data: { route: 'sheet' }, cls: 'btn--ghost btn--sm', icon: 'chevronR' })}</div>${projectionChart(sim)}</section>`);
    }
    out.push(backupReminder());
    return out;
  };

  function obligationItem(o, m) {
    const due = o.dueDate ? 'Due ' + E.formatDate(o.dueDate) : 'No due date';
    return html`<li class="list__item">
      <div class="list__main">
        <div class="list__title">${o.label}</div>
        <div class="list__meta">${o.kind === 'debt' ? badge('Debt minimum', 'debt') : badge('Bill')} <span>${due}</span>${o.overdue ? badge('Overdue', 'danger', 'alert') : ''}${o.kind === 'debt' && o.paidPence ? html`<span>${money(o.paidPence)} paid</span>` : ''}</div>
      </div>
      <div class="list__amount">${money(o.amountPence - o.paidPence)}</div>
      ${o.kind === 'expense'
        ? btn('Mark paid', 'toggle-paid', { data: { id: o.id, month: m, paid: '1' }, cls: 'btn--secondary btn--sm', icon: 'check' })
        : btn('Pay', 'quick-pay', { data: { id: o.id, month: m, amount: o.amountPence - o.paidPence }, cls: 'btn--secondary btn--sm', icon: 'check', title: 'Record the minimum payment as paid' })}
    </li>`;
  }

  function backupReminder() {
    if (!hasAnyData()) return '';
    const last = S.settings.lastBackupAt ? new Date(S.settings.lastBackupAt) : null;
    const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    if (days !== null && days < 30) return '';
    return alertBox('info', last ? 'Your last backup was ' + plural(days, 'day') + ' ago' : 'You have not made a backup yet',
      'Your data lives only in this browser. Clearing browser data, using private browsing or changing device will lose it. Download a backup regularly.',
      btn('Backup data', 'backup', { icon: 'download', cls: 'btn--primary btn--sm' }));
  }

  /* ---------- Income ---------- */
  function incomeSuggestions(m) {
    const rec = S.months[m];
    const used = new Set(rec ? rec.income.map(function (i) { return i.sourceId; }).filter(Boolean) : []);
    const dismissed = new Set(rec ? rec.dismissedSources : []);
    return S.incomeSources.filter(function (s) { return s.active && !used.has(s.id) && !dismissed.has(s.id); });
  }
  PAGES.income = function (ctx) {
    const m = ctx.m, rec = S.months[m], entries = rec ? rec.income : [];
    const total = E.sum(entries, function (i) { return i.amountPence; });
    const sug = incomeSuggestions(m);
    const out = [pageHead('Income', E.monthLabel(m) + ' · income is entered for each month separately', btn('Add income', 'add-income', { icon: 'plus', cls: 'btn--primary' }))];

    if (m > ctx.current && !entries.length) {
      const r = ctx.row;
      out.push(html`<section class="card"><form class="form" data-form="assumption" data-month="${m}">
        <div><h2>Forecast assumption</h2><p class="muted small" style="margin-top:4px">${r.incomeBasis === 'assumed-latest' ? 'Forecasts currently assume ' + money(r.incomePence) + ', your latest confirmed income (' + E.monthLabel(r.incomeFrom) + ').' : r.incomeBasis === 'assumed-manual' ? 'You have set an assumption for this month.' : 'No assumption is being used for this month.'} An assumption is never counted as received income.</p></div>
        <div class="row" style="align-items:flex-end">${moneyField({ name: 'assumed', label: 'Assumed income for ' + E.monthLabel(m), value: rec && rec.assumedIncomePence != null ? attr(rec.assumedIncomePence) : '', placeholder: r.incomeBasis === 'assumed-latest' ? attr(r.incomePence) : '0.00' })}
          ${btn('Save assumption', null, { type: 'submit', cls: 'btn--primary' })}${rec && rec.assumedIncomePence != null ? btn('Clear', 'clear-assumption', { data: { month: m }, cls: 'btn--ghost' }) : ''}</div>
      </form></section>`);
    }

    if (sug.length) {
      out.push(html`<section class="card"><div class="card__head"><div><h2>Suggested for ${E.monthLabel(m)}</h2><p class="subtle">These are not counted until you confirm them. Adjust the amount if it was different.</p></div></div>
        <ul class="list">${sug.map(function (s) {
          return html`<li class="list__item"><div class="list__main"><div class="list__title">${s.description}</div><div class="list__meta">${incomeTypeLabel(s.type)}</div></div>
            <div class="money-input money-input--sm" style="width:130px"><input class="input" id="sug-${s.id}" inputmode="decimal" value="${attr(s.amountPence)}" aria-label="Amount for ${s.description}"></div>
            ${btn('Confirm', 'confirm-suggestion', { data: { id: s.id, month: m }, cls: 'btn--primary btn--sm', icon: 'check' })}
            ${iconBtn('x', 'Dismiss for this month', 'dismiss-suggestion', { id: s.id, month: m })}</li>`;
        })}</ul></section>`);
    }

    out.push(html`<section class="card card--flush">
      <div class="card__head" style="padding:20px 20px 0"><div><h2>Confirmed income</h2><p class="subtle">${plural(entries.length, 'entry', 'entries')} · ${money(total)}</p></div></div>
      ${entries.length ? html`<div class="table-wrap"><table class="table table--stack"><thead><tr><th>Description</th><th>Type</th><th class="num">Amount</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${entries.map(function (i) { return html`<tr><td class="primary" data-label="Description">${i.description} ${i.sourceId ? badge('Monthly suggestion', 'outline') : ''}</td><td data-label="Type">${incomeTypeLabel(i.type)}</td><td class="num" data-label="Amount">${money(i.amountPence)}</td>
          <td class="actions">${iconBtn('edit', 'Edit ' + i.description, 'edit-income', { id: i.id, month: m })}${iconBtn('trash', 'Delete ' + i.description, 'delete-income', { id: i.id, month: m })}</td></tr>`; })}
        </tbody><tfoot><tr><td>Total</td><td></td><td class="num">${money(total)}</td><td></td></tr></tfoot></table></div>`
        : empty('income', 'No income confirmed for ' + E.monthLabel(m), 'Income never repeats automatically. Add what you actually received, or confirm a suggestion.', btn('Add income', 'add-income', { icon: 'plus', cls: 'btn--primary' }))}
    </section>`);

    out.push(html`<section class="card"><div class="card__head"><div><h2>Monthly suggestions</h2><p class="subtle">Regular income offered for confirmation at the start of each month.</p></div></div>
      ${S.incomeSources.length ? html`<ul class="list">${S.incomeSources.map(function (s) {
        return html`<li class="list__item"><div class="list__main"><div class="list__title">${s.description}</div><div class="list__meta">${incomeTypeLabel(s.type)} ${s.active ? '' : badge('Paused')}</div></div><div class="list__amount">${money(s.amountPence)}</div>
          ${iconBtn('edit', 'Edit suggestion ' + s.description, 'edit-source', { id: s.id })}${iconBtn(s.active ? 'minus' : 'restore', s.active ? 'Pause suggestion' : 'Resume suggestion', 'toggle-source', { id: s.id })}${iconBtn('trash', 'Delete suggestion ' + s.description, 'delete-source', { id: s.id })}</li>`;
      })}</ul>` : html`<p class="muted">None yet. When adding income, tick “Suggest this every month”.</p>`}</section>`);
    return out;
  };

  /* ---------- Expenses ---------- */
  PAGES.expenses = function (ctx) {
    const m = ctx.m;
    const obligations = E.monthObligations(S, ctx.sim, m, ctx.today).filter(function (o) { return o.kind === 'expense'; });
    const byId = {}; obligations.forEach(function (o) { byId[o.id] = o; });
    let list = E.expensesForMonth(S, m).slice().sort(function (a, b) { return (a.dueDay || 99) - (b.dueDay || 99) || a.description.localeCompare(b.description); });
    const total = E.sum(list, function (e) { return e.amountPence; });
    const paid = E.sum(list.filter(function (e) { return byId[e.id] && byId[e.id].paid; }), function (e) { return e.amountPence; });
    const f = ui.expFilter;
    if (f === 'unpaid') list = list.filter(function (e) { return !byId[e.id].paid; });
    if (f === 'recurring') list = list.filter(function (e) { return e.recurring; });
    if (f === 'oneoff') list = list.filter(function (e) { return !e.recurring; });
    const filters = [['all', 'All'], ['unpaid', 'Unpaid'], ['recurring', 'Recurring'], ['oneoff', 'One-off']];
    return [
      pageHead('Expenses', E.monthLabel(m) + ' · fixed and essential bills', btn('Add expense', 'add-expense', { icon: 'plus', cls: 'btn--primary' })),
      html`<section class="grid grid--metrics">
        ${metric({ label: 'Total this month', icon: 'receipt', value: money(total), sub: plural(E.expensesForMonth(S, m).length, 'bill') })}
        ${metric({ label: 'Paid', icon: 'check', tone: 'positive', value: money(paid) })}
        ${metric({ label: 'Still to pay', icon: 'clock', tone: total - paid > 0 ? 'debt' : 'positive', value: money(total - paid) })}
      </section>`,
      html`<section class="card card--flush">
        <div class="card__head" style="padding:16px 20px 0"><div class="segmented" role="radiogroup" aria-label="Filter expenses">${filters.map(function (x) { return html`<label><input type="radio" name="expfilter" value="${x[0]}" data-change="exp-filter" ${f === x[0] ? raw('checked') : ''}><span>${x[1]}</span></label>`; })}</div></div>
        ${list.length ? html`<div class="table-wrap" style="margin-top:12px"><table class="table table--stack"><thead><tr><th>Paid</th><th>Description</th><th>Category</th><th>Due</th><th class="num">Amount</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>
          ${list.map(function (e) {
            const o = byId[e.id];
            return html`<tr>
              <td data-label="Paid"><label class="check"><input type="checkbox" id="paid-${e.id}" data-change="toggle-paid-box" data-id="${e.id}" data-month="${m}" ${o.paid ? raw('checked') : ''}><span class="sr-only">Mark ${e.description} as paid</span><span aria-hidden="true">${o.paid ? 'Paid' : ''}</span></label></td>
              <td class="primary" data-label="Description">${e.description}<div class="list__meta">${e.recurring ? badge('Recurring', 'outline', 'refresh') : badge('One-off', 'outline')}${o.overdue ? badge('Overdue', 'danger', 'alert') : ''}</div></td>
              <td data-label="Category">${catLabel(e.category)}</td>
              <td data-label="Due">${o.dueDate ? E.formatDate(o.dueDate) : '—'}</td>
              <td class="num" data-label="Amount">${money(e.amountPence)}</td>
              <td class="actions">${iconBtn('edit', 'Edit ' + e.description, 'edit-expense', { id: e.id })}${iconBtn('trash', 'Delete ' + e.description, 'delete-expense', { id: e.id })}</td>
            </tr>`;
          })}</tbody></table></div>`
          : empty('receipt', f === 'all' ? 'No expenses for ' + E.monthLabel(m) : 'Nothing matches this filter', 'Add recurring bills once — they are carried into every future month automatically without duplicating.', f === 'all' ? btn('Add expense', 'add-expense', { icon: 'plus', cls: 'btn--primary' }) : '')}
      </section>`,
      html`<p class="subtle">Debt repayments are managed under Debts, not here, so they are never counted twice. Groceries, transport or healthcare entered here reduce the matching spending category minimum.</p>`
    ];
  };

  /* ---------- Spending ---------- */
  PAGES.spending = function (ctx) {
    const m = ctx.m, plan = ctx.plan, row = ctx.row;
    const rec = S.months[m];
    const out = [pageHead('Spending', E.monthLabel(m) + ' · your discretionary budget, category by category',
      html`${btn('Rebalance my budget', 'rebalance', { icon: 'refresh' })}${btn('Record spending', 'add-spend', { icon: 'plus', cls: 'btn--primary' })}`)];

    out.push(html`<section class="grid grid--metrics">
      ${metric({ label: 'Safe to spend', icon: 'wallet', tone: 'spend', value: money(plan.poolPence), sub: 'After bills, debts, savings and buffer' })}
      ${metric({ label: 'Spent', icon: 'receipt', value: money(plan.totalSpentPence), sub: plan.carryTotalPence ? money(plan.carryTotalPence) + ' carried forward' : 'This month' })}
      ${metric({ label: 'Remaining', icon: 'coins', tone: plan.remainingTotalPence < 0 ? 'danger' : 'positive', value: (plan.remainingTotalPence < 0 ? '−' : '') + money(Math.abs(plan.remainingTotalPence)), sub: plan.remainingTotalPence < 0 ? 'Overspent' : '' })}
      ${metric({ label: 'Per day · per week', icon: 'calendar', value: money(plan.perDayPence), sub: money(plan.perWeekPence) + ' a week · ' + plural(plan.daysLeft, 'day') + ' left' })}
    </section>`);

    if (row.status === 'shortfall') out.push(alertBox('danger', 'No discretionary money this month', 'Income does not cover essentials and minimum payments, so there is nothing safe to allocate. See the dashboard for the shortfall.'));
    if (plan.minShortfallPence > 0 && row.status !== 'shortfall') out.push(alertBox('warning', 'Your essential minimums are not fully covered', 'You set minimum amounts for essentials that exceed what is safe to spend by ' + money(plan.minShortfallPence) + '. Essentials were funded first.'));

    // Carry forward
    if (m <= ctx.current) {
      const decision = rec ? rec.carryDecision : null;
      if (!decision) {
        const cf = E.carryForwardCandidates(S, ctx.sim, m, ctx.today);
        if (cf.totalPence > 0) {
          out.push(alertBox('success', money(cf.totalPence) + ' unspent from ' + E.monthLabel(cf.month),
            'Unused money is only carried forward if you approve it. It is added to this month’s categories (' + E.SPEND_CATS.filter(function (c) { return cf.byCat[c.key]; }).map(function (c) { return c.label + ' ' + money(cf.byCat[c.key]); }).join(', ') + ').',
            html`${btn('Carry it forward', 'carry-approve', { cls: 'btn--primary btn--sm', icon: 'check' })}${btn('Not now', 'carry-decline', { cls: 'btn--ghost btn--sm' })}`));
        }
      } else if (decision === 'approved' && plan.carryTotalPence > 0) {
        out.push(alertBox('info', money(plan.carryTotalPence) + ' carried forward from ' + E.monthLabel(E.addMonths(m, -1)), null, btn('Undo', 'carry-undo', { cls: 'btn--ghost btn--sm' })));
      }
    }

    // Overspend suggestions
    const sug = E.suggestReallocation(plan);
    if (sug.moves.length || sug.uncoveredPence > 0) {
      out.push(alertBox('warning', 'Some categories are over budget',
        html`${sug.moves.length ? html`<div>Suggested moves between discretionary categories (debts, bills, savings and your buffer are never touched):</div><ul>${sug.moves.map(function (mv) { return html`<li>Move ${money(mv.amountPence)} from ${spendLabel(mv.from)} to ${spendLabel(mv.to)}</li>`; })}</ul>` : ''}
        ${sug.uncoveredPence > 0 ? html`<div>${money(sug.uncoveredPence)} of overspending cannot be covered by other categories.</div>` : ''}`,
        sug.moves.length ? btn('Apply suggestion', 'apply-realloc', { cls: 'btn--primary btn--sm' }) : ''));
    }

    const unalloc = plan.unallocatedPence;
    out.push(html`<section class="card card--flush">
      <div class="card__head" style="padding:20px 20px 0">
        <div><h2>Category budgets</h2><p class="subtle">${plan.basis === 'history' ? 'Suggestions use your average spending in ' + plan.historyMonths.map(function (k) { return E.monthLabel(k, true); }).join(', ') + '.' : 'Suggestions use your percentage split (not enough spending history yet).'} Essentials are allocated first.</p></div>
        <div class="row">${badge(unalloc < 0 ? 'Over-allocated by ' + money(-unalloc) : 'Unallocated ' + money(unalloc), unalloc < 0 ? 'danger' : unalloc > 0 ? 'outline' : 'positive', unalloc < 0 ? 'alert' : 'check')}<span class="sr-only" aria-live="polite" id="unalloc-live"></span>
        ${plan.hasOverrides ? btn('Reset to recommended', 'reset-cats', { cls: 'btn--ghost btn--sm', icon: 'restore' }) : ''}</div>
      </div>
      <div style="margin-top:8px">${plan.cats.map(function (c) { return allocRow(c, plan); })}</div>
    </section>`);

    // Entries
    const entries = rec ? rec.discretionarySpend.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }) : [];
    out.push(html`<section class="card card--flush">
      <div class="card__head" style="padding:20px 20px 0"><div><h2>Spending this month</h2><p class="subtle">${plural(entries.length, 'entry', 'entries')} · ${money(plan.totalSpentPence)}</p></div></div>
      ${entries.length ? html`<div class="table-wrap"><table class="table table--stack"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${entries.map(function (s) { return html`<tr><td data-label="Date">${E.formatDate(s.date)}</td><td class="primary" data-label="Description">${s.description || '—'}</td><td data-label="Category">${spendLabel(s.category)}</td><td class="num" data-label="Amount">${money(s.amountPence)}</td><td class="actions">${iconBtn('edit', 'Edit entry', 'edit-spend', { id: s.id, month: m })}${iconBtn('trash', 'Delete entry', 'delete-spend', { id: s.id, month: m })}</td></tr>`; })}
      </tbody></table></div>` : empty('wallet', 'Nothing recorded yet', 'Record purchases as you go to see what is left in each category, per week and per day.', btn('Record spending', 'add-spend', { icon: 'plus', cls: 'btn--primary' }))}
    </section>`);

    out.push(spendingRules());
    return out;
  };

  function allocRow(c, plan) {
    const max = Math.max(plan.poolPence, c.budgetPence, 100);
    const maxR = Math.ceil(max / 1000) * 1000;
    const fill = (c.budgetPence / maxR * 100).toFixed(1);
    return html`<div class="alloc">
      <div class="alloc__head">
        <span class="alloc__name">${c.label}</span>${c.essential ? badge('Essential', 'outline') : ''}${c.overridePence != null ? badge('Your budget', 'spend', 'edit') : badge('Suggested', 'outline')}
        <span class="spacer"></span>
        ${c.over ? badge('Over by ' + money(-c.remainingPence), 'danger', 'alert') : badge(money(c.remainingPence) + ' left', 'positive')}
      </div>
      <div class="alloc__controls">
        <input type="range" class="slider" id="slider-${c.key}" min="0" max="${maxR}" step="100" value="${c.budgetPence}" style="--fill:${fill}%" data-input="slider" data-change="cat-budget" data-cat="${c.key}" aria-label="${c.label} budget" aria-valuetext="${money(c.budgetPence)}">
        <div class="money-input money-input--sm"><input class="input" id="cat-${c.key}" inputmode="decimal" value="${attr(c.budgetPence)}" data-change="cat-budget" data-cat="${c.key}" aria-label="${c.label} budget in pounds"></div>
      </div>
      ${progress(c.pctUsed, c.over ? 'over' : 'spend', c.label + ' used: ' + Math.round(c.pctUsed * 100) + '%')}
      <dl class="alloc__stats">
        <div><dt>Suggested</dt><dd>${money(c.suggestedPence)}</dd></div>
        <div><dt>${c.carryPence ? 'Budget + carried' : 'Your budget'}</dt><dd>${money(c.budgetPence)}${c.carryPence ? html` + ${money(c.carryPence)}` : ''}</dd></div>
        <div><dt>Spent · used</dt><dd>${money(c.spentPence)} · ${Math.round(c.pctUsed * 100)}%</dd></div>
        <div><dt>Remaining${plan.daysLeft ? ' · per day' : ''}</dt><dd class="${c.over ? 't-danger' : ''}">${money(c.remainingPence)}${plan.daysLeft ? ' · ' + money(c.perDayPence) : ''}</dd></div>
      </dl>
      ${c.coveredPence ? html`<div class="subtle">${money(c.coveredPence)} is already budgeted as a fixed expense and is not counted again.</div>` : ''}
      ${c.overridePence != null ? html`<div>${btn('Reset to suggested ' + money(c.suggestedPence), 'reset-cat', { data: { cat: c.key }, cls: 'btn--ghost btn--sm', icon: 'restore' })}</div>` : ''}
    </div>`;
  }

  function spendingRules() {
    const sp = S.settings.spending;
    const pctTotal = E.sum(E.SPEND_KEYS, function (k) { return sp.pcts[k]; });
    return html`<section class="card"><details class="disclosure"><summary>${icon('chevronR')}Allocation rules — minimums and percentage split</summary>
      <form class="form disclosure__body" data-form="spend-rules">
        <p class="muted small">Minimums protect essentials: extra debt payments and savings are never recommended from this money. Percentages are only used until you have at least two months of spending history.</p>
        <div class="table-wrap"><table class="table table--compact"><thead><tr><th>Category</th><th>Minimum per month</th><th>Split %</th></tr></thead><tbody>
          ${E.SPEND_CATS.map(function (c) { return html`<tr><td>${c.label}${c.essential ? html` <span class="subtle">(essential)</span>` : ''}</td>
            <td><div class="money-input money-input--sm" style="max-width:150px"><input class="input" name="min-${c.key}" inputmode="decimal" value="${attr(sp.mins[c.key])}" aria-label="${c.label} minimum"></div></td>
            <td><input class="input input--sm" style="max-width:90px" name="pct-${c.key}" type="number" min="0" max="100" step="1" value="${sp.pcts[c.key]}" aria-label="${c.label} percentage"></td></tr>`; })}
        </tbody><tfoot><tr><td>Total</td><td></td><td>${pctTotal}%</td></tr></tfoot></table></div>
        <div class="form-actions">${btn('Restore defaults', 'reset-spend-rules', { cls: 'btn--ghost' })}${btn('Save rules', null, { type: 'submit', cls: 'btn--primary' })}</div>
      </form></details></section>`;
  }

  /* ---------- Debts ---------- */
  PAGES.debts = function (ctx) {
    const sim = ctx.sim, m = ctx.m;
    const all = E.debtSummaries(S, sim, m);
    const active = all.filter(function (d) { return !d.debt.archived; });
    const archived = all.filter(function (d) { return d.debt.archived; });
    const totalBal = E.sum(active, function (d) { return d.openingPence || 0; });
    const totalMin = E.sum(active.filter(function (d) { return d.openingPence > 0; }), function (d) { return d.row ? d.row.minPence : d.debt.minPaymentPence; });
    const out = [pageHead('Debts', 'Balances shown at the start of ' + E.monthLabel(m) + ' (estimated, including interest)',
      html`${active.length ? btn('Record payment', 'add-payment', { icon: 'check' }) : ''}${btn('Add debt', 'add-debt', { icon: 'plus', cls: 'btn--primary' })}`)];
    if (!S.debts.length) {
      out.push(html`<section class="card">${empty('card', 'No debts registered', 'Add each credit card, loan, overdraft or buy-now-pay-later plan individually to get a repayment plan and debt-free date.', btn('Add your first debt', 'add-debt', { icon: 'plus', cls: 'btn--primary' }))}</section>`);
      return out;
    }
    const months = sim.debtFreeMonth ? E.monthsBetween(ctx.current, sim.debtFreeMonth) + 1 : null;
    out.push(html`<section class="grid grid--metrics">
      ${metric({ label: 'Total outstanding', icon: 'card', tone: 'debt', value: money(totalBal), sub: plural(active.filter(function (d) { return d.openingPence > 0; }).length, 'active debt') })}
      ${metric({ label: 'Minimum payments', icon: 'calendar', value: money(totalMin), sub: 'Per month, contractual' })}
      ${metric({ label: 'Repayment duration', icon: 'clock', value: months ? (months <= 0 ? 'Repaid' : plural(months, 'month')) : '—', sub: months ? 'Estimate, from this month' : 'Not within ' + sim.horizonMonths + ' months' })}
      ${metric({ label: 'Debt-free date', icon: 'flag', tone: 'positive', value: sim.debtFreeMonth ? E.monthLabel(sim.debtFreeMonth) : 'Not within plan', sub: E.STRATEGIES[sim.strategy].label })}
      ${metric({ label: 'Future interest', icon: 'coins', tone: 'debt', value: money(sim.totalInterestFromCurrentPence), sub: 'Estimated, from this month' })}
    </section>`);
    if (sim.nonAmortising.length) out.push(alertBox('warning', 'Minimum payment does not cover interest', html`${sim.nonAmortising.map(function (n) { return html`<div>${n.name}: ${money(n.minPence)} minimum vs ${money(n.interestPence)} estimated monthly interest. This debt will not reduce without extra payments.</div>`; })}`));
    out.push(html`<section class="grid grid--cards">${active.map(function (d) { return debtCard(d, ctx); })}</section>`);
    if (archived.length) {
      out.push(html`<section class="card"><details class="disclosure"><summary>${icon('chevronR')}Archived debts (${archived.length})</summary><div class="disclosure__body">
        <ul class="list">${archived.map(function (d) { return html`<li class="list__item"><div class="list__main"><div class="list__title">${d.name}</div><div class="list__meta">Paid in total ${money(d.totalPaidPence)} · excluded from all calculations</div></div>
          ${btn('Restore', 'archive-debt', { data: { id: d.debt.id }, cls: 'btn--ghost btn--sm', icon: 'restore' })}${iconBtn('clock', 'Payment history', 'debt-history', { id: d.debt.id })}${iconBtn('trash', 'Delete ' + d.name, 'delete-debt', { id: d.debt.id })}</li>`; })}</ul></div></details></section>`);
    }
    out.push(html`<p class="subtle">Interest estimate: balance × APR ÷ 12 each month, rounded to the penny. Your lender may calculate daily interest, add fees or apply payments differently, so check statements and update balances from time to time (edit the debt and set the current balance and “balance as at” month).</p>`);
    return out;
  };

  function debtCard(s, ctx) {
    const d = s.debt, r = s.row;
    const paid = r ? r.actualPence : 0, planned = r ? r.plannedPence : 0;
    const apr = d.aprBps ? E.formatBps(d.aprBps) + ' APR' : '0% interest';
    return html`<article class="debt-card" aria-label="${s.name}">
      <div class="debt-card__head">
        <div><div class="debt-card__name">${d.creditor}</div>${d.description ? html`<div class="muted small">${d.description}</div>` : ''}</div>
        <div class="row" style="gap:6px;justify-content:flex-end">${badge(apr, d.aprBps ? 'debt' : 'outline')}${r && r.interestFree ? badge('Interest-free until ' + E.monthLabel(d.interestFreeUntil, true), 'positive') : ''}${d.priority ? badge('Priority ' + d.priority, 'outline') : ''}</div>
      </div>
      <div>
        <div class="subtle">Outstanding at start of ${E.monthLabel(ctx.m, true)}</div>
        <div class="debt-card__balance">${s.openingPence === 0 ? html`<span class="t-positive">${icon('ok', 'inline')} Repaid</span>` : money(s.openingPence)}</div>
      </div>
      <div class="stack" style="gap:6px">
        ${progress(s.progress, 'positive', Math.round(s.progress * 100) + '% repaid', 'progress--lg')}
        <div class="row row--between subtle"><span>${Math.round(s.progress * 100)}% repaid since ${E.monthLabel(d.startMonth, true)}</span><span>Started at ${money(d.balancePence)}</span></div>
      </div>
      <dl class="debt-card__facts">
        <div><dt>Minimum payment</dt><dd>${money(d.minPaymentPence)}${d.dueDay ? html` <span class="subtle">· ${E.ordinal(d.dueDay)}</span>` : ''}</dd></div>
        <div><dt>This month</dt><dd>${money(paid)} paid${planned > paid ? html` <span class="subtle">of ${money(planned)} planned</span>` : ''}</dd></div>
        <div><dt>Estimated payoff</dt><dd>${s.payoffMonth ? E.monthLabel(s.payoffMonth) : 'Not within plan'}</dd></div>
        <div><dt>Future interest (est.)</dt><dd>${money(s.futureInterestPence)}</dd></div>
      </dl>
      ${s.nonAmortising ? alertBox('warning', null, 'The minimum payment does not cover the monthly interest.') : ''}
      ${s.pastContractEnd ? alertBox('warning', null, 'Projected payoff is later than the contractual end date (' + E.formatDate(d.contractEndDate) + ').') : ''}
      ${r && r.missedMin && ctx.m < ctx.current ? alertBox('danger', null, 'Minimum payment was not met this month.') : ''}
      ${d.notes ? html`<p class="small muted">${d.notes}</p>` : ''}
      <div class="debt-card__actions">
        ${btn('Record payment', 'add-payment', { data: { id: d.id }, cls: 'btn--primary btn--sm', icon: 'check' })}
        ${btn('History', 'debt-history', { data: { id: d.id }, cls: 'btn--ghost btn--sm', icon: 'clock' })}
        <span class="debt-card__tools">${iconBtn('edit', 'Edit ' + s.name, 'edit-debt', { id: d.id })}${iconBtn('archive', 'Archive ' + s.name, 'archive-debt', { id: d.id })}${iconBtn('trash', 'Delete ' + s.name, 'delete-debt', { id: d.id })}</span>
      </div>
    </article>`;
  }

  /* ---------- Repayment plan ---------- */
  PAGES.plan = function (ctx) {
    const sim = ctx.sim, row = ctx.row, m = ctx.m;
    const out = [pageHead('Repayment Plan', 'A rule-based plan using only money you can genuinely afford. All figures are estimates.')];
    const st = S.settings.strategy;
    out.push(html`<section class="card"><div class="card__head"><div><h2>Repayment strategy</h2><p class="subtle">Every strategy keeps all contractual minimums paid.</p></div></div>
      <div class="choices" role="radiogroup" aria-label="Repayment strategy">${Object.keys(E.STRATEGIES).filter(function (k) { return k !== 'priority' || S.debts.some(function (d) { return d.priority; }) || st === 'priority'; }).map(function (k) {
        const s = E.STRATEGIES[k];
        return html`<label class="choice"><input type="radio" name="strategy" value="${k}" data-change="strategy" ${st === k ? raw('checked') : ''}><span class="choice__box"><span class="choice__title">${s.label}<span class="choice__check">${st === k ? icon('check') : ''}</span></span><span class="small muted">${s.description}</span></span></label>`;
      })}</div>
      ${!S.debts.some(function (d) { return d.priority; }) ? html`<p class="subtle" style="margin-top:12px">Tip: give debts a priority number to unlock a custom order.</p>` : ''}
    </section>`);

    if (!sim.hasDebts) out.push(alertBox('info', 'No active debts', 'Add debts to see repayment suggestions. Savings recommendations still work.', btn('Add a debt', 'add-debt', { cls: 'btn--sm', icon: 'plus' })));

    // This month's allocation
    if (m >= ctx.current) {
      const rec = row.recommended;
      const mrec = S.months[m];
      const mo = mrec ? mrec.overrides : { extraDebtPence: null, savingsPence: null };
      const def = S.settings.defaultOverrides;
      out.push(html`<section class="card"><div class="card__head"><div><h2>Allocation for ${E.monthLabel(m)}</h2><p class="subtle">Edit any figure — the plan, dashboard and spreadsheet update immediately.</p></div>${statusBadge(row.status)}</div>
        <div class="grid grid--2">
          <div>
            <h3 style="margin-bottom:10px">Available surplus</h3>
            <dl class="calc">
              <dt>${row.incomeBasis === 'confirmed' ? 'Confirmed income' : 'Income (' + E.INCOME_BASIS_LABEL[row.incomeBasis].toLowerCase() + ')'}</dt><dd>${money(row.incomePence)}</dd>
              <dt>− Essential expenses</dt><dd>${money(row.essentialPence)}</dd>
              <dt>− Minimum debt payments</dt><dd>${money(row.minDebtPence)}</dd>
              <dt>− Financial buffer</dt><dd>${money(row.bufferPence)}</dd>
              <dt>− Protected living reserve</dt><dd>${money(row.reservePence)}</dd>
              <dt class="total">= Surplus to allocate</dt><dd class="total">${money(rec.surplusPence)}</dd>
            </dl>
            <h3 style="margin:18px 0 10px">Recommended split <span class="subtle">(${E.SAVINGS_APPROACHES[S.settings.savingsApproach].label})</span></h3>
            <dl class="calc">
              <dt>Extra debt payments</dt><dd class="t-debt">${money(rec.extraDebtPence)}</dd>
              <dt>Savings</dt><dd class="t-savings">${money(rec.savingsPence)}</dd>
              <dt>Added to spending</dt><dd class="t-spend">${money(rec.headroomPence)}</dd>
            </dl>
          </div>
          <form class="form" data-form="overrides" data-month="${m}">
            <h3>Your amounts</h3>
            ${moneyField({ name: 'extra', label: 'Extra debt payment', value: mo.extraDebtPence != null ? attr(mo.extraDebtPence) : '', placeholder: attr(rec.extraDebtPence) + ' (recommended)', hint: mo.extraDebtPence == null && def.extraDebtPence != null ? 'Using your default of ' + money(def.extraDebtPence) + '. Leave blank to keep it.' : 'Leave blank to use the recommendation. Split across debts by your strategy.' })}
            ${moneyField({ name: 'savings', label: 'Savings contribution', value: mo.savingsPence != null ? attr(mo.savingsPence) : '', placeholder: attr(rec.savingsPence) + ' (recommended)', hint: mo.savingsPence == null && def.savingsPence != null ? 'Using your default of ' + money(def.savingsPence) + '.' : 'Leave blank to use the recommendation.' })}
            <label class="check"><input type="checkbox" name="asDefault"> Also use these amounts for every future month</label>
            ${row.extraCapped ? alertBox('info', null, 'The extra payment is more than is owed, so only ' + money(row.extraAppliedPence) + ' can be applied. Your figure is kept as entered.') : ''}
            ${row.status === 'over' ? alertBox('danger', 'This allocation exceeds available funds', 'Short by ' + money(row.shortfallPence) + '. Reduce the extra payment or savings.') : ''}
            <div class="form-actions">
              ${(mo.extraDebtPence != null || mo.savingsPence != null) ? btn('Reset to recommended', 'reset-overrides', { data: { month: m }, cls: 'btn--ghost', icon: 'restore' }) : ''}
              ${(def.extraDebtPence != null || def.savingsPence != null) ? btn('Clear future defaults', 'clear-defaults', { cls: 'btn--ghost' }) : ''}
              ${btn('Apply', null, { type: 'submit', cls: 'btn--primary' })}
            </div>
          </form>
        </div></section>`);
    } else {
      out.push(alertBox('info', 'Past month', 'Past months show only what was actually paid. Choose this month or a future month to plan.'));
    }

    if (row.debts.length) {
      out.push(html`<section class="card card--flush"><div class="card__head" style="padding:20px 20px 0"><div><h2>Debt by debt — ${E.monthLabel(m)}</h2><p class="subtle">${m < ctx.current ? 'Recorded payments' : 'Planned payments (recorded payments are used where higher)'}</p></div></div>
        <div class="table-wrap"><table class="table table--stack"><thead><tr><th>Debt</th><th class="num">Opening</th><th class="num">Interest (est.)</th><th class="num">Minimum</th><th class="num">Extra</th><th class="num">Paid / planned</th><th class="num">Closing</th></tr></thead><tbody>
        ${row.debts.map(function (d) { return html`<tr><td class="primary" data-label="Debt">${d.name}${d.interestFree ? html` ${badge('0% period', 'positive')}` : ''}</td><td class="num" data-label="Opening">${money(d.openingPence)}</td><td class="num" data-label="Interest">${money(d.interestPence)}</td><td class="num" data-label="Minimum">${money(d.minPence)}</td><td class="num" data-label="Extra">${money(d.extraPence)}</td><td class="num" data-label="Paid / planned">${money(d.paidPence)}${d.actualPence ? html`<div class="subtle">${money(d.actualPence)} recorded</div>` : ''}</td><td class="num" data-label="Closing">${money(d.closingPence)}</td></tr>`; })}
        </tbody><tfoot><tr><td>Total</td><td class="num">${money(row.openingDebtPence)}</td><td class="num">${money(row.interestPence)}</td><td class="num">${money(row.minDebtPence)}</td><td class="num">${money(row.extraPaidPence)}</td><td class="num">${money(row.debtPaidPence)}</td><td class="num">${money(row.closingDebtPence)}</td></tr></tfoot></table></div></section>`);
    }

    if (sim.hasDebts) {
      const cmp = E.compareStrategies(S, { today: ctx.today });
      const best = cmp.filter(function (c) { return c.debtFreeMonth; }).sort(function (a, b) { return a.totalInterestPence - b.totalInterestPence; })[0];
      out.push(html`<section class="card card--flush"><div class="card__head" style="padding:20px 20px 0"><div><h2>Strategy comparison</h2><p class="subtle">Uses recommended amounts from ${E.monthLabel(ctx.current)}. Estimates, not guaranteed outcomes.</p></div></div>
        <div class="table-wrap"><table class="table table--stack"><thead><tr><th>Strategy</th><th>Debt-free</th><th class="num">Total interest (est.)</th><th class="num">Debt payments this month</th><th class="num">Safe to spend this month</th></tr></thead><tbody>
        ${cmp.map(function (c) { return html`<tr><td class="primary" data-label="Strategy">${c.label} ${c.strategy === st ? badge('Selected', 'positive', 'check') : ''} ${best && best.strategy === c.strategy ? badge('Lowest interest', 'outline') : ''}</td>
          <td data-label="Debt-free">${c.debtFreeMonth ? E.monthLabel(c.debtFreeMonth) + ' (' + plural(c.monthsToDebtFree, 'month') + ')' : 'Not within ' + sim.horizonMonths + ' months'}</td>
          <td class="num" data-label="Total interest">${money(c.totalInterestPence)}${c.horizonReached ? '+' : ''}</td><td class="num" data-label="Debt payments">${money(c.monthlyDebtPaymentPence)}</td><td class="num" data-label="Safe to spend">${money(c.safeToSpendPence)}</td></tr>`; })}
        </tbody></table></div></section>`);
      if (sim.horizonReached) out.push(alertBox('warning', 'Repayment is not possible within ' + sim.horizonMonths + ' months under current assumptions', 'Increase income, reduce expenses, raise payments, or extend the planning horizon in the spreadsheet or settings. The projection stops at the horizon instead of running forever.'));
    }
    out.push(html`<p class="subtle">The engine is deterministic and rule-based: it never recommends more than your surplus after essentials, contractual minimums, your buffer and the living reserve. Freed-up minimums from repaid debts become surplus in later months.</p>`);
    return out;
  };

  /* ---------- Savings ---------- */
  PAGES.savings = function (ctx) {
    const sv = S.savings, row = ctx.row, m = ctx.m, sim = ctx.sim;
    const mrec = S.months[m];
    const deposits = mrec ? mrec.savingsDeposits.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }) : [];
    const goal = sv.emergencyGoalPence;
    const bal = row.savingsBalancePence || 0;
    const reachRow = goal ? sim.rows.find(function (r) { return r.month >= ctx.current && (r.savingsBalancePence || 0) >= goal; }) : null;
    const out = [pageHead('Savings', 'Planned contributions are tracked separately from confirmed deposits', btn('Record deposit', 'add-deposit', { icon: 'plus', cls: 'btn--primary' }))];
    out.push(html`<section class="grid grid--metrics">
      ${metric({ label: 'Savings balance', icon: 'coins', tone: 'savings', value: money(bal), sub: 'End of ' + E.monthLabel(m, true) + (m >= ctx.current ? ', projected' : '') })}
      ${metric({ label: m < ctx.current ? 'Saved' : 'Planned this month', icon: 'piggy', tone: 'savings', value: money(row.savingsPence), sub: row.overrides.savingsPence != null ? 'Your amount' : m < ctx.current ? 'Actual deposits' : 'Recommended' })}
      ${metric({ label: 'Confirmed deposits', icon: 'check', tone: 'positive', value: money(row.savingsDepositedPence), sub: row.savingsWithdrawnPence ? money(-row.savingsWithdrawnPence) + ' withdrawn' : 'This month' })}
      ${metric({ label: 'Emergency fund', icon: 'shield', value: goal ? Math.min(100, Math.round(bal / goal * 100)) + '%' : 'No goal set', sub: goal ? (reachRow ? 'Goal of ' + money(goal) + ' by ' + E.monthLabel(reachRow.month) : 'Goal of ' + money(goal) + ' not reached in plan') : 'Set a goal below' })}
    </section>`);
    if (goal) out.push(html`<section class="card">${progress(bal / goal, 'savings', 'Emergency fund ' + Math.round(bal / goal * 100) + '% funded', 'progress--lg')}<div class="row row--between subtle" style="margin-top:8px"><span>${money(bal)}</span><span>Goal ${money(goal)}</span></div></section>`);
    if (row.recommended.surplusPence === 0 && m >= ctx.current) out.push(alertBox('info', 'No savings suggested this month', 'After essentials, minimum debt payments, your buffer and living reserve, there is no surplus — so £0 is suggested rather than an unaffordable amount.'));

    out.push(html`<section class="card"><div class="card__head"><div><h2>Savings approach</h2><p class="subtle">How surplus money is shared between savings and extra debt payments.</p></div></div>
      <div class="choices" role="radiogroup" aria-label="Savings approach">${Object.keys(E.SAVINGS_APPROACHES).map(function (k) {
        const a = E.SAVINGS_APPROACHES[k], on = S.settings.savingsApproach === k;
        return html`<label class="choice"><input type="radio" name="approach" value="${k}" data-change="approach" ${on ? raw('checked') : ''}><span class="choice__box"><span class="choice__title">${a.label}<span class="choice__check">${on ? icon('check') : ''}</span></span><span class="small muted">${a.description}</span></span></label>`;
      })}</div></section>`);

    out.push(html`<div class="grid grid--2">
      <section class="card"><form class="form" data-form="savings-settings">
        <h2>Savings settings</h2>
        <div class="form-grid">
          ${moneyField({ name: 'target', label: 'Monthly savings target', value: attr(sv.targetMonthlyPence), hint: 'Caps the recommendation. £0 = use the approach share.' })}
          ${moneyField({ name: 'goal', label: 'Emergency fund goal', value: attr(sv.emergencyGoalPence) })}
          ${moneyField({ name: 'balance', label: 'Current savings balance', value: attr(sv.openingBalancePence) })}
          ${textField({ name: 'baseline', label: 'Balance as at start of', type: 'month', value: sv.baselineMonth || ctx.current, attrs: 'pattern="\\d{4}-\\d{2}" placeholder="YYYY-MM"', hint: 'Deposits from this month onwards are added.' })}
          ${selectField({ name: 'priority', label: 'Preferred priority', value: sv.priority, options: [{ value: 'emergency', label: 'Emergency fund first, then debts' }, { value: 'steady', label: 'Steady saving every month' }], hint: 'Emergency first: once the goal is reached, more surplus goes to debt.' })}
          ${moneyField({ name: 'buffer', label: 'Minimum cash buffer', value: attr(S.settings.bufferPence), hint: 'Kept aside every month; never counted as safe to spend.' })}
        </div>
        <div class="form-actions">${btn('Save settings', null, { type: 'submit', cls: 'btn--primary' })}</div>
      </form></section>
      <section class="card"><form class="form" data-form="savings-override" data-month="${m}">
        <h2>${E.monthLabel(m)} contribution</h2>
        ${m < ctx.current ? html`<p class="muted">Past months use confirmed deposits only.</p>` : html`
          <dl class="calc"><dt>Recommended</dt><dd>${money(row.recommended.savingsPence)}</dd><dt>Planned</dt><dd>${money(row.savingsPlannedPence)}</dd><dt>Confirmed so far</dt><dd>${money(row.savingsDepositedPence)}</dd></dl>
          ${moneyField({ name: 'savings', label: 'Your contribution', value: mrec && mrec.overrides.savingsPence != null ? attr(mrec.overrides.savingsPence) : '', placeholder: attr(row.recommended.savingsPence) + ' (recommended)', hint: 'Leave blank to follow the recommendation.' })}
          ${row.status === 'over' ? alertBox('danger', null, 'This exceeds the money available by ' + money(row.shortfallPence) + '.') : ''}
          <div class="form-actions">${mrec && mrec.overrides.savingsPence != null ? btn('Reset to recommended', 'reset-savings-override', { data: { month: m }, cls: 'btn--ghost', icon: 'restore' }) : ''}${btn('Apply', null, { type: 'submit', cls: 'btn--primary' })}</div>`}
      </form>
      <h3 style="margin:20px 0 6px">Deposits & withdrawals</h3>
      ${deposits.length ? html`<ul class="list">${deposits.map(function (d) { return html`<li class="list__item"><div class="list__main"><div class="list__title">${d.note || (d.amountPence > 0 ? 'Deposit' : 'Withdrawal')}</div><div class="list__meta">${E.formatDate(d.date)}</div></div><div class="list__amount ${d.amountPence < 0 ? 't-danger' : 't-positive'}">${money(d.amountPence, { sign: true })}</div>${iconBtn('trash', 'Delete', 'delete-deposit', { id: d.id, month: m })}</li>`; })}</ul>` : html`<p class="muted small">No deposits recorded for this month.</p>`}
      </section></div>`);

    const proj = sim.rows.filter(function (r) { return r.month >= ctx.current; }).slice(0, 12);
    out.push(html`<section class="card"><div class="card__head"><div><h2>Projected savings</h2><p class="subtle">Next 12 months · estimates</p></div></div>
      ${projectionChart(sim, { debt: false })}
      <div class="table-wrap" style="margin-top:12px"><table class="table table--compact"><thead><tr><th>Month</th><th class="num">Contribution</th><th class="num">Balance</th></tr></thead><tbody>
      ${proj.map(function (r) { return html`<tr><td>${E.monthLabel(r.month)} ${r.month === ctx.current ? badge('Now', 'positive') : ''}</td><td class="num">${money(r.savingsPence)} <span class="subtle">${r.savingsDepositedPence >= r.savingsPence && r.savingsPence ? 'confirmed' : 'planned'}</span></td><td class="num">${money(r.savingsBalancePence || 0)}</td></tr>`; })}
      </tbody></table></div></section>`);
    return out;
  };

  /* ---------- Monthly spreadsheet ---------- */
  PAGES.sheet = function (ctx) {
    const sim = ctx.sim, st = S.settings;
    const showCats = st.showSpendColumns;
    const out = [pageHead('Monthly Spreadsheet', 'Month by month until every debt is repaid. Select a month to see each debt and edit future assumptions.',
      btn('Export CSV', 'export-csv', { icon: 'download', cls: 'btn--primary' }))];
    out.push(html`<section class="card"><div class="row" style="gap:20px">
      <label class="check"><input type="checkbox" data-change="assume-income" ${st.assumeIncomeRepeats ? raw('checked') : ''}> Assume latest confirmed income repeats in future months</label>
      <label class="check"><input type="checkbox" data-change="show-cats" ${showCats ? raw('checked') : ''}> Show spending category columns</label>
      <div class="row" style="gap:8px"><label for="horizon" class="small t-strong">Planning horizon</label><input class="input input--sm" style="width:90px" id="horizon" type="number" min="12" max="600" step="12" value="${st.planningHorizonMonths}" data-change="horizon"><span class="subtle">months</span></div>
    </div>
    <div class="row subtle" style="margin-top:12px">${phaseBadge('actual')} recorded results ${phaseBadge('current')} ${phaseBadge('forecast')} <span><em>≈ italic</em> = assumed income, never counted as received</span></div></section>`);
    if (sim.horizonReached) out.push(alertBox('warning', 'Debts are not repaid within the ' + sim.horizonMonths + '-month horizon', html`${sim.nonAmortising.length ? html`<div>${sim.nonAmortising.map(function (n) { return n.name; }).join(', ')}: the minimum payment does not cover interest.</div>` : ''}<div>Under current assumptions repayment is not possible within the horizon. Adjust payments, income or expenses, or extend the horizon above.</div>`));

    const cols = 11 + (showCats ? E.SPEND_CATS.length : 0);
    const rowsHtml = sim.rows.map(function (r) {
      const open = ui.expanded.has(r.month);
      const assumed = r.incomeBasis !== 'confirmed';
      const plan = showCats || open ? E.spendingPlan(S, r.month, r, { today: ctx.today }) : null;
      const cls = 'is-' + r.phase;
      const main = html`<tr class="${cls}">
        <td><button type="button" class="row-toggle" data-action="toggle-row" data-month="${r.month}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="detail-${r.month}">${icon('chevronR')}${E.monthLabel(r.month, true)}</button><div>${r.phase === 'current' ? badge('Now', 'positive') : r.phase === 'actual' ? badge('Actual', 'savings') : ''}</div></td>
        <td class="num ${assumed ? 'assumed' : ''}" title="${E.INCOME_BASIS_LABEL[r.incomeBasis]}">${assumed && r.incomePence ? '≈ ' : ''}${money(r.incomePence)}</td>
        <td class="num">${money(r.essentialPence)}</td>
        <td class="num">${money(r.minDebtPence)}</td>
        <td class="num">${money(r.extraPaidPence)}</td>
        <td class="num">${money(r.debtPaidPence)}</td>
        <td class="num">${money(r.savingsPence)}</td>
        <td class="num">${money(r.safeToSpendPence)}${r.shortfallPence ? html`<div class="t-danger small">−${money(r.shortfallPence)}</div>` : ''}</td>
        <td class="num">${money(r.closingDebtPence)}</td>
        <td class="num">${money(r.savingsBalancePence || 0)}</td>
        <td>${statusBadge(r.status)}</td>
        ${showCats ? plan.cats.map(function (c) { return html`<td class="num">${money(c.budgetPence)}</td>`; }) : ''}
      </tr>`;
      return open ? html`${main}<tr class="detail-row" id="detail-${r.month}"><td colspan="${cols}">${sheetDetail(r, plan, ctx)}</td></tr>` : main;
    });
    out.push(html`<section class="card card--flush"><div class="table-wrap sheet-wrap"><table class="table table--sheet table--compact">
      <caption class="sr-only">Monthly financial projection. Amounts in pounds sterling.</caption>
      <thead><tr><th scope="col">Month</th><th class="num" scope="col">Income</th><th class="num" scope="col">Essentials</th><th class="num" scope="col">Min. debt</th><th class="num" scope="col">Extra debt</th><th class="num" scope="col">Total debt</th><th class="num" scope="col">Savings</th><th class="num" scope="col">Safe to spend</th><th class="num" scope="col">Debt balance</th><th class="num" scope="col">Savings balance</th><th scope="col">Status</th>
      ${showCats ? E.SPEND_CATS.map(function (c) { return html`<th class="num" scope="col">${c.label}</th>`; }) : ''}</tr></thead>
      <tbody>${rowsHtml}</tbody></table></div></section>`);
    out.push(html`<p class="subtle">${plural(sim.rows.length, 'month')} shown · estimated total future interest ${money(sim.totalInterestFromCurrentPence)} · CSV opens in Microsoft Excel and Google Sheets.</p>`);
    return out;
  };

  function sheetDetail(r, plan, ctx) {
    const mrec = S.months[r.month];
    const parts = [];
    if (r.debts.length) {
      parts.push(html`<div><h3 style="margin-bottom:8px">Debts</h3><div class="table-wrap"><table class="table table--compact"><thead><tr><th>Debt</th><th class="num">Opening</th><th class="num">Interest</th><th class="num">Payment</th><th class="num">Closing</th></tr></thead><tbody>
        ${r.debts.map(function (d) { return html`<tr><td>${d.name}</td><td class="num">${money(d.openingPence)}</td><td class="num">${money(d.interestPence)}</td><td class="num">${money(d.paidPence)}${d.actualPence ? html` <span class="subtle">(${money(d.actualPence)} recorded)</span>` : ''}</td><td class="num">${money(d.closingPence)}</td></tr>`; })}
      </tbody></table></div></div>`);
    } else parts.push(html`<p class="muted">No debt payments this month.</p>`);
    parts.push(html`<div><h3 style="margin-bottom:8px">Spending allocation</h3><div class="legend" style="margin-top:0">${plan.cats.map(function (c) { return html`<div class="legend__item"><span class="dot seg-spend"></span>${c.label}<span class="money">${money(c.budgetPence)}</span></div>`; })}</div></div>`);
    if (r.phase === 'actual' && mrec && mrec.forecast) {
      const f = mrec.forecast;
      parts.push(html`<div><h3 style="margin-bottom:8px">Forecast at the time vs actual</h3><div class="table-wrap"><table class="table table--compact"><thead><tr><th></th><th class="num">Forecast</th><th class="num">Actual</th></tr></thead><tbody>
        <tr><td>Income</td><td class="num">${money(f.incomePence)}</td><td class="num">${money(r.incomePence)}</td></tr>
        <tr><td>Debt payments</td><td class="num">${money(f.debtPaidPence)}</td><td class="num">${money(r.debtPaidPence)}</td></tr>
        <tr><td>Savings</td><td class="num">${money(f.savingsPence)}</td><td class="num">${money(r.savingsPence)}</td></tr>
        <tr><td>Safe to spend</td><td class="num">${money(f.safeToSpendPence)}</td><td class="num">${money(r.safeToSpendPence)}</td></tr>
      </tbody></table></div></div>`);
    }
    if (r.phase !== 'actual') {
      const confirmed = r.incomeBasis === 'confirmed';
      parts.push(html`<form class="form" data-form="month-assumptions" data-month="${r.month}"><h3>Edit ${E.monthLabel(r.month)}</h3>
        <div class="form-grid">
          ${confirmed ? html`<div class="field"><span class="field__label">Income</span><span>${money(r.incomePence)} confirmed · edit on the Income page</span></div>`
            : r.phase === 'forecast' ? moneyField({ id: 'as-inc-' + r.month, name: 'income', label: 'Income assumption', value: mrec && mrec.assumedIncomePence != null ? attr(mrec.assumedIncomePence) : '', placeholder: attr(r.incomePence) + ' (' + E.INCOME_BASIS_LABEL[r.incomeBasis].toLowerCase() + ')', sm: true }) : html`<div class="field"><span class="field__label">Income</span><span>Not confirmed yet · confirm on the Income page</span></div>`}
          ${moneyField({ id: 'as-ex-' + r.month, name: 'extra', label: 'Extra debt payment', value: mrec && mrec.overrides.extraDebtPence != null ? attr(mrec.overrides.extraDebtPence) : '', placeholder: attr(r.recommended.extraDebtPence) + ' (recommended)', sm: true })}
          ${moneyField({ id: 'as-sv-' + r.month, name: 'savings', label: 'Savings contribution', value: mrec && mrec.overrides.savingsPence != null ? attr(mrec.overrides.savingsPence) : '', placeholder: attr(r.recommended.savingsPence) + ' (recommended)', sm: true })}
        </div>
        <div class="form-actions">${btn('Reset month to recommended', 'reset-month', { data: { month: r.month }, cls: 'btn--ghost btn--sm' })}${btn('Save ' + E.monthLabel(r.month, true), null, { type: 'submit', cls: 'btn--primary btn--sm' })}</div>
      </form>`);
    }
    return html`<div class="grid grid--2" style="align-items:start">${parts}</div>`;
  }

  /* ---------- Settings ---------- */
  PAGES.settings = function () {
    const st = S.settings;
    const last = st.lastBackupAt ? new Date(st.lastBackupAt) : null;
    return [
      pageHead('Settings', 'Preferences, budgeting rules and your data'),
      html`<section class="card"><div class="card__head"><div><h2>Appearance</h2></div></div>
        <div class="segmented" role="radiogroup" aria-label="Colour theme">
          <label><input type="radio" name="theme" value="dark" data-change="theme" ${st.theme !== 'light' ? raw('checked') : ''}><span>Dark</span></label>
          <label><input type="radio" name="theme" value="light" data-change="theme" ${st.theme === 'light' ? raw('checked') : ''}><span>Light</span></label>
        </div></section>`,
      html`<section class="card"><form class="form" data-form="rules"><h2>Budgeting rules</h2>
        <div class="form-grid">
          ${moneyField({ name: 'buffer', label: 'Financial buffer (minimum cash buffer)', value: attr(st.bufferPence), hint: 'Kept aside every month and never shown as safe to spend.' })}
          ${moneyField({ name: 'living', label: 'Minimum monthly living allowance', value: attr(st.minLivingAllowancePence), hint: 'Protected spending money: extra debt payments and savings are only recommended above this.' })}
          ${textField({ name: 'horizon', label: 'Planning horizon (months)', type: 'number', value: st.planningHorizonMonths, attrs: 'min="12" max="600" step="1"', hint: 'Projections stop here if debts cannot be repaid sooner (12–600).' })}
          <div class="field"><span class="field__label">Future income</span><label class="check"><input type="checkbox" name="assume" ${st.assumeIncomeRepeats ? raw('checked') : ''}> Assume latest confirmed income repeats (forecast only)</label></div>
        </div>
        <div class="form-actions">${btn('Save rules', null, { type: 'submit', cls: 'btn--primary' })}</div></form></section>`,
      html`<section class="card"><div class="stack">
        <h2>Your data</h2>
        ${alertBox('warning', 'Stored only in this browser', 'Your data is saved in this browser’s local storage on this device. It is not synchronised anywhere. It can be lost if you clear browsing data, use private browsing, or switch browser or device. Download a backup regularly — monthly at least — and keep it somewhere safe.')}
        <p class="muted small">${last ? 'Last backup: ' + E.formatDate(E.isoDate(last)) : 'No backup made yet.'}</p>
        <div class="row">
          ${btn('Backup data (JSON)', 'backup', { icon: 'download', cls: 'btn--primary' })}
          ${btn('Restore from backup', 'import', { icon: 'upload' })}
          ${btn('Export spreadsheet (CSV)', 'export-csv', { icon: 'table' })}
        </div>
      </div></section>`,
      html`<section class="card"><div class="stack"><h2>Privacy</h2>
        <p class="muted">No accounts, analytics, cookies, trackers or network requests. A Content Security Policy blocks all outgoing connections. Text you enter is always displayed as plain text.</p>
        <p class="muted small">Calculation tests: <a href="tests/index.html">run the engine test suite</a>.</p></div></section>`,
      html`<section class="card"><div class="stack"><h2>Example data and reset</h2>
        <p class="muted">Example data replaces everything with a realistic UK household so you can explore. Erasing removes all records from this browser.</p>
        <div class="row">${btn('Load example data', 'load-sample', { icon: 'refresh' })}${btn('Erase all data', 'erase', { icon: 'trash', cls: 'btn--danger' })}</div>
      </div></section>`
    ];
  };

  /* ======================================================================
   * 8. Modals, forms and confirmation dialogs
   * ====================================================================== */
  const modal = $('#modal');
  let modalCtx = {};
  let confirmResolve = null;

  function openModal(o) {
    modalCtx = o.ctx || {};
    modal.className = 'dialog' + (o.wide ? ' dialog--wide' : '');
    const tag = o.form ? 'form' : 'div';
    modal.innerHTML = html`<${raw(tag)} class="dialog__inner" ${o.form ? raw('data-form="' + o.form + '" novalidate') : ''}>
      <div class="dialog__head"><h2 id="modal-title">${o.title}</h2>${iconBtn('x', 'Close', 'close-modal')}</div>
      <div class="dialog__body">${o.body}</div>
      ${o.footer !== false ? html`<div class="dialog__foot">${o.footer || html`${btn('Cancel', 'close-modal', { cls: 'btn--ghost' })}${btn(o.submitLabel || 'Save', null, { type: 'submit', cls: 'btn--primary' })}`}</div>` : ''}
    </${raw(tag)}>`.s;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('.dialog__body input:not([type=hidden]):not([type=checkbox]):not([type=radio]), .dialog__body select, .dialog__body textarea, .dialog__body button');
    if (first) first.focus(); else modal.querySelector('.dialog__head button').focus();
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener('close', function () {
    if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(null); }
    modal.innerHTML = '';
  });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  /** Confirmation before destructive actions. Resolves with the chosen key, or null. */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      const choices = o.choices || [{ key: 'ok', label: o.confirmLabel || 'Confirm', danger: o.danger }];
      openModal({
        title: o.title, body: html`<p>${o.message}</p>${o.extra || ''}`,
        footer: html`${btn('Cancel', 'close-modal', { cls: 'btn--ghost' })}${choices.map(function (c) { return btn(c.label, 'confirm-choice', { data: { choice: c.key }, cls: c.danger ? 'btn--danger-solid' : c.primary === false ? 'btn--secondary' : 'btn--primary' }); })}`
      });
      confirmResolve = resolve;
    });
  }

  function showErrors(form, errors) {
    $$('.field__error', form).forEach(function (e) { e.remove(); });
    $$('[aria-invalid]', form).forEach(function (e) { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-errormessage'); });
    let first = null;
    Object.keys(errors).forEach(function (name) {
      const input = form.querySelector('[name="' + name + '"]');
      const msg = document.createElement('div');
      msg.className = 'field__error';
      msg.id = 'err-' + name;
      msg.textContent = errors[name];
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-errormessage', msg.id);
        const field = input.closest('.field') || input.parentElement;
        field.appendChild(msg);
        if (!first) first = input;
      } else {
        form.querySelector('.dialog__body, .form').prepend(msg);
      }
    });
    if (first) first.focus();
  }

  // Field readers
  function readMoney(fd, name, errors, o) {
    o = o || {};
    const v = String(fd.get(name) || '').trim();
    if (!v) { if (o.required) errors[name] = 'Enter an amount.'; return null; }
    const p = E.parseMoney(v, { allowNegative: o.allowNegative });
    if (p === null) { errors[name] = 'Enter a valid amount in pounds, e.g. 125.50.'; return null; }
    if (o.positive && p <= 0) { errors[name] = 'The amount must be more than £0.'; return null; }
    return p;
  }
  function readText(fd, name, errors, o) {
    o = o || {};
    const v = String(fd.get(name) || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, o.max || 80);
    if (!v && o.required) errors[name] = o.message || 'This field is required.';
    return v;
  }
  function readInt(fd, name, errors, lo, hi, label) {
    const v = String(fd.get(name) || '').trim();
    if (!v) return null;
    if (!/^\d+$/.test(v) || +v < lo || +v > hi) { errors[name] = label + ' must be a whole number from ' + lo + ' to ' + hi + '.'; return null; }
    return +v;
  }
  function readMonth(fd, name, errors, o) {
    const v = String(fd.get(name) || '').trim();
    if (!v) { if (o && o.required) errors[name] = 'Choose a month.'; return null; }
    if (!E.isMonthKey(v)) { errors[name] = 'Use the format YYYY-MM, e.g. 2026-11.'; return null; }
    return v;
  }
  function readDate(fd, name, errors, o) {
    const v = String(fd.get(name) || '').trim();
    if (!v) { if (o && o.required) errors[name] = 'Choose a date.'; return null; }
    let iso = v;
    const uk = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(v);
    if (uk) iso = uk[3] + '-' + uk[2].padStart(2, '0') + '-' + uk[1].padStart(2, '0');
    if (!E.isISODate(iso)) { errors[name] = 'Enter a valid date as DD/MM/YYYY, e.g. 05/11/2026.'; return null; }
    return iso;
  }

  /* ---------- Income forms ---------- */
  function incomeForm(entry, m) {
    const e = entry || {};
    openModal({
      title: entry ? 'Edit income' : 'Add income for ' + E.monthLabel(m), form: 'income', ctx: { id: e.id, month: m },
      body: html`<div class="form-grid">
        ${textField({ name: 'description', label: 'Description', value: e.description || '', placeholder: 'e.g. Salary', required: true, span: true })}
        ${selectField({ name: 'type', label: 'Type', value: e.type || 'salary', options: Store.INCOME_TYPES.map(function (t) { return { value: t.key, label: t.label }; }) })}
        ${moneyField({ name: 'amount', label: 'Amount received', value: e.amountPence != null ? attr(e.amountPence) : '', required: true })}
        <div class="span-2">${entry && e.sourceId ? html`<label class="check"><input type="checkbox" name="updateSource"> Also update the monthly suggestion to this amount</label>`
          : html`<label class="check"><input type="checkbox" name="recurring" ${entry ? '' : raw('checked')}> Suggest this every month <span class="subtle">— it is offered for confirmation, never counted automatically</span></label>`}</div>
      </div>`
    });
  }
  function sourceForm(src) {
    openModal({
      title: 'Edit monthly suggestion', form: 'source', ctx: { id: src.id },
      body: html`<div class="form-grid">
        ${textField({ name: 'description', label: 'Description', value: src.description, required: true, span: true })}
        ${selectField({ name: 'type', label: 'Type', value: src.type, options: Store.INCOME_TYPES.map(function (t) { return { value: t.key, label: t.label }; }) })}
        ${moneyField({ name: 'amount', label: 'Suggested amount', value: attr(src.amountPence), required: true })}
      </div><p class="subtle">Changing a suggestion does not alter income already confirmed.</p>`
    });
  }

  /* ---------- Monthly check-in (new month workflow) ---------- */
  function monthlyCheckin(m) {
    m = m || ui.month;
    const sug = incomeSuggestions(m);
    const exps = E.expensesForMonth(S, m);
    const debts = S.debts.filter(function (d) { return !d.archived && d.startMonth <= m; });
    const sim = E.simulate(S, { includeMonth: m });
    const obligations = E.monthObligations(S, sim, m, new Date()).filter(function (o) { return !o.paid; });
    const row = E.rowFor(sim, m);
    openModal({
      title: E.monthLabel(m) + ' check-in', form: 'checkin', ctx: { month: m, sources: sug.map(function (s) { return s.id; }) }, wide: true,
      submitLabel: 'Confirm income & update plan',
      body: html`
        <section class="stack"><h3>1 · Confirm your income</h3>
          <p class="muted small">Income never carries over automatically. Tick what you actually received and correct any amounts.</p>
          ${sug.length ? html`<ul class="list">${sug.map(function (s) { return html`<li class="list__item"><label class="check list__main"><input type="checkbox" name="use-${s.id}" checked><span><span class="list__title">${s.description}</span><span class="list__meta">${incomeTypeLabel(s.type)}</span></span></label><div class="money-input money-input--sm" style="width:130px"><input class="input" name="amt-${s.id}" inputmode="decimal" value="${attr(s.amountPence)}" aria-label="Amount for ${s.description}"></div></li>`; })}</ul>` : ''}
          <details class="disclosure" ${sug.length ? '' : raw('open')}><summary>${icon('chevronR')}${sug.length ? 'Add other income' : 'Add income'}</summary><div class="disclosure__body form-grid">
            ${textField({ name: 'newDesc', label: 'Description', placeholder: 'e.g. Salary', optional: true })}
            ${selectField({ name: 'newType', label: 'Type', value: 'salary', options: Store.INCOME_TYPES.map(function (t) { return { value: t.key, label: t.label }; }) })}
            ${moneyField({ name: 'newAmount', label: 'Amount', optional: true })}
            <div class="field"><span class="field__label">&nbsp;</span><label class="check"><input type="checkbox" name="newRecurring" checked> Suggest every month</label></div>
          </div></details>
        </section>
        <section class="stack"><h3>2 · Carried forward automatically</h3>
          <div class="grid grid--2">
            <div class="mini"><div class="mini__label">${plural(exps.length, 'recurring bill')}</div><div class="mini__value">${money(E.sum(exps, function (e) { return e.amountPence; }))}</div></div>
            <div class="mini"><div class="mini__label">${plural(debts.length, 'active debt')} · minimums</div><div class="mini__value">${money(row ? row.minDebtPence : 0)}</div></div>
          </div>
        </section>
        <section class="stack"><h3>3 · Still to pay this month</h3>
          ${obligations.length ? html`<ul class="list">${obligations.slice(0, 8).map(function (o) { return html`<li class="list__item"><div class="list__main"><div class="list__title">${o.label}</div><div class="list__meta">${o.dueDate ? 'Due ' + E.formatDate(o.dueDate) : 'No due date'}${o.overdue ? html` ${badge('Overdue', 'danger', 'alert')}` : ''}</div></div><div class="list__amount">${money(o.amountPence - o.paidPence)}</div></li>`; })}</ul>${obligations.length > 8 ? html`<p class="subtle">…and ${obligations.length - 8} more.</p>` : ''}` : html`<p class="muted">Nothing outstanding.</p>`}
        </section>
        <p class="subtle">After confirming, debt payments, savings and the safe-to-spend amount are recalculated and the repayment schedule is updated.</p>`,
      footer: html`${btn('Remind me later', 'checkin-later', { cls: 'btn--ghost' })}${btn('Confirm income & update plan', null, { type: 'submit', cls: 'btn--primary' })}`
    });
  }

  /* ---------- Expense form ---------- */
  function expenseForm(exp) {
    const e = exp || {};
    const m = ui.month;
    const scoped = exp && exp.recurring && exp.startMonth < m;
    openModal({
      title: exp ? 'Edit expense' : 'Add expense', form: 'expense', ctx: { id: e.id, month: m },
      body: html`<div class="form-grid">
        ${textField({ name: 'description', label: 'Description', value: e.description || '', placeholder: 'e.g. Rent', required: true, span: true })}
        ${selectField({ name: 'category', label: 'Category', value: e.category || 'rent', options: Store.EXPENSE_CATEGORIES.map(function (c) { return { value: c.key, label: c.label }; }) })}
        ${moneyField({ name: 'amount', label: 'Amount', value: e.amountPence != null ? attr(e.amountPence) : '', required: true })}
        ${textField({ name: 'dueDay', label: 'Due day of month', type: 'number', value: e.dueDay || '', attrs: 'min="1" max="31" inputmode="numeric"', optional: true, hint: '1–31. Used for reminders and overdue checks.' })}
        <fieldset class="field"><legend>How often</legend><div class="segmented">
          <label><input type="radio" name="recurring" value="yes" ${e.recurring !== false ? raw('checked') : ''}><span>Every month</span></label>
          <label><input type="radio" name="recurring" value="no" ${e.recurring === false ? raw('checked') : ''}><span>One-off (${E.monthLabel(exp ? e.startMonth : m, true)})</span></label>
        </div></fieldset>
        ${scoped ? html`<fieldset class="field span-2"><legend>Apply this change to</legend>
          <label class="check"><input type="radio" name="scope" value="forward" checked> ${E.monthLabel(m)} onwards <span class="subtle">— earlier months keep the old amount</span></label>
          <label class="check"><input type="radio" name="scope" value="all"> All months since ${E.monthLabel(e.startMonth)} <span class="subtle">— correct a mistake</span></label></fieldset>` : ''}
      </div>`
    });
  }

  /* ---------- Debt forms ---------- */
  function debtForm(debt) {
    const d = debt || {};
    openModal({
      title: debt ? 'Edit debt' : 'Add debt', form: 'debt', ctx: { id: d.id }, wide: true,
      body: html`<div class="form-grid">
        ${textField({ name: 'creditor', label: 'Creditor', value: d.creditor || '', placeholder: 'e.g. Barclaycard', required: true })}
        ${textField({ name: 'description', label: 'Description', value: d.description || '', placeholder: 'e.g. Credit card', optional: true })}
        ${moneyField({ name: 'balance', label: debt ? 'Balance at start of “balance as at” month' : 'Current outstanding balance', value: d.balancePence != null ? attr(d.balancePence) : '', required: true })}
        ${textField({ name: 'startMonth', label: 'Balance as at (start month)', type: 'month', value: d.startMonth || ui.month, attrs: 'placeholder="YYYY-MM"', required: true, hint: 'Payments from this month onwards reduce the balance.' })}
        ${textField({ name: 'apr', label: 'Annual interest rate (APR %)', value: d.aprBps != null ? (d.aprBps / 100).toFixed(2) : '', placeholder: 'e.g. 24.90', attrs: 'inputmode="decimal"', optional: true, hint: 'Leave blank for interest-free.' })}
        ${moneyField({ name: 'minPayment', label: 'Minimum monthly payment', value: d.minPaymentPence != null ? attr(d.minPaymentPence) : '', required: true })}
        ${textField({ name: 'dueDay', label: 'Payment due day', type: 'number', value: d.dueDay || '', attrs: 'min="1" max="31" inputmode="numeric"', optional: true })}
        ${textField({ name: 'interestFreeUntil', label: 'Interest-free until (inclusive)', type: 'month', value: d.interestFreeUntil || '', attrs: 'placeholder="YYYY-MM"', optional: true })}
        ${dateField({ name: 'contractEndDate', label: 'Contractual end date', value: d.contractEndDate || '', optional: true })}
        ${textField({ name: 'priority', label: 'Priority', type: 'number', value: d.priority || '', attrs: 'min="1" max="99" inputmode="numeric"', optional: true, hint: '1 = pay first, for the “your priority order” strategy.' })}
        <div class="field span-2"><label for="f-notes">Notes <span class="subtle">(optional)</span></label><textarea class="textarea" id="f-notes" name="notes" maxlength="1000">${d.notes || ''}</textarea></div>
      </div>
      ${debt ? alertBox('info', null, 'Updating the balance or start month re-baselines this debt: payments recorded before the start month stay in the history but no longer reduce the balance.') : ''}`
    });
  }
  function paymentForm(debtId, amount) {
    const active = S.debts.filter(function (d) { return !d.archived; });
    if (!active.length) { toast('Add a debt first.', 'warning'); return; }
    const ctx = lastCtx;
    const id = debtId || active[0].id;
    const r = ctx && ctx.row ? ctx.row.debts.find(function (x) { return x.id === id; }) : null;
    const suggested = amount != null ? amount : r ? Math.max(0, r.plannedPence - r.actualPence) : '';
    openModal({
      title: 'Record a payment', form: 'payment', ctx: {},
      body: html`<div class="form-grid">
        ${selectField({ name: 'debtId', label: 'Debt', value: id, span: true, options: active.map(function (d) { return { value: d.id, label: E.debtName(d) }; }) })}
        ${dateField({ name: 'date', label: 'Date paid', value: todayISOFor(ui.month), required: true })}
        ${moneyField({ name: 'amount', label: 'Amount paid', value: suggested !== '' && suggested > 0 ? attr(suggested) : '', required: true, hint: r ? 'Planned this month: ' + money(r.plannedPence) + ' · already recorded: ' + money(r.actualPence) : '' })}
        <fieldset class="field span-2"><legend>Type</legend><div class="segmented">
          <label><input type="radio" name="kind" value="regular" checked><span>Regular payment</span></label>
          <label><input type="radio" name="kind" value="extra"><span>Extra payment</span></label></div></fieldset>
        ${textField({ name: 'note', label: 'Note', optional: true, span: true })}
      </div><p class="subtle">Only payments you record here count as actually paid. Projections are never treated as payments.</p>`
    });
  }
  function debtHistory(id) {
    const d = findDebt(id);
    const pays = S.debtPayments.filter(function (p) { return p.debtId === id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    openModal({
      title: 'Payment history — ' + E.debtName(d), wide: true, footer: html`${btn('Record payment', 'add-payment', { data: { id: id }, cls: 'btn--primary' })}${btn('Close', 'close-modal', { cls: 'btn--ghost' })}`,
      body: pays.length ? html`<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th class="num">Amount</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${pays.map(function (p) { return html`<tr><td>${E.formatDate(p.date)}${p.month < d.startMonth ? html` <span class="subtle">(before start)</span>` : ''}</td><td>${p.kind === 'extra' ? badge('Extra', 'positive') : 'Regular'}</td><td>${p.note || '—'}</td><td class="num">${money(p.amountPence)}</td><td class="actions">${iconBtn('trash', 'Delete payment', 'delete-payment', { id: p.id, debt: id })}</td></tr>`; })}
        </tbody><tfoot><tr><td>Total</td><td></td><td></td><td class="num">${money(E.sum(pays, function (p) { return p.amountPence; }))}</td><td></td></tr></tfoot></table></div>`
        : empty('clock', 'No payments recorded', 'Record each payment as you make it so balances stay accurate.')
    });
  }

  /* ---------- Spending, deposits ---------- */
  function spendForm(entry, m) {
    const e = entry || {};
    openModal({
      title: entry ? 'Edit spending' : 'Record spending', form: 'spend', ctx: { id: e.id, month: m },
      body: html`<div class="form-grid">
        ${moneyField({ name: 'amount', label: 'Amount', value: e.amountPence != null ? attr(e.amountPence) : '', required: true })}
        ${dateField({ name: 'date', label: 'Date', value: e.date || todayISOFor(ui.month), required: true })}
        ${selectField({ name: 'category', label: 'Category', value: e.category || 'groceries', options: E.SPEND_CATS.map(function (c) { return { value: c.key, label: c.label }; }) })}
        ${textField({ name: 'description', label: 'Description', value: e.description || '', optional: true, placeholder: 'e.g. Weekly shop' })}
      </div>`
    });
  }
  function depositForm() {
    openModal({
      title: 'Record savings deposit', form: 'deposit', ctx: {},
      body: html`<div class="form-grid">
        <fieldset class="field span-2"><legend>Type</legend><div class="segmented">
          <label><input type="radio" name="kind" value="in" checked><span>Deposit</span></label>
          <label><input type="radio" name="kind" value="out"><span>Withdrawal</span></label></div></fieldset>
        ${moneyField({ name: 'amount', label: 'Amount', required: true })}
        ${dateField({ name: 'date', label: 'Date', value: todayISOFor(ui.month), required: true })}
        ${textField({ name: 'note', label: 'Note', optional: true, span: true })}
      </div>`
    });
  }

  /* ---------- Form submit handlers ---------- */
  const FORMS = {
    income: function (fd) {
      const errors = {};
      const description = readText(fd, 'description', errors, { required: true });
      const amount = readMoney(fd, 'amount', errors, { required: true });
      const type = String(fd.get('type'));
      if (Object.keys(errors).length) return errors;
      const c = modalCtx;
      commit(function (s) {
        const rec = monthRec(c.month);
        if (c.id) {
          const e = rec.income.find(function (i) { return i.id === c.id; });
          Object.assign(e, { description: description, amountPence: amount, type: type });
          if (fd.get('updateSource') && e.sourceId) { const src = s.incomeSources.find(function (x) { return x.id === e.sourceId; }); if (src) Object.assign(src, { amountPence: amount, description: description, type: type }); }
          if (fd.get('recurring') && !e.sourceId) { const src = { id: Store.uid(), description: description, type: type, amountPence: amount, active: true }; s.incomeSources.push(src); e.sourceId = src.id; }
        } else {
          let sourceId = null;
          if (fd.get('recurring')) { const src = { id: Store.uid(), description: description, type: type, amountPence: amount, active: true }; s.incomeSources.push(src); sourceId = src.id; }
          rec.income.push({ id: Store.uid(), description: description, type: type, amountPence: amount, sourceId: sourceId });
        }
      }, c.id ? 'Income updated.' : money(amount) + ' income confirmed for ' + E.monthLabel(c.month) + '.');
    },
    source: function (fd) {
      const errors = {};
      const description = readText(fd, 'description', errors, { required: true });
      const amount = readMoney(fd, 'amount', errors, { required: true });
      if (Object.keys(errors).length) return errors;
      commit(function (s) { const src = s.incomeSources.find(function (x) { return x.id === modalCtx.id; }); Object.assign(src, { description: description, amountPence: amount, type: String(fd.get('type')) }); }, 'Suggestion updated.');
    },
    checkin: function (fd) {
      const errors = {};
      const c = modalCtx;
      const add = [];
      c.sources.forEach(function (sid) {
        if (!fd.get('use-' + sid)) return;
        const p = readMoney(fd, 'amt-' + sid, errors, { required: true });
        if (p !== null) add.push({ sid: sid, amount: p });
      });
      const nd = readText(fd, 'newDesc', errors);
      const na = readMoney(fd, 'newAmount', errors);
      if (na !== null && !nd) errors.newDesc = 'Add a description for this income.';
      if (nd && na === null && !errors.newAmount) errors.newAmount = 'Enter the amount.';
      if (!add.length && na === null && !Object.keys(errors).length) errors.newAmount = 'Confirm at least one income, or choose “Remind me later”.';
      if (Object.keys(errors).length) return errors;
      commit(function (s) {
        const rec = monthRec(c.month);
        add.forEach(function (a) {
          const src = s.incomeSources.find(function (x) { return x.id === a.sid; });
          rec.income.push({ id: Store.uid(), description: src.description, type: src.type, amountPence: a.amount, sourceId: src.id });
        });
        if (na !== null) {
          let sourceId = null;
          const type = String(fd.get('newType'));
          if (fd.get('newRecurring')) { const src = { id: Store.uid(), description: nd, type: type, amountPence: na, active: true }; s.incomeSources.push(src); sourceId = src.id; }
          rec.income.push({ id: Store.uid(), description: nd, type: type, amountPence: na, sourceId: sourceId });
        }
        s.settings.lastPromptedMonth = E.monthKey(new Date());
      }, 'Income confirmed. Your plan has been recalculated.');
      if (ui.route !== 'dashboard') location.hash = '#dashboard';
    },
    assumption: function (fd, form) {
      const errors = {};
      const p = readMoney(fd, 'assumed', errors);
      if (Object.keys(errors).length) return errors;
      const m = form.dataset.month;
      commit(function () { monthRec(m).assumedIncomePence = p; }, p === null ? 'Assumption cleared.' : 'Forecast assumption saved. It is not counted as received income.');
    },
    expense: function (fd) {
      const errors = {};
      const description = readText(fd, 'description', errors, { required: true });
      const amount = readMoney(fd, 'amount', errors, { required: true, positive: true });
      const dueDay = readInt(fd, 'dueDay', errors, 1, 31, 'Due day');
      if (Object.keys(errors).length) return errors;
      const recurring = fd.get('recurring') !== 'no';
      const category = String(fd.get('category'));
      const c = modalCtx;
      commit(function (s) {
        if (!c.id) {
          s.expenses.push({ id: Store.uid(), description: description, amountPence: amount, category: category, dueDay: dueDay, recurring: recurring, startMonth: c.month, endMonth: recurring ? null : c.month, createdAt: new Date().toISOString() });
          return;
        }
        const e = s.expenses.find(function (x) { return x.id === c.id; });
        const changes = { description: description, amountPence: amount, category: category, dueDay: dueDay };
        if (fd.get('scope') === 'forward' && e.recurring && e.startMonth < c.month) {
          // End the old version last month and start a new version from this month,
          // so earlier months keep their recorded amounts.
          const nu = Object.assign({}, e, changes, { id: Store.uid(), startMonth: c.month, recurring: recurring, endMonth: recurring ? e.endMonth : c.month, createdAt: new Date().toISOString() });
          e.endMonth = E.addMonths(c.month, -1);
          s.expenses.push(nu);
          Object.keys(s.months).forEach(function (k) {
            const st = s.months[k].expenseStatus;
            if (k >= c.month && st[e.id]) { st[nu.id] = st[e.id]; delete st[e.id]; }
          });
        } else {
          Object.assign(e, changes);
          if (recurring !== e.recurring) { e.recurring = recurring; e.endMonth = recurring ? null : e.startMonth; }
        }
      }, c.id ? 'Expense updated.' : 'Expense added' + (recurring ? ' — it will appear every month from ' + E.monthLabel(c.month) + '.' : '.'));
    },
    debt: function (fd) {
      const errors = {};
      const creditor = readText(fd, 'creditor', errors, { required: true, message: 'Enter the creditor’s name.' });
      const description = readText(fd, 'description', errors, { max: 120 });
      const balance = readMoney(fd, 'balance', errors, { required: true });
      const minPayment = readMoney(fd, 'minPayment', errors, { required: true });
      const startMonth = readMonth(fd, 'startMonth', errors, { required: true });
      const aprRaw = String(fd.get('apr') || '').trim();
      let aprBps = 0;
      if (aprRaw) { aprBps = E.parsePercentBps(aprRaw); if (aprBps === null) { errors.apr = 'Enter a rate between 0 and 1000, e.g. 24.9.'; aprBps = 0; } }
      const dueDay = readInt(fd, 'dueDay', errors, 1, 31, 'Due day');
      const ifu = readMonth(fd, 'interestFreeUntil', errors);
      const ced = readDate(fd, 'contractEndDate', errors);
      const priority = readInt(fd, 'priority', errors, 1, 99, 'Priority');
      const notes = String(fd.get('notes') || '').trim().slice(0, 1000);
      if (ifu && startMonth && ifu < startMonth) errors.interestFreeUntil = 'The interest-free period must end on or after the start month.';
      if (Object.keys(errors).length) return errors;
      const c = modalCtx;
      const data = { creditor: creditor, description: description, balancePence: balance, aprBps: aprBps, minPaymentPence: minPayment, dueDay: dueDay, startMonth: startMonth, interestFreeUntil: ifu, contractEndDate: ced, priority: priority, notes: notes };
      commit(function (s) {
        if (c.id) Object.assign(s.debts.find(function (d) { return d.id === c.id; }), data);
        else s.debts.push(Object.assign({ id: Store.uid(), archived: false, createdAt: new Date().toISOString() }, data));
      }, c.id ? 'Debt updated. The plan has been recalculated.' : creditor + ' added. The plan has been recalculated.');
      if (minPayment === 0 && balance > 0) toast('This debt has no minimum payment, so it will only reduce with extra payments.', 'warning', 7000);
    },
    payment: function (fd) {
      const errors = {};
      const debtId = String(fd.get('debtId'));
      const amount = readMoney(fd, 'amount', errors, { required: true, positive: true });
      const date = readDate(fd, 'date', errors, { required: true });
      const debt = findDebt(debtId);
      if (!debt) errors.debtId = 'Choose a debt.';
      if (date && debt && date.slice(0, 7) < debt.startMonth) errors.date = 'This date is before the debt’s start month (' + E.monthLabel(debt.startMonth) + '), so it would not reduce the balance.';
      if (Object.keys(errors).length) return errors;
      const kind = fd.get('kind') === 'extra' ? 'extra' : 'regular';
      const note = readText(fd, 'note', errors, { max: 200 });
      const m = date.slice(0, 7);
      const sim = E.simulate(S, { includeMonth: m });
      const r = E.rowFor(sim, m);
      const it = r ? r.debts.find(function (x) { return x.id === debtId; }) : null;
      const due = it ? it.openingPence + it.interestPence - it.actualPence : null;
      const save = function () {
        commit(function (s) { s.debtPayments.push({ id: Store.uid(), debtId: debtId, date: date, month: m, amountPence: amount, kind: kind, note: note }); }, money(amount) + ' payment to ' + debt.creditor + ' recorded.');
      };
      if (due !== null && amount > due) {
        closeModal();
        confirmDialog({ title: 'Payment is more than the estimated balance', message: 'The estimated amount owed in ' + E.monthLabel(m) + ' is ' + money(Math.max(0, due)) + '. The balance will not go below £0; any excess is shown as an overpayment. Record ' + money(amount) + ' anyway?', confirmLabel: 'Record payment' })
          .then(function (ok) { if (ok) save(); });
        return 'handled';
      }
      save();
    },
    spend: function (fd) {
      const errors = {};
      const amount = readMoney(fd, 'amount', errors, { required: true, positive: true });
      const date = readDate(fd, 'date', errors, { required: true });
      const description = readText(fd, 'description', errors);
      if (Object.keys(errors).length) return errors;
      const category = String(fd.get('category'));
      const c = modalCtx;
      const m = date.slice(0, 7);
      commit(function () {
        if (c.id) { const old = monthRec(c.month); old.discretionarySpend = old.discretionarySpend.filter(function (x) { return x.id !== c.id; }); }
        monthRec(m).discretionarySpend.push({ id: c.id || Store.uid(), date: date, category: category, description: description, amountPence: amount });
      }, money(amount) + ' recorded under ' + spendLabel(category) + (m !== ui.month ? ' in ' + E.monthLabel(m) : '') + '.');
    },
    deposit: function (fd) {
      const errors = {};
      const amount = readMoney(fd, 'amount', errors, { required: true, positive: true });
      const date = readDate(fd, 'date', errors, { required: true });
      const note = readText(fd, 'note', errors, { max: 200 });
      if (Object.keys(errors).length) return errors;
      const signed = fd.get('kind') === 'out' ? -amount : amount;
      commit(function () { monthRec(date.slice(0, 7)).savingsDeposits.push({ id: Store.uid(), date: date, amountPence: signed, note: note }); }, (signed > 0 ? 'Deposit' : 'Withdrawal') + ' of ' + money(amount) + ' recorded.');
    },
    overrides: function (fd, form) {
      const errors = {};
      const extra = readMoney(fd, 'extra', errors);
      const savings = readMoney(fd, 'savings', errors);
      if (Object.keys(errors).length) return errors;
      const m = form.dataset.month;
      const asDefault = !!fd.get('asDefault');
      commit(function (s) {
        const o = monthRec(m).overrides;
        o.extraDebtPence = extra; o.savingsPence = savings;
        if (asDefault) { s.settings.defaultOverrides = { extraDebtPence: extra, savingsPence: savings }; }
      }, asDefault ? 'Applied to ' + E.monthLabel(m) + ' and all future months.' : 'Plan updated for ' + E.monthLabel(m) + '.');
    },
    'savings-override': function (fd, form) {
      const errors = {};
      const savings = readMoney(fd, 'savings', errors);
      if (Object.keys(errors).length) return errors;
      commit(function () { monthRec(form.dataset.month).overrides.savingsPence = savings; }, 'Savings contribution updated.');
    },
    'savings-settings': function (fd) {
      const errors = {};
      const target = readMoney(fd, 'target', errors) || 0;
      const goal = readMoney(fd, 'goal', errors) || 0;
      const balance = readMoney(fd, 'balance', errors) || 0;
      const buffer = readMoney(fd, 'buffer', errors) || 0;
      const baseline = readMonth(fd, 'baseline', errors, { required: true });
      if (Object.keys(errors).length) return errors;
      commit(function (s) {
        Object.assign(s.savings, { targetMonthlyPence: target, emergencyGoalPence: goal, openingBalancePence: balance, baselineMonth: baseline, priority: fd.get('priority') === 'steady' ? 'steady' : 'emergency' });
        s.settings.bufferPence = buffer;
      }, 'Savings settings saved.');
    },
    'month-assumptions': function (fd, form) {
      const errors = {};
      const m = form.dataset.month;
      const income = fd.has('income') ? readMoney(fd, 'income', errors) : undefined;
      const extra = readMoney(fd, 'extra', errors);
      const savings = readMoney(fd, 'savings', errors);
      if (Object.keys(errors).length) return errors;
      commit(function () {
        const rec = monthRec(m);
        if (income !== undefined) rec.assumedIncomePence = income;
        rec.overrides.extraDebtPence = extra; rec.overrides.savingsPence = savings;
      }, E.monthLabel(m) + ' updated. Projection recalculated.');
    },
    rules: function (fd) {
      const errors = {};
      const buffer = readMoney(fd, 'buffer', errors) || 0;
      const living = readMoney(fd, 'living', errors) || 0;
      const horizon = readInt(fd, 'horizon', errors, 12, 600, 'Planning horizon');
      if (Object.keys(errors).length) return errors;
      commit(function (s) {
        s.settings.bufferPence = buffer; s.settings.minLivingAllowancePence = living;
        s.settings.planningHorizonMonths = horizon || 120; s.settings.assumeIncomeRepeats = !!fd.get('assume');
      }, 'Budgeting rules saved.');
    },
    'spend-rules': function (fd) {
      const errors = {};
      const mins = {}, pcts = {};
      let total = 0;
      E.SPEND_CATS.forEach(function (c) {
        mins[c.key] = readMoney(fd, 'min-' + c.key, errors) || 0;
        const v = readInt(fd, 'pct-' + c.key, errors, 0, 100, c.label + ' percentage');
        pcts[c.key] = v || 0; total += pcts[c.key];
      });
      if (total !== 100 && !Object.keys(errors).length) errors['pct-misc'] = 'Percentages must add up to 100 (currently ' + total + ').';
      if (Object.keys(errors).length) return errors;
      commit(function (s) { s.settings.spending = { mins: mins, pcts: pcts }; }, 'Allocation rules saved.');
    },
    rebalance: function () {
      const p = modalCtx.proposed;
      commit(function () { monthRec(modalCtx.month).categoryBudgets = Object.assign({}, p); }, 'Budgets rebalanced for the rest of ' + E.monthLabel(modalCtx.month) + '.');
    }
  };

  /* ======================================================================
   * 9. Actions (event delegation)
   * ====================================================================== */
  const ACTIONS = {
    'go': function (el) { location.hash = '#' + el.dataset.route; },
    'open-drawer': function () { setDrawer(true); },
    'close-drawer': function () { setDrawer(false); },
    'toggle-sidebar': function () { S.settings.sidebarCollapsed = !S.settings.sidebarCollapsed; persist(); applySidebar(); setTimeout(render, 220); },
    'toggle-theme': function () { S.settings.theme = S.settings.theme === 'light' ? 'dark' : 'light'; persist(); applyTheme(); if (ui.route === 'settings') render(); },
    'step-month': function (el) { setMonth(E.addMonths(ui.month, +el.dataset.delta)); },
    'toggle-picker': function () { ui.pickerOpen = !ui.pickerOpen; ui.pickerYear = +ui.month.slice(0, 4); renderMonthPicker(); if (ui.pickerOpen) { const b = $('.month-pop__cell[aria-pressed="true"]'); if (b) b.focus(); } },
    'close-picker': function () { ui.pickerOpen = false; renderMonthPicker(); $('.month-picker__label').focus(); },
    'picker-year': function (el) { ui.pickerYear += +el.dataset.delta; renderMonthPicker(); },
    'pick-month': function (el) { setMonth(el.dataset.month); const l = $('.month-picker__label'); if (l) l.focus(); },
    'close-modal': function () { closeModal(); },
    'confirm-choice': function (el) { const r = confirmResolve; confirmResolve = null; closeModal(); if (r) r(el.dataset.choice); },
    'backup': function () { downloadBackup(); },
    'import': function () { $('#import-file').value = ''; $('#import-file').click(); },
    'export-csv': function () { exportCSV(); },
    'load-sample': function () {
      const go = function () {
        S = Sample.build(new Date()); S.settings.theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        ui.month = E.monthKey(new Date()); persist(); location.hash = '#dashboard'; render(); toast('Example data loaded. Try the monthly check-in.', 'success');
        setTimeout(function () { monthlyCheckin(ui.month); }, 300);
      };
      if (!hasAnyData()) { go(); return; }
      confirmDialog({ title: 'Replace your data with example data?', message: 'All your current records will be replaced. Download a backup first if you want to keep them.', choices: [{ key: 'backup', label: 'Backup first', primary: false }, { key: 'ok', label: 'Replace with example', danger: true }] })
        .then(function (c) { if (c === 'backup') { downloadBackup(); } else if (c === 'ok') go(); });
    },
    'erase': function () {
      confirmDialog({ title: 'Erase all data?', message: 'This permanently removes every income entry, expense, debt, payment and setting from this browser. This cannot be undone.', choices: [{ key: 'backup', label: 'Backup first', primary: false }, { key: 'ok', label: 'Erase everything', danger: true }] })
        .then(function (c) {
          if (c === 'backup') downloadBackup();
          else if (c === 'ok') { const theme = S.settings.theme; S = Store.defaultState(); S.settings.theme = theme; persist(); ui.expanded.clear(); location.hash = '#dashboard'; render(); toast('All data erased.', 'success'); }
        });
    },

    // Income
    'monthly-checkin': function () { monthlyCheckin(ui.month); },
    'checkin-later': function () { S.settings.lastPromptedMonth = E.monthKey(new Date()); persist(); closeModal(); toast('You can confirm income any time from the dashboard.', 'success'); },
    'add-income': function () { incomeForm(null, ui.month); },
    'edit-income': function (el) { const e = S.months[el.dataset.month].income.find(function (i) { return i.id === el.dataset.id; }); incomeForm(e, el.dataset.month); },
    'delete-income': function (el) {
      const rec = S.months[el.dataset.month];
      const e = rec.income.find(function (i) { return i.id === el.dataset.id; });
      confirmDialog({ title: 'Delete this income?', message: 'Remove “' + e.description + '” (' + money(e.amountPence) + ') from ' + E.monthLabel(el.dataset.month) + '?', confirmLabel: 'Delete', danger: true })
        .then(function (ok) { if (ok) commit(function () { rec.income = rec.income.filter(function (i) { return i.id !== e.id; }); }, 'Income deleted.'); });
    },
    'confirm-suggestion': function (el) {
      const src = S.incomeSources.find(function (x) { return x.id === el.dataset.id; });
      const input = document.getElementById('sug-' + src.id);
      const p = E.parseMoney(input.value);
      if (p === null) { toast('Enter a valid amount.', 'danger'); input.focus(); return; }
      commit(function () { monthRec(el.dataset.month).income.push({ id: Store.uid(), description: src.description, type: src.type, amountPence: p, sourceId: src.id }); }, money(p) + ' confirmed.');
    },
    'dismiss-suggestion': function (el) { commit(function () { monthRec(el.dataset.month).dismissedSources.push(el.dataset.id); }, 'Suggestion dismissed for this month.'); },
    'edit-source': function (el) { sourceForm(S.incomeSources.find(function (x) { return x.id === el.dataset.id; })); },
    'toggle-source': function (el) { commit(function (s) { const x = s.incomeSources.find(function (y) { return y.id === el.dataset.id; }); x.active = !x.active; }); },
    'delete-source': function (el) {
      confirmDialog({ title: 'Delete this monthly suggestion?', message: 'Confirmed income in past months is kept.', confirmLabel: 'Delete', danger: true })
        .then(function (ok) { if (ok) commit(function (s) { s.incomeSources = s.incomeSources.filter(function (x) { return x.id !== el.dataset.id; }); }, 'Suggestion deleted.'); });
    },
    'clear-assumption': function (el) { commit(function () { monthRec(el.dataset.month).assumedIncomePence = null; }, 'Assumption cleared.'); },

    // Expenses
    'add-expense': function () { expenseForm(null); },
    'edit-expense': function (el) { expenseForm(S.expenses.find(function (e) { return e.id === el.dataset.id; })); },
    'delete-expense': function (el) {
      const e = S.expenses.find(function (x) { return x.id === el.dataset.id; });
      const m = ui.month;
      const choices = e.recurring && e.startMonth < m
        ? [{ key: 'stop', label: 'Stop from ' + E.monthLabel(m, true), primary: false }, { key: 'all', label: 'Delete from all months', danger: true }]
        : [{ key: 'all', label: 'Delete', danger: true }];
      confirmDialog({ title: 'Delete “' + e.description + '”?', message: e.recurring && e.startMonth < m ? 'Stopping keeps it in earlier months (recommended for bills that have ended). Deleting removes it from every month, including history.' : 'This removes the expense and its payment status.', choices: choices })
        .then(function (c) {
          if (c === 'stop') commit(function () { e.endMonth = E.addMonths(m, -1); }, 'Expense stopped from ' + E.monthLabel(m) + '.');
          else if (c === 'all') commit(function (s) { s.expenses = s.expenses.filter(function (x) { return x.id !== e.id; }); Object.keys(s.months).forEach(function (k) { delete s.months[k].expenseStatus[e.id]; }); }, 'Expense deleted.');
        });
    },
    'toggle-paid': function (el) { setPaid(el.dataset.id, el.dataset.month, el.dataset.paid === '1'); },

    // Debts
    'add-debt': function () { debtForm(null); },
    'edit-debt': function (el) { debtForm(findDebt(el.dataset.id)); },
    'add-payment': function (el) { paymentForm(el.dataset.id || null); },
    'quick-pay': function (el) {
      const d = findDebt(el.dataset.id), amt = +el.dataset.amount, m = el.dataset.month;
      if (!(amt > 0)) return;
      confirmDialog({ title: 'Record minimum payment?', message: 'Record ' + money(amt) + ' paid to ' + E.debtName(d) + ' on ' + E.formatDate(todayISOFor(m)) + '? Only confirm if you have actually made this payment.', confirmLabel: 'Yes, I have paid' })
        .then(function (ok) { if (ok) commit(function (s) { const date = todayISOFor(m); s.debtPayments.push({ id: Store.uid(), debtId: d.id, date: date, month: date.slice(0, 7), amountPence: amt, kind: 'regular', note: '' }); }, 'Payment recorded.'); });
    },
    'debt-history': function (el) { debtHistory(el.dataset.id); },
    'delete-payment': function (el) {
      const p = S.debtPayments.find(function (x) { return x.id === el.dataset.id; });
      confirmDialog({ title: 'Delete this payment?', message: 'Remove the ' + money(p.amountPence) + ' payment on ' + E.formatDate(p.date) + '? The balance will be recalculated.', confirmLabel: 'Delete', danger: true })
        .then(function (ok) { if (ok) { commit(function (s) { s.debtPayments = s.debtPayments.filter(function (x) { return x.id !== p.id; }); }, 'Payment deleted.'); debtHistory(el.dataset.debt); } else debtHistory(el.dataset.debt); });
    },
    'archive-debt': function (el) {
      const d = findDebt(el.dataset.id);
      if (d.archived) { commit(function () { d.archived = false; }, d.creditor + ' restored.'); return; }
      confirmDialog({ title: 'Archive ' + E.debtName(d) + '?', message: 'Archived debts are removed from totals and projections but keep their payment history. You can restore it later.', confirmLabel: 'Archive' })
        .then(function (ok) { if (ok) commit(function () { d.archived = true; }, d.creditor + ' archived.'); });
    },
    'delete-debt': function (el) {
      const d = findDebt(el.dataset.id);
      const n = S.debtPayments.filter(function (p) { return p.debtId === d.id; }).length;
      confirmDialog({ title: 'Delete ' + E.debtName(d) + '?', message: 'This permanently deletes the debt' + (n ? ' and its ' + plural(n, 'recorded payment') : '') + '. Consider archiving instead to keep the history.', choices: [{ key: 'archive', label: 'Archive instead', primary: false }, { key: 'ok', label: 'Delete permanently', danger: true }] })
        .then(function (c) {
          if (c === 'archive') commit(function () { d.archived = true; }, d.creditor + ' archived.');
          else if (c === 'ok') commit(function (s) { s.debts = s.debts.filter(function (x) { return x.id !== d.id; }); s.debtPayments = s.debtPayments.filter(function (p) { return p.debtId !== d.id; }); }, 'Debt deleted.');
        });
    },

    // Plan & savings
    'reset-overrides': function (el) { commit(function () { monthRec(el.dataset.month).overrides = { extraDebtPence: null, savingsPence: null }; }, 'Reset to recommended amounts.'); },
    'clear-defaults': function () { commit(function (s) { s.settings.defaultOverrides = { extraDebtPence: null, savingsPence: null }; }, 'Future months now use recommended amounts.'); },
    'reset-savings-override': function (el) { commit(function () { monthRec(el.dataset.month).overrides.savingsPence = null; }, 'Savings reset to recommended.'); },
    'reset-month': function (el) { commit(function () { const r = monthRec(el.dataset.month); r.overrides = { extraDebtPence: null, savingsPence: null }; r.assumedIncomePence = null; }, E.monthLabel(el.dataset.month) + ' reset to recommended.'); },
    'add-deposit': function () { depositForm(); },
    'delete-deposit': function (el) {
      confirmDialog({ title: 'Delete this entry?', message: 'The savings balance will be recalculated.', confirmLabel: 'Delete', danger: true })
        .then(function (ok) { if (ok) commit(function () { const r = monthRec(el.dataset.month); r.savingsDeposits = r.savingsDeposits.filter(function (d) { return d.id !== el.dataset.id; }); }, 'Entry deleted.'); });
    },

    // Spending
    'add-spend': function () { spendForm(null, ui.month); },
    'edit-spend': function (el) { spendForm(S.months[el.dataset.month].discretionarySpend.find(function (x) { return x.id === el.dataset.id; }), el.dataset.month); },
    'delete-spend': function (el) {
      confirmDialog({ title: 'Delete this spending entry?', message: 'Your remaining budget will be recalculated.', confirmLabel: 'Delete', danger: true })
        .then(function (ok) { if (ok) commit(function () { const r = monthRec(el.dataset.month); r.discretionarySpend = r.discretionarySpend.filter(function (x) { return x.id !== el.dataset.id; }); }, 'Entry deleted.'); });
    },
    'reset-cat': function (el) { commit(function () { delete monthRec(ui.month).categoryBudgets[el.dataset.cat]; }, spendLabel(el.dataset.cat) + ' reset to suggested.'); },
    'reset-cats': function () { commit(function () { monthRec(ui.month).categoryBudgets = {}; }, 'All categories reset to recommended.'); },
    'reset-spend-rules': function () {
      confirmDialog({ title: 'Restore default allocation rules?', message: 'Minimums return to £0 and the percentage split to its defaults.', confirmLabel: 'Restore defaults' })
        .then(function (ok) { if (ok) commit(function (s) { s.settings.spending = Store.defaultSettings().spending; }, 'Defaults restored.'); });
    },
    'apply-realloc': function () {
      const sug = E.suggestReallocation(lastCtx.plan);
      commit(function () {
        const b = monthRec(ui.month).categoryBudgets;
        lastCtx.plan.cats.forEach(function (c) { if (b[c.key] == null) b[c.key] = c.budgetPence; });
        sug.moves.forEach(function (mv) { b[mv.from] -= mv.amountPence; b[mv.to] += mv.amountPence; });
      }, 'Budgets adjusted between categories.');
    },
    'rebalance': function () {
      const plan = lastCtx.plan;
      const rb = E.rebalancePlan(S, plan);
      if (!rb.ok) {
        openModal({ title: 'Rebalance my budget', footer: html`${btn('Close', 'close-modal', { cls: 'btn--primary' })}`, body: alertBox(plan.daysLeft <= 0 ? 'info' : 'warning', plan.daysLeft <= 0 ? 'This month has ended' : 'Nothing left to rebalance', plan.daysLeft <= 0 ? 'Rebalancing works on the current or future months.' : 'You have spent ' + money(plan.totalSpentPence) + ' against ' + money(plan.poolPence + plan.carryTotalPence) + ' available, so there are no remaining funds to spread.') });
        return;
      }
      openModal({
        title: 'Rebalance my budget', form: 'rebalance', ctx: { proposed: rb.proposed, month: ui.month }, wide: true, submitLabel: 'Apply new budgets',
        body: html`<p class="muted">${money(rb.remainingPoolPence)} is left for the remaining ${plural(plan.daysLeft, 'day')} of ${E.monthLabel(ui.month)}. Essentials are funded first (minimums pro-rated for the days left), then the rest is shared ${plan.basis === 'history' ? 'in line with your recent spending' : 'by your percentage split'}. Debt payments, bills, savings and your buffer are not changed.</p>
          <div class="table-wrap"><table class="table table--compact table--stack"><thead><tr><th>Category</th><th class="num">Current budget</th><th class="num">Spent</th><th class="num">New budget</th><th class="num">Left to spend</th></tr></thead><tbody>
          ${plan.cats.map(function (c) { return html`<tr><td class="primary" data-label="Category">${c.label}</td><td class="num" data-label="Current">${money(c.budgetPence)}</td><td class="num" data-label="Spent">${money(c.spentPence)}</td><td class="num t-strong" data-label="New budget">${money(rb.proposed[c.key])}</td><td class="num" data-label="Left">${money(rb.remainingAlloc[c.key])}</td></tr>`; })}
          </tbody></table></div>`
      });
    },
    'carry-approve': function () {
      const cf = E.carryForwardCandidates(S, lastCtx.sim, ui.month, new Date());
      commit(function () { const r = monthRec(ui.month); r.carryIn = Object.assign({}, cf.byCat); r.carryDecision = 'approved'; }, money(cf.totalPence) + ' carried forward.');
    },
    'carry-decline': function () { commit(function () { monthRec(ui.month).carryDecision = 'declined'; }, 'Unspent money was not carried forward.'); },
    'carry-undo': function () { commit(function () { const r = monthRec(ui.month); r.carryIn = {}; r.carryDecision = null; }, 'Carry-forward removed.'); },

    // Spreadsheet
    'toggle-row': function (el) { const m = el.dataset.month; if (ui.expanded.has(m)) ui.expanded.delete(m); else ui.expanded.add(m); render(); const b = $('.row-toggle[data-month="' + m + '"]'); if (b) b.focus(); }
  };

  function setPaid(id, m, paid) {
    commit(function () {
      const st = monthRec(m).expenseStatus;
      if (paid) st[id] = { paid: true, date: todayISOFor(m) }; else delete st[id];
    }, paid ? 'Marked as paid.' : 'Marked as unpaid.');
  }

  const CHANGES = {
    'toggle-paid-box': function (el) { setPaid(el.dataset.id, el.dataset.month, el.checked); },
    'exp-filter': function (el) { ui.expFilter = el.value; render(); },
    'strategy': function (el) { commit(function (s) { s.settings.strategy = el.value; }, E.STRATEGIES[el.value].label + ' selected. Plan recalculated.'); },
    'approach': function (el) { commit(function (s) { s.settings.savingsApproach = el.value; }, E.SAVINGS_APPROACHES[el.value].label + ' approach selected.'); },
    'theme': function (el) { S.settings.theme = el.value; persist(); applyTheme(); },
    'assume-income': function (el) { commit(function (s) { s.settings.assumeIncomeRepeats = el.checked; }); },
    'show-cats': function (el) { commit(function (s) { s.settings.showSpendColumns = el.checked; }); },
    'horizon': function (el) {
      const v = parseInt(el.value, 10);
      if (!(v >= 12 && v <= 600)) { toast('The planning horizon must be between 12 and 600 months.', 'danger'); render(); return; }
      commit(function (s) { s.settings.planningHorizonMonths = v; }, 'Planning horizon set to ' + v + ' months.');
    },
    'cat-budget': function (el) {
      const key = el.dataset.cat;
      const p = el.type === 'range' ? parseInt(el.value, 10) : E.parseMoney(el.value);
      if (p === null || !(p >= 0)) { toast('Enter a valid amount for ' + spendLabel(key) + '.', 'danger'); render(); return; }
      commit(function () { monthRec(ui.month).categoryBudgets[key] = p; });
      const plan = lastCtx.plan;
      if (plan.unallocatedPence < 0) toast('Your category budgets now exceed safe-to-spend by ' + money(-plan.unallocatedPence) + '.', 'warning', 6000);
    }
  };

  // Live slider feedback (no re-render while dragging)
  function onSliderInput(el) {
    const key = el.dataset.cat;
    const v = parseInt(el.value, 10) || 0;
    el.style.setProperty('--fill', (v / (+el.max || 1) * 100).toFixed(1) + '%');
    el.setAttribute('aria-valuetext', money(v));
    const box = document.getElementById('cat-' + key);
    if (box) box.value = E.penceToDecimal(v);
    if (lastCtx) {
      const total = $$('.slider').reduce(function (a, s) { return a + (parseInt(s.value, 10) || 0); }, 0);
      const live = $('#unalloc-live');
      const diff = lastCtx.plan.poolPence - total;
      if (live) live.textContent = diff < 0 ? 'Over-allocated by ' + money(-diff) : 'Unallocated ' + money(diff);
    }
  }

  /* ======================================================================
   * 10. Backup, restore and CSV
   * ====================================================================== */
  function download(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadBackup() {
    S.settings.lastBackupAt = new Date().toISOString();
    persist();
    download('my-finance-backup-' + E.isoDate(new Date()) + '.json', Store.exportJSON(S), 'application/json');
    toast('Backup downloaded. Keep it somewhere safe — it contains your financial records.', 'success', 6000);
    render();
  }
  function exportCSV() {
    const sim = E.simulate(S, { today: new Date() });
    download('my-finance-spreadsheet-' + E.isoDate(new Date()) + '.csv', E.spreadsheetCSV(S, sim, { today: new Date() }), 'text/csv;charset=utf-8');
    toast('Spreadsheet exported (' + plural(sim.rows.length, 'month') + ').', 'success');
  }
  function onImportFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('That file is too large to be a backup.', 'danger'); return; }
    const reader = new FileReader();
    reader.onload = function () {
      let result;
      try { result = Store.parseImport(String(reader.result)); } catch (e) { toast('Could not restore: ' + e.message, 'danger', 9000); return; }
      const sm = result.summary;
      confirmDialog({
        title: 'Restore this backup?',
        message: 'This will replace all data currently in this browser.',
        extra: html`<dl class="calc" style="margin-top:12px"><dt>Backup created</dt><dd>${result.exportedAt ? E.formatDate(result.exportedAt.slice(0, 10)) : 'Unknown'}</dd><dt>Debts</dt><dd>${sm.debts}</dd><dt>Expenses</dt><dd>${sm.expenses}</dd><dt>Debt payments</dt><dd>${sm.payments}</dd><dt>Months with records</dt><dd>${sm.months}</dd></dl>
          ${result.warnings.length ? alertBox('warning', 'Some records will be skipped', html`<ul>${result.warnings.map(function (w) { return html`<li>${w}</li>`; })}</ul>`) : ''}`,
        choices: [{ key: 'ok', label: 'Replace and restore', danger: true }]
      }).then(function (c) {
        if (c !== 'ok') return;
        const theme = S.settings.theme;
        S = result.state;
        if (!S.settings.theme) S.settings.theme = theme;
        ui.expanded.clear();
        persist(); applyTheme(); applySidebar(); render();
        toast('Backup restored.', 'success');
      });
    };
    reader.onerror = function () { toast('The file could not be read.', 'danger'); };
    reader.readAsText(file);
  }

  /* ======================================================================
   * 11. Toasts
   * ====================================================================== */
  function toast(message, kind, ms) {
    kind = kind || 'success';
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.innerHTML = html`${icon(kind === 'success' ? 'ok' : kind === 'danger' ? 'alert' : 'info')}<div>${message}</div><button type="button" class="btn btn--ghost btn--icon btn--sm toast__close" aria-label="Dismiss">${icon('x')}</button>`.s;
    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 4000);
  }

  /* ======================================================================
   * 12. Boot
   * ====================================================================== */
  function routeFromHash() {
    const h = (location.hash || '').replace('#', '');
    return ROUTES.some(function (r) { return r.key === h; }) ? h : 'dashboard';
  }
  function bindEvents() {
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-action]');
      if (ui.pickerOpen && !e.target.closest('#month-picker')) { ui.pickerOpen = false; renderMonthPicker(); }
      if (!el) return;
      const fn = ACTIONS[el.dataset.action];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', function (e) {
      const el = e.target.closest('[data-change]');
      if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
    });
    document.addEventListener('input', function (e) {
      if (e.target.dataset && e.target.dataset.input === 'slider') onSliderInput(e.target);
    });
    document.addEventListener('submit', function (e) {
      const form = e.target;
      const name = form.dataset.form;
      if (!name || !FORMS[name]) return;
      e.preventDefault();
      const res = FORMS[name](new FormData(form), form);
      if (res && typeof res === 'object') { showErrors(form, res); return; }
      if (res !== 'handled' && form.closest('dialog')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (ui.pickerOpen) { ui.pickerOpen = false; renderMonthPicker(); const l = $('.month-picker__label'); if (l) l.focus(); }
        else if (ui.drawerOpen) { setDrawer(false); $('[data-action="open-drawer"]').focus(); }
      }
    });
    window.addEventListener('hashchange', function () {
      ui.route = routeFromHash();
      setDrawer(false);
      render();
      window.scrollTo(0, 0);
      const t = $('#page-title'); if (t) t.focus({ preventScroll: true });
    });
    let rt = null;
    let lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; if (!modal.open) render(); } }, 200);
    });
    window.addEventListener('storage', function (e) {
      if (e.key !== Store.STORAGE_KEY) return;
      const r = Store.load();
      S = r.state; applyTheme(); render();
      toast('Your data was updated in another tab.', 'success');
    });
    $('#import-file').addEventListener('change', function (e) { onImportFile(e.target.files[0]); });
  }

  function boot() {
    const r = Store.load();
    S = r.state;
    storageOk = r.storageOk;
    if (r.fresh) {
      const t = (function () { try { return localStorage.getItem('myFinancePlanner.theme'); } catch (e) { return null; } })();
      if (t === 'light') S.settings.theme = 'light';
    }
    ui.route = routeFromHash();
    applyTheme();
    applySidebar();
    bindEvents();
    render();
    r.warnings.forEach(function (w) { toast(w, 'warning', 10000); });
    // Monthly workflow: prompt for this month's income once per month.
    const cur = E.monthKey(new Date());
    if (hasAnyData() && E.confirmedIncome(S, cur) === null && S.settings.lastPromptedMonth !== cur) {
      setTimeout(function () { monthlyCheckin(cur); }, 250);
    }
  }

  window.MFP.App = { get state() { return S; }, render: function () { render(); } };
  boot();
})();
