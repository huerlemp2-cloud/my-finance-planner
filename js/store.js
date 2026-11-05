/*!
 * My Finance Planner — data model, validation and persistence.
 * localStorage only. Nothing is ever transmitted.
 */
(function (root, factory) {
  'use strict';
  var Engine = (typeof module === 'object' && module.exports) ? require('./engine.js') : root.MFP.Engine;
  var api = factory(Engine);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MFP = root.MFP || {};
    root.MFP.Store = api;
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const APP_ID = 'my-finance-planner';
  const STORAGE_KEY = 'myFinancePlanner.data';
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

  const EXPENSE_CATEGORIES = [
    { key: 'rent', label: 'Rent' }, { key: 'council-tax', label: 'Council Tax' }, { key: 'electricity', label: 'Electricity' },
    { key: 'gas', label: 'Gas' }, { key: 'water', label: 'Water' }, { key: 'internet', label: 'Internet' },
    { key: 'mobile', label: 'Mobile phone' }, { key: 'groceries', label: 'Groceries' }, { key: 'transport', label: 'Transport' },
    { key: 'subscriptions', label: 'Subscriptions' }, { key: 'healthcare', label: 'Healthcare' },
    { key: 'personal', label: 'Personal spending' }, { key: 'other', label: 'Other expenses' }
  ];
  const INCOME_TYPES = [
    { key: 'salary', label: 'Monthly salary' }, { key: 'benefits', label: 'Benefits' },
    { key: 'additional', label: 'Additional income' }, { key: 'other', label: 'Other income' }
  ];
  const keysOf = function (list) { return list.map(function (x) { return x.key; }); };

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    let s = '';
    for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-a' + s.slice(17, 20) + '-' + s.slice(20, 32);
  }

  function defaultSpending() {
    const mins = {}, pcts = {};
    E.SPEND_CATS.forEach(function (c) { mins[c.key] = 0; pcts[c.key] = c.defaultPct; });
    return { mins: mins, pcts: pcts };
  }
  function defaultSettings() {
    return {
      theme: 'dark', sidebarCollapsed: false,
      bufferPence: 0, minLivingAllowancePence: 0,
      strategy: 'avalanche', savingsApproach: 'balanced',
      assumeIncomeRepeats: true, planningHorizonMonths: 120,
      defaultOverrides: { extraDebtPence: null, savingsPence: null },
      spending: defaultSpending(),
      showSpendColumns: false, lastBackupAt: null, lastPromptedMonth: null
    };
  }
  function defaultState() {
    const now = new Date().toISOString();
    return {
      app: APP_ID, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now,
      settings: defaultSettings(),
      incomeSources: [], months: {}, expenses: [], debts: [], debtPayments: [],
      savings: { targetMonthlyPence: 0, emergencyGoalPence: 0, openingBalancePence: 0, baselineMonth: null, priority: 'emergency' }
    };
  }
  function emptyMonth() {
    return {
      income: [], dismissedSources: [], expenseStatus: {},
      overrides: { extraDebtPence: null, savingsPence: null }, assumedIncomePence: null,
      discretionarySpend: [], savingsDeposits: [], categoryBudgets: {}, carryIn: {}, carryDecision: null, forecast: null
    };
  }

  /* ---------------- field sanitisers ---------------- */
  function str(v, max, fallback) {
    if (typeof v !== 'string') return fallback === undefined ? '' : fallback;
    // strip control characters, keep normal whitespace
    return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max || 120);
  }
  function pence(v, opts) {
    opts = opts || {};
    if (typeof v !== 'number' || !Number.isSafeInteger(v)) return opts.nullable ? null : undefined;
    if (Math.abs(v) > E.MAX_PENCE) return undefined;
    if (v < 0 && !opts.allowNegative) return undefined;
    return v;
  }
  function nullablePence(v) {
    if (v === null || v === undefined) return null;
    const p = pence(v);
    return p === undefined ? null : p;
  }
  function month(v) { return E.isMonthKey(v) ? v : null; }
  function date(v) { return E.isISODate(v) ? v : null; }
  function oneOf(v, list, fallback) { return list.indexOf(v) !== -1 ? v : fallback; }
  function id(v) { return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null; }
  function intIn(v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi ? v : null; }

  function cleanList(list, fn, label, warnings) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    let dropped = 0;
    list.forEach(function (raw) {
      const r = raw && typeof raw === 'object' ? fn(raw) : null;
      if (!r || seen.has(r.id)) { dropped++; return; }
      seen.add(r.id);
      out.push(r);
    });
    if (dropped) warnings.push(dropped + ' invalid ' + label + ' record' + (dropped > 1 ? 's were' : ' was') + ' skipped.');
    return out;
  }

  function cleanIncome(r) {
    const i = id(r.id), a = pence(r.amountPence);
    if (!i || a === undefined) return null;
    return { id: i, description: str(r.description, 80) || 'Income', type: oneOf(r.type, keysOf(INCOME_TYPES), 'other'), amountPence: a, sourceId: id(r.sourceId) };
  }
  function cleanSource(r) {
    const i = id(r.id), a = pence(r.amountPence);
    if (!i || a === undefined) return null;
    return { id: i, description: str(r.description, 80) || 'Income', type: oneOf(r.type, keysOf(INCOME_TYPES), 'other'), amountPence: a, active: r.active !== false };
  }
  function cleanExpense(r) {
    const i = id(r.id), a = pence(r.amountPence), s = month(r.startMonth);
    if (!i || a === undefined || !s) return null;
    const recurring = r.recurring === true;
    let end = month(r.endMonth);
    if (!recurring) end = s;
    if (end && end < s) return null;
    return {
      id: i, description: str(r.description, 80) || 'Expense', amountPence: a,
      category: oneOf(r.category, keysOf(EXPENSE_CATEGORIES), 'other'), dueDay: intIn(r.dueDay, 1, 31),
      recurring: recurring, startMonth: s, endMonth: end, createdAt: str(r.createdAt, 40)
    };
  }
  function cleanDebt(r) {
    const i = id(r.id), b = pence(r.balancePence), mp = pence(r.minPaymentPence), s = month(r.startMonth);
    const apr = Number.isInteger(r.aprBps) && r.aprBps >= 0 && r.aprBps <= 100000 ? r.aprBps : (r.aprBps == null ? 0 : undefined);
    if (!i || b === undefined || mp === undefined || !s || apr === undefined) return null;
    const creditor = str(r.creditor, 80);
    if (!creditor) return null;
    return {
      id: i, creditor: creditor, description: str(r.description, 120), balancePence: b, aprBps: apr,
      minPaymentPence: mp, dueDay: intIn(r.dueDay, 1, 31), startMonth: s,
      interestFreeUntil: month(r.interestFreeUntil), contractEndDate: date(r.contractEndDate),
      priority: intIn(r.priority, 1, 99), notes: str(r.notes, 1000), archived: r.archived === true,
      createdAt: str(r.createdAt, 40)
    };
  }
  function cleanPayment(r, debtIds) {
    const i = id(r.id), a = pence(r.amountPence), d = date(r.date);
    if (!i || !a || !d || !debtIds.has(r.debtId)) return null;
    return { id: i, debtId: r.debtId, date: d, month: d.slice(0, 7), amountPence: a, kind: oneOf(r.kind, ['regular', 'extra'], 'regular'), note: str(r.note, 200) };
  }
  function cleanSpend(r) {
    const i = id(r.id), a = pence(r.amountPence), d = date(r.date);
    if (!i || !a || !d) return null;
    return { id: i, date: d, category: oneOf(r.category, E.SPEND_KEYS, 'misc'), description: str(r.description, 80), amountPence: a };
  }
  function cleanDeposit(r) {
    const i = id(r.id), a = pence(r.amountPence, { allowNegative: true }), d = date(r.date);
    if (!i || !a || !d) return null;
    return { id: i, date: d, amountPence: a, note: str(r.note, 200) };
  }
  function cleanCatMap(obj, allowNull) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    E.SPEND_KEYS.forEach(function (k) {
      const p = pence(obj[k]);
      if (p !== undefined) out[k] = p;
      else if (allowNull === 'zero') out[k] = 0;
    });
    return out;
  }
  function cleanOverrides(o) {
    o = o && typeof o === 'object' ? o : {};
    return { extraDebtPence: nullablePence(o.extraDebtPence), savingsPence: nullablePence(o.savingsPence) };
  }
  function cleanForecast(f) {
    if (!f || typeof f !== 'object') return null;
    const keys = ['incomePence', 'essentialPence', 'debtPaidPence', 'savingsPence', 'safeToSpendPence'];
    const out = {};
    for (let i = 0; i < keys.length; i++) { const p = pence(f[keys[i]]); if (p === undefined) return null; out[keys[i]] = p; }
    out.incomeBasis = str(f.incomeBasis, 30);
    out.savedAt = str(f.savedAt, 40);
    return out;
  }
  function cleanMonth(raw, warnings, expenseIds) {
    const m = emptyMonth();
    if (!raw || typeof raw !== 'object') return m;
    m.income = cleanList(raw.income, cleanIncome, 'income', warnings);
    m.dismissedSources = Array.isArray(raw.dismissedSources) ? raw.dismissedSources.filter(id).slice(0, 200) : [];
    if (raw.expenseStatus && typeof raw.expenseStatus === 'object') {
      Object.keys(raw.expenseStatus).forEach(function (k) {
        const s = raw.expenseStatus[k];
        if (expenseIds.has(k) && s && typeof s === 'object' && s.paid === true) m.expenseStatus[k] = { paid: true, date: date(s.date) };
      });
    }
    m.overrides = cleanOverrides(raw.overrides);
    m.assumedIncomePence = nullablePence(raw.assumedIncomePence);
    m.discretionarySpend = cleanList(raw.discretionarySpend, cleanSpend, 'spending', warnings);
    m.savingsDeposits = cleanList(raw.savingsDeposits, cleanDeposit, 'savings deposit', warnings);
    m.categoryBudgets = cleanCatMap(raw.categoryBudgets);
    m.carryIn = cleanCatMap(raw.carryIn);
    m.carryDecision = oneOf(raw.carryDecision, ['approved', 'declined'], null);
    m.forecast = cleanForecast(raw.forecast);
    return m;
  }

  /**
   * Validates and normalises a whole state object. Unknown fields are dropped,
   * malformed records skipped (and reported), and every amount is an integer of pence.
   */
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The data is not a valid My Finance Planner record.');
    raw = migrate(raw);
    const warnings = [];
    const s = defaultState();
    s.createdAt = str(raw.createdAt, 40) || s.createdAt;
    s.updatedAt = str(raw.updatedAt, 40) || s.updatedAt;

    const rs = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const st = s.settings;
    st.theme = oneOf(rs.theme, ['dark', 'light'], 'dark');
    st.sidebarCollapsed = rs.sidebarCollapsed === true;
    st.bufferPence = pence(rs.bufferPence) || 0;
    st.minLivingAllowancePence = pence(rs.minLivingAllowancePence) || 0;
    st.strategy = oneOf(rs.strategy, Object.keys(E.STRATEGIES), 'avalanche');
    st.savingsApproach = oneOf(rs.savingsApproach, Object.keys(E.SAVINGS_APPROACHES), 'balanced');
    st.assumeIncomeRepeats = rs.assumeIncomeRepeats !== false;
    st.planningHorizonMonths = intIn(rs.planningHorizonMonths, 12, 600) || 120;
    st.defaultOverrides = cleanOverrides(rs.defaultOverrides);
    const rsp = rs.spending && typeof rs.spending === 'object' ? rs.spending : {};
    st.spending = { mins: Object.assign(defaultSpending().mins, cleanCatMap(rsp.mins)), pcts: defaultSpending().pcts };
    if (rsp.pcts && typeof rsp.pcts === 'object') {
      const p = {};
      let ok = true;
      E.SPEND_KEYS.forEach(function (k) { const v = rsp.pcts[k]; if (Number.isInteger(v) && v >= 0 && v <= 100) p[k] = v; else ok = false; });
      if (ok) st.spending.pcts = p;
    }
    st.showSpendColumns = rs.showSpendColumns === true;
    st.lastBackupAt = str(rs.lastBackupAt, 40) || null;
    st.lastPromptedMonth = month(rs.lastPromptedMonth);

    s.incomeSources = cleanList(raw.incomeSources, cleanSource, 'income source', warnings);
    s.expenses = cleanList(raw.expenses, cleanExpense, 'expense', warnings);
    s.debts = cleanList(raw.debts, cleanDebt, 'debt', warnings);
    const debtIds = new Set(s.debts.map(function (d) { return d.id; }));
    s.debtPayments = cleanList(raw.debtPayments, function (r) { return cleanPayment(r, debtIds); }, 'debt payment', warnings);
    const expenseIds = new Set(s.expenses.map(function (e) { return e.id; }));
    if (raw.months && typeof raw.months === 'object') {
      Object.keys(raw.months).forEach(function (k) {
        if (!E.isMonthKey(k)) { warnings.push('An invalid month (' + k.slice(0, 20) + ') was skipped.'); return; }
        s.months[k] = cleanMonth(raw.months[k], warnings, expenseIds);
      });
    }
    const rv = raw.savings && typeof raw.savings === 'object' ? raw.savings : {};
    s.savings = {
      targetMonthlyPence: pence(rv.targetMonthlyPence) || 0,
      emergencyGoalPence: pence(rv.emergencyGoalPence) || 0,
      openingBalancePence: pence(rv.openingBalancePence) || 0,
      baselineMonth: month(rv.baselineMonth),
      priority: oneOf(rv.priority, ['emergency', 'steady'], 'emergency')
    };
    return { state: s, warnings: warnings };
  }

  function migrate(raw) {
    const v = raw.schemaVersion;
    if (!Number.isInteger(v)) throw new Error('This file has no schema version, so it cannot be verified as a My Finance Planner backup.');
    if (v > SCHEMA_VERSION) throw new Error('This backup was made by a newer version of the app (schema ' + v + '). Please update the app first.');
    // Future migrations go here: if (v === 1) { ...; raw.schemaVersion = 2; }
    return raw;
  }

  /* ---------------- persistence ---------------- */
  function storageAvailable() {
    try { const k = '__mfp_test__'; localStorage.setItem(k, k); localStorage.removeItem(k); return true; } catch (e) { return false; }
  }
  function load() {
    let text = null;
    try { text = localStorage.getItem(STORAGE_KEY); } catch (e) { return { state: defaultState(), warnings: ['Browser storage is unavailable. Your changes will not be saved. Check that cookies and site data are allowed.'], fresh: true, storageOk: false }; }
    if (!text) return { state: defaultState(), warnings: [], fresh: true, storageOk: true };
    try {
      const r = sanitizeState(JSON.parse(text));
      return { state: r.state, warnings: r.warnings, fresh: false, storageOk: true };
    } catch (e) {
      const backupKey = STORAGE_KEY + '.unreadable-' + Date.now();
      try { localStorage.setItem(backupKey, text); } catch (e2) { /* ignore */ }
      return { state: defaultState(), warnings: ['Your saved data could not be read (' + e.message + '). A copy was kept in browser storage under "' + backupKey + '". Restore a JSON backup if you have one.'], fresh: true, storageOk: true };
    }
  }
  function save(state) {
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Browser storage is full. Export a backup and remove old records.' : 'Could not save to browser storage (' + (e && e.message) + ').' };
    }
  }
  function exportJSON(state) {
    return JSON.stringify({ app: APP_ID, exportedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, data: state }, null, 2);
  }
  /** Parses and validates a backup file. Throws with a readable message on failure. */
  function parseImport(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.');
    if (text.length > MAX_IMPORT_BYTES) throw new Error('The file is too large to be a My Finance Planner backup.');
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('The file is not valid JSON.'); }
    if (!obj || typeof obj !== 'object') throw new Error('The file is not a My Finance Planner backup.');
    const data = obj.app === APP_ID && obj.data ? obj.data : obj;
    if (data.app !== APP_ID) throw new Error('The file is not a My Finance Planner backup.');
    if (!Number.isInteger(data.schemaVersion) && Number.isInteger(obj.schemaVersion)) data.schemaVersion = obj.schemaVersion;
    const r = sanitizeState(data);
    const s = r.state;
    return {
      state: s, warnings: r.warnings, exportedAt: str(obj.exportedAt, 40) || null,
      summary: {
        debts: s.debts.length, expenses: s.expenses.length, payments: s.debtPayments.length,
        months: Object.keys(s.months).length, incomeEntries: Object.keys(s.months).reduce(function (a, k) { return a + s.months[k].income.length; }, 0)
      }
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, APP_ID: APP_ID, STORAGE_KEY: STORAGE_KEY,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES, INCOME_TYPES: INCOME_TYPES,
    uid: uid, defaultState: defaultState, defaultSettings: defaultSettings, emptyMonth: emptyMonth,
    sanitizeState: sanitizeState, storageAvailable: storageAvailable, load: load, save: save,
    exportJSON: exportJSON, parseImport: parseImport
  };
});
