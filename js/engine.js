/*!
 * My Finance Planner — financial calculation engine
 * Pure, deterministic functions. No DOM access. Works in the browser (window.MFP.Engine)
 * and in Node.js (module.exports) so the same code is unit-tested.
 *
 * All money values are integers in pence. All months are "YYYY-MM" keys.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MFP = root.MFP || {};
    root.MFP.Engine = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */
  const MAX_PENCE = 10000000000; // £100,000,000 — sanity ceiling for any single amount
  const MAX_APR_BPS = 100000; // 1,000% APR
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const STRATEGIES = {
    minimum: { key: 'minimum', label: 'Minimum payments', description: 'Pay the contractual minimum on every debt. Any surplus stays in savings or spending.' },
    snowball: { key: 'snowball', label: 'Debt snowball', description: 'Pay minimums on everything, then put extra money towards the smallest balance first.' },
    avalanche: { key: 'avalanche', label: 'Debt avalanche', description: 'Pay minimums on everything, then put extra money towards the highest interest rate first.' },
    priority: { key: 'priority', label: 'Your priority order', description: 'Pay minimums on everything, then follow the priority you set on each debt (1 = first).' }
  };

  // How the surplus (money left after essentials, minimums, buffer and the living reserve)
  // is split. savingsShare is applied first (capped by the monthly target, if one is set);
  // debtShare is then applied to what remains. The rest stays as extra spending headroom.
  const SAVINGS_APPROACHES = {
    conservative: { key: 'conservative', label: 'Conservative', savingsShare: 0.6, debtShare: 0.6, description: 'Builds savings first. 60% of your surplus is offered to savings, then 60% of the rest to extra debt payments.' },
    balanced: { key: 'balanced', label: 'Balanced', savingsShare: 0.35, debtShare: 0.75, description: '35% of your surplus to savings, then 75% of the rest to extra debt payments.' },
    'debt-focused': { key: 'debt-focused', label: 'Debt-focused', savingsShare: 0.1, debtShare: 0.9, description: 'Clears debt fastest. 10% of your surplus to savings, then 90% of the rest to extra debt payments.' }
  };

  // Discretionary spending categories (section 18). `coveredBy` lists fixed-expense
  // categories that already pay for this category, to avoid double counting.
  const SPEND_CATS = [
    { key: 'groceries', label: 'Groceries & food', essential: true, defaultPct: 35, coveredBy: ['groceries'] },
    { key: 'transport', label: 'Transport', essential: true, defaultPct: 15, coveredBy: ['transport'] },
    { key: 'health', label: 'Health & wellbeing', essential: true, defaultPct: 5, coveredBy: ['healthcare'] },
    { key: 'personal', label: 'Personal care', essential: false, defaultPct: 8, coveredBy: [] },
    { key: 'leisure', label: 'Leisure & entertainment', essential: false, defaultPct: 15, coveredBy: [] },
    { key: 'shopping', label: 'Shopping', essential: false, defaultPct: 10, coveredBy: [] },
    { key: 'misc', label: 'Miscellaneous', essential: false, defaultPct: 12, coveredBy: [] }
  ];
  const SPEND_KEYS = SPEND_CATS.map(function (c) { return c.key; });
  const ESSENTIAL_KEYS = SPEND_CATS.filter(function (c) { return c.essential; }).map(function (c) { return c.key; });
  const OPTIONAL_KEYS = SPEND_CATS.filter(function (c) { return !c.essential; }).map(function (c) { return c.key; });
  // When a category overspends, money is suggested from these first.
  const DONOR_ORDER = ['leisure', 'shopping', 'misc', 'personal', 'health', 'transport', 'groceries'];

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */
  function pad(n) { return String(n).padStart(2, '0'); }
  function sum(arr, fn) { let t = 0; for (let i = 0; i < arr.length; i++) t += fn ? fn(arr[i]) : arr[i]; return t; }
  function clampInt(v, lo, hi) { v = Math.round(Number(v)); if (!Number.isFinite(v)) v = lo; return Math.min(hi, Math.max(lo, v)); }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"'`]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
    });
  }

  /* ------------------------------------------------------------------ *
   * Dates and months
   * ------------------------------------------------------------------ */
  function isMonthKey(k) { return typeof k === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(k); }
  function isISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(y, m, 0).getDate();
  }
  function monthKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1); }
  function isoDate(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function monthOfDate(iso) { return iso.slice(0, 7); }
  function toIndex(k) { return (+k.slice(0, 4)) * 12 + (+k.slice(5, 7)) - 1; }
  function fromIndex(i) { return Math.floor(i / 12) + '-' + pad((i % 12) + 1); }
  function addMonths(k, n) { return fromIndex(toIndex(k) + n); }
  function monthsBetween(a, b) { return toIndex(b) - toIndex(a); }
  function daysInMonth(k) { return new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate(); }
  function monthLabel(k, short) {
    if (!isMonthKey(k)) return '';
    return (short ? MONTHS_SHORT : MONTHS)[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  }
  /** ISO "YYYY-MM-DD" → British "DD/MM/YYYY". */
  function formatDate(iso) {
    if (!iso || typeof iso !== 'string') return '';
    const p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  /** Due day within a month, clamped to the month's length (e.g. 31 → 30 in November). */
  function dueDateFor(month, dueDay) {
    if (!dueDay) return null;
    return month + '-' + pad(Math.min(dueDay, daysInMonth(month)));
  }
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ------------------------------------------------------------------ *
   * Money
   * ------------------------------------------------------------------ */
  /**
   * Parses a user-entered amount ("1,234.56", "£12", "12.5") into integer pence.
   * Returns null for anything that is not a valid amount with at most 2 decimals.
   */
  function parseMoney(input, opts) {
    const allowNegative = !!(opts && opts.allowNegative);
    if (input === null || input === undefined) return null;
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) return null;
      input = input.toFixed(2);
    }
    let s = String(input).trim().replace(/\s+/g, '');
    let neg = false;
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
    s = s.replace(/^£/, '');
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
    // Accept thousands separators only in valid positions.
    if (s.indexOf(',') !== -1) {
      if (!/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) return null;
      s = s.replace(/,/g, '');
    }
    if (s === '' || !/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
    const parts = s.split('.');
    const whole = parts[0] || '0';
    if (whole.replace(/^0+/, '').length > 11) return null;
    const frac = ((parts[1] || '') + '00').slice(0, 2);
    const pence = Number(whole) * 100 + Number(frac);
    if (!Number.isSafeInteger(pence) || pence > MAX_PENCE) return null;
    if (neg && pence !== 0 && !allowNegative) return null;
    return neg && pence !== 0 ? -pence : pence;
  }

  /** Parses an annual percentage ("19.99", "19.99%") into basis points (1999). */
  function parsePercentBps(input) {
    if (input === null || input === undefined) return null;
    const s = String(input).trim().replace(/%$/, '').trim();
    if (s === '' || !/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
    const parts = s.split('.');
    const bps = Number(parts[0] || '0') * 100 + Number(((parts[1] || '') + '00').slice(0, 2));
    if (!Number.isSafeInteger(bps) || bps > MAX_APR_BPS) return null;
    return bps;
  }

  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  function formatGBP(pence, opts) {
    if (typeof pence !== 'number' || !Number.isFinite(pence)) return '—';
    const whole = opts && opts.whole;
    const s = (whole ? gbp0 : gbp).format(Math.abs(pence) / 100);
    if (pence < 0) return '−' + s;
    if (opts && opts.sign && pence > 0) return '+' + s;
    return s;
  }
  /** Pence → plain decimal string for form inputs and CSV ("1234.50"). */
  function penceToDecimal(pence) {
    const neg = pence < 0; const a = Math.abs(Math.round(pence));
    return (neg ? '-' : '') + Math.floor(a / 100) + '.' + pad(a % 100);
  }
  function formatBps(bps) { return (bps / 100).toFixed(2) + '%'; }

  /**
   * Interest convention (documented in README): simple monthly rate = APR ÷ 12,
   * charged on the balance at the start of the month, rounded to the nearest penny.
   */
  function monthlyInterest(balancePence, aprBps) {
    if (balancePence <= 0 || !aprBps || aprBps <= 0) return 0;
    return Math.round(balancePence * aprBps / 120000);
  }

  /* ------------------------------------------------------------------ *
   * Records helpers
   * ------------------------------------------------------------------ */
  function expensesForMonth(state, m) {
    return state.expenses.filter(function (e) {
      return e.startMonth <= m && (!e.endMonth || e.endMonth >= m);
    });
  }
  function monthHasData(rec) {
    if (!rec) return false;
    return rec.income.length > 0 || rec.discretionarySpend.length > 0 || rec.savingsDeposits.length > 0 ||
      Object.keys(rec.expenseStatus).length > 0;
  }
  function confirmedIncome(state, m) {
    const rec = state.months[m];
    if (!rec || !rec.income.length) return null;
    return sum(rec.income, function (i) { return i.amountPence; });
  }
  function indexPayments(state) {
    const idx = {};
    state.debtPayments.forEach(function (p) {
      if (!idx[p.debtId]) idx[p.debtId] = {};
      idx[p.debtId][p.month] = (idx[p.debtId][p.month] || 0) + p.amountPence;
    });
    return idx;
  }
  function debtName(d) { return d.description ? d.creditor + ' — ' + d.description : d.creditor; }

  function fixedCoverage(expenses) {
    const cov = {};
    SPEND_CATS.forEach(function (c) { cov[c.key] = 0; });
    expenses.forEach(function (e) {
      SPEND_CATS.forEach(function (c) { if (c.coveredBy.indexOf(e.category) !== -1) cov[c.key] += e.amountPence; });
    });
    return cov;
  }
  function effectiveMins(mins, coverage) {
    const out = {};
    SPEND_KEYS.forEach(function (k) { out[k] = Math.max(0, ((mins && mins[k]) || 0) - ((coverage && coverage[k]) || 0)); });
    return out;
  }
  /** Money protected before any extra debt payments or savings are recommended. */
  function livingReserve(settings, coverage) {
    const effMin = effectiveMins(settings.spending.mins, coverage);
    const catMins = sum(SPEND_KEYS, function (k) { return effMin[k]; });
    return Math.max(settings.minLivingAllowancePence || 0, catMins);
  }

  /* ------------------------------------------------------------------ *
   * Recommendations
   * ------------------------------------------------------------------ */
  function recommendSplit(surplus, ctx) {
    surplus = Math.max(0, surplus);
    const approach = SAVINGS_APPROACHES[ctx.approach] || SAVINGS_APPROACHES.balanced;
    let share = approach.savingsShare;
    if (ctx.priority === 'emergency' && ctx.emergencyReached) share = Math.min(share, SAVINGS_APPROACHES['debt-focused'].savingsShare);
    let savings = Math.floor(surplus * share);
    if (ctx.targetPence > 0) savings = Math.min(savings, ctx.targetPence);
    // With nothing left to pay off, the whole share logic for debt does not apply.
    const remaining = surplus - savings;
    let extra = ctx.debtCapacity > 0 ? Math.floor(remaining * approach.debtShare) : 0;
    extra = Math.min(extra, Math.max(0, ctx.debtCapacity));
    return { surplusPence: surplus, savingsPence: savings, extraDebtPence: extra, headroomPence: surplus - savings - extra };
  }

  function orderDebts(items, strategy) {
    const byName = function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; };
    const list = items.slice();
    if (strategy === 'snowball') {
      list.sort(function (a, b) { return (a.opening - b.opening) || (b.aprEff - a.aprEff) || byName(a, b); });
    } else if (strategy === 'priority') {
      list.sort(function (a, b) {
        const pa = a.priority || 9999, pb = b.priority || 9999;
        return (pa - pb) || (b.aprEff - a.aprEff) || (a.opening - b.opening) || byName(a, b);
      });
    } else {
      list.sort(function (a, b) { return (b.aprEff - a.aprEff) || (a.opening - b.opening) || byName(a, b); });
    }
    return list;
  }

  function computeUnfunded(income, expenses, items, savings, buffer) {
    let left = income;
    const out = [];
    function take(label, kind, amount, dueDay) {
      if (amount <= 0) return;
      const funded = Math.min(Math.max(left, 0), amount);
      left -= amount;
      if (funded < amount) out.push({ label: label, kind: kind, amountPence: amount, fundedPence: funded, shortByPence: amount - funded, dueDay: dueDay || null });
    }
    const byDue = function (a, b) { return (a.dueDay || 99) - (b.dueDay || 99); };
    expenses.slice().sort(byDue).forEach(function (e) { take(e.description, 'expense', e.amountPence, e.dueDay); });
    items.slice().sort(function (a, b) { return (a.dueDay || 99) - (b.dueDay || 99); }).forEach(function (it) {
      take(it.name + ' (minimum payment)', 'debt-minimum', it.min, it.dueDay);
    });
    const extra = sum(items, function (it) { return Math.max(0, it.paid - it.min); });
    take('Extra debt payments', 'debt-extra', extra);
    take('Savings contribution', 'savings', savings);
    take('Financial buffer', 'buffer', buffer);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Core month-by-month simulation
   * ------------------------------------------------------------------ */
  /**
   * Builds the full timeline: actual history (past months), the current month and a
   * forecast until every debt is repaid (or the planning horizon is reached).
   *
   * Rules:
   *  - Past months use ONLY recorded payments and deposits (projections never become actuals).
   *  - The current month uses max(recorded, planned) per debt, so a payment already made
   *    is never counted twice and the outstanding part of the plan remains visible.
   *  - The current month's income is confirmed income only. Future months use confirmed
   *    income if entered, otherwise a clearly labelled assumption.
   *  - Contractual minimums are never reduced. If income cannot cover them the month is
   *    flagged as a shortfall and the unfunded obligations are listed.
   */
  function simulate(state, opts) {
    opts = opts || {};
    const today = opts.today || new Date();
    const current = monthKey(today);
    const st = state.settings;
    const sv = state.savings;
    const strategy = opts.strategy || st.strategy || 'avalanche';
    const useOverrides = !opts.ignoreOverrides;
    const horizon = clampInt(opts.horizonMonths != null ? opts.horizonMonths : st.planningHorizonMonths, 12, 600);
    const debts = state.debts.filter(function (d) { return !d.archived; });
    const payIdx = indexPayments(state);
    const months = state.months;

    let start = current;
    debts.forEach(function (d) { if (d.startMonth < start) start = d.startMonth; });
    Object.keys(months).forEach(function (k) { if (k < start && monthHasData(months[k])) start = k; });
    if (sv.baselineMonth && sv.baselineMonth < start) start = sv.baselineMonth;
    if (opts.includeMonth && opts.includeMonth < start) start = opts.includeMonth;
    const floor = addMonths(current, -120);
    if (start < floor) start = floor;

    let last = addMonths(current, horizon - 1);
    let minEnd = addMonths(current, (opts.minForecastMonths != null ? opts.minForecastMonths : 12) - 1);
    if (opts.includeMonth && opts.includeMonth > minEnd) minEnd = opts.includeMonth;
    if (minEnd > last) last = minEnd;

    const incomeMonths = Object.keys(months).filter(function (k) { return months[k].income.length > 0; }).sort();
    function latestConfirmedUpTo(m) {
      let found = null;
      for (let i = 0; i < incomeMonths.length; i++) { if (incomeMonths[i] <= m) found = incomeMonths[i]; else break; }
      return found;
    }

    const bal = {};
    const payoff = {};
    const interestFuture = {};
    const savBaseline = sv.baselineMonth || start;
    let savBal = null;
    const rows = [];
    let debtFreeMonth = null;
    let horizonReached = false;
    let totalInterestFromCurrent = 0;

    for (let m = start; ; m = addMonths(m, 1)) {
      if (m > last) {
        horizonReached = debts.some(function (d) { return bal[d.id] === undefined || bal[d.id] > 0; });
        break;
      }
      const phase = m < current ? 'actual' : m === current ? 'current' : 'forecast';
      const mrec = months[m] || null;

      // ---- Income
      let incomePence = 0, incomeBasis = 'none', incomeFrom = null;
      if (mrec && mrec.income.length) {
        incomePence = sum(mrec.income, function (i) { return i.amountPence; });
        incomeBasis = 'confirmed';
      } else if (phase === 'forecast') {
        if (mrec && mrec.assumedIncomePence != null) {
          incomePence = mrec.assumedIncomePence; incomeBasis = 'assumed-manual';
        } else if (st.assumeIncomeRepeats) {
          const lk = latestConfirmedUpTo(m);
          if (lk) { incomePence = confirmedIncome(state, lk); incomeBasis = 'assumed-latest'; incomeFrom = lk; }
        }
      }

      // ---- Fixed expenses (each recurring expense counted once per month)
      const exps = expensesForMonth(state, m);
      const essentialPence = sum(exps, function (e) { return e.amountPence; });
      const coverage = fixedCoverage(exps);
      const reserve = livingReserve(st, coverage);

      // ---- Debts: opening balance, interest, minimum due
      const items = [];
      debts.forEach(function (d) {
        if (d.startMonth > m) return;
        if (bal[d.id] === undefined) bal[d.id] = d.balancePence;
        const opening = bal[d.id];
        const actual = (payIdx[d.id] && payIdx[d.id][m]) || 0;
        if (opening <= 0 && actual === 0) {
          if (payoff[d.id] === undefined) payoff[d.id] = m === d.startMonth ? m : addMonths(m, -1);
          return;
        }
        const interestFree = !!(d.interestFreeUntil && m <= d.interestFreeUntil);
        const interest = interestFree ? 0 : monthlyInterest(opening, d.aprBps);
        const due = opening + interest;
        items.push({
          id: d.id, name: debtName(d), creditor: d.creditor, priority: d.priority, dueDay: d.dueDay,
          opening: opening, interest: interest, due: due, min: Math.min(d.minPaymentPence, due),
          actual: actual, aprEff: interestFree ? 0 : d.aprBps, aprBps: d.aprBps, interestFree: interestFree,
          minPaymentPence: d.minPaymentPence, extra: 0
        });
      });
      const minDebtPence = sum(items, function (it) { return it.min; });
      const capacity = sum(items, function (it) { return it.due - it.min; });
      const bufferPence = st.bufferPence || 0;

      // ---- Recommendation from genuine surplus only
      const surplus = Math.max(0, incomePence - essentialPence - minDebtPence - bufferPence - reserve);
      const savNow = savBal !== null ? savBal : sv.openingBalancePence;
      const emergencyReached = sv.emergencyGoalPence > 0 && savNow >= sv.emergencyGoalPence;
      const rec = recommendSplit(surplus, {
        approach: st.savingsApproach, targetPence: sv.targetMonthlyPence, priority: sv.priority,
        emergencyReached: emergencyReached, debtCapacity: strategy === 'minimum' ? 0 : capacity
      });

      // ---- Overrides (never altered by the engine; only capped where physically impossible)
      let extraOverride = null, savingsOverride = null, extraSource = null, savingsSource = null;
      if (useOverrides && phase !== 'actual') {
        const mo = (mrec && mrec.overrides) || {};
        const def = st.defaultOverrides || {};
        if (mo.extraDebtPence != null) { extraOverride = mo.extraDebtPence; extraSource = 'month'; }
        else if (def.extraDebtPence != null) { extraOverride = def.extraDebtPence; extraSource = 'default'; }
        if (mo.savingsPence != null) { savingsOverride = mo.savingsPence; savingsSource = 'month'; }
        else if (def.savingsPence != null) { savingsOverride = def.savingsPence; savingsSource = 'default'; }
      }
      const extraPlanned = extraOverride != null ? extraOverride : rec.extraDebtPence;
      let pool = extraPlanned;
      orderDebts(items, strategy === 'minimum' ? 'avalanche' : strategy).forEach(function (it) {
        const give = Math.min(it.due - it.min, pool);
        it.extra = give; pool -= give;
      });
      const extraCapped = pool > 0;
      const extraAppliedPence = extraPlanned - pool;

      // ---- Payments
      items.forEach(function (it) {
        it.planned = it.min + it.extra;
        it.paid = phase === 'actual' ? it.actual : Math.max(it.actual, it.planned);
        it.closing = Math.max(0, it.due - it.paid);
        it.overpaid = Math.max(0, it.paid - it.due);
        it.missedMin = phase === 'actual' && it.actual < it.min;
        bal[it.id] = it.closing;
        if (m >= current) interestFuture[it.id] = (interestFuture[it.id] || 0) + it.interest;
        if (it.closing === 0 && payoff[it.id] === undefined) payoff[it.id] = m;
      });
      const debtPaidPence = sum(items, function (it) { return it.paid; });
      const interestPence = sum(items, function (it) { return it.interest; });
      if (m >= current) totalInterestFromCurrent += interestPence;

      // ---- Savings
      if (savBal === null && m >= savBaseline) savBal = sv.openingBalancePence;
      const deps = mrec ? mrec.savingsDeposits : [];
      const depositsPence = sum(deps, function (d) { return d.amountPence > 0 ? d.amountPence : 0; });
      const withdrawalsPence = sum(deps, function (d) { return d.amountPence < 0 ? d.amountPence : 0; });
      const savingsPlanned = savingsOverride != null ? savingsOverride : rec.savingsPence;
      const savingsPence = phase === 'actual' ? depositsPence : Math.max(depositsPence, savingsPlanned);
      if (savBal !== null) savBal = Math.max(0, savBal + savingsPence + withdrawalsPence);

      // ---- Safe to spend
      const raw = incomePence - essentialPence - debtPaidPence - savingsPence - bufferPence;
      const safeToSpendPence = Math.max(0, raw);
      const shortfallPence = Math.max(0, -raw);
      let status;
      if (incomePence < essentialPence + minDebtPence) status = 'shortfall';
      else if (raw < 0) status = 'over';
      else if (safeToSpendPence < reserve) status = 'tight';
      else status = 'ok';
      const unfunded = shortfallPence > 0 ? computeUnfunded(incomePence, exps, items, savingsPence, bufferPence) : [];

      const closingDebtPence = sum(Object.keys(bal), function (k) { return bal[k]; });
      const pending = debts.some(function (d) { return d.startMonth > m; });

      rows.push({
        month: m, phase: phase,
        incomePence: incomePence, incomeBasis: incomeBasis, incomeFrom: incomeFrom,
        essentialPence: essentialPence, expenseCount: exps.length,
        minDebtPence: minDebtPence, extraPlannedPence: extraPlanned, extraAppliedPence: extraAppliedPence, extraCapped: extraCapped,
        extraPaidPence: Math.max(0, debtPaidPence - minDebtPence),
        debtPaidPence: debtPaidPence, interestPence: interestPence,
        savingsPence: savingsPence, savingsPlannedPence: savingsPlanned, savingsDepositedPence: depositsPence, savingsWithdrawnPence: withdrawalsPence,
        bufferPence: bufferPence, reservePence: reserve,
        safeToSpendPence: safeToSpendPence, shortfallPence: shortfallPence, status: status, unfunded: unfunded,
        closingDebtPence: closingDebtPence, openingDebtPence: sum(items, function (it) { return it.opening; }),
        savingsBalancePence: savBal,
        recommended: rec,
        overrides: { extraDebtPence: extraOverride, savingsPence: savingsOverride, extraSource: extraSource, savingsSource: savingsSource },
        debts: items.map(function (it) {
          return {
            id: it.id, name: it.name, creditor: it.creditor, dueDay: it.dueDay, aprBps: it.aprBps, interestFree: it.interestFree,
            openingPence: it.opening, interestPence: it.interest, minPence: it.min, extraPence: it.extra, plannedPence: it.planned,
            actualPence: it.actual, paidPence: it.paid, closingPence: it.closing, overpaidPence: it.overpaid, missedMin: it.missedMin
          };
        })
      });

      const outstanding = closingDebtPence > 0 || pending;
      if (debts.length) debtFreeMonth = outstanding ? null : (debtFreeMonth || m);
      if (m >= minEnd && m >= current && !outstanding) break;
      if (rows.length > 1200) { horizonReached = outstanding; break; }
    }

    // Debts whose minimum payment does not cover monthly interest (never amortise).
    const curRow = rows.find(function (r) { return r.month === current; });
    const nonAmortising = [];
    if (curRow) {
      curRow.debts.forEach(function (d) {
        if (d.interestFree || d.openingPence <= 0) return;
        const debt = state.debts.find(function (x) { return x.id === d.id; });
        if (debt && (debt.minPaymentPence === 0 || (d.aprBps > 0 && debt.minPaymentPence <= d.interestPence))) {
          nonAmortising.push({ id: d.id, name: d.name, interestPence: d.interestPence, minPence: debt.minPaymentPence });
        }
      });
    }

    return {
      rows: rows, current: current, start: start, strategy: strategy,
      debtFreeMonth: debts.length ? debtFreeMonth : null, hasDebts: debts.length > 0,
      horizonReached: horizonReached, horizonMonths: horizon,
      totalInterestFromCurrentPence: totalInterestFromCurrent,
      payoff: payoff, interestFutureByDebt: interestFuture, nonAmortising: nonAmortising
    };
  }

  function rowFor(sim, m) {
    for (let i = 0; i < sim.rows.length; i++) if (sim.rows[i].month === m) return sim.rows[i];
    return null;
  }

  /** Runs every strategy with recommended (not overridden) amounts for a fair comparison. */
  function compareStrategies(state, opts) {
    opts = opts || {};
    const keys = ['minimum', 'snowball', 'avalanche'];
    if (state.debts.some(function (d) { return !d.archived && d.priority; })) keys.push('priority');
    return keys.map(function (k) {
      const sim = simulate(state, { today: opts.today, strategy: k, ignoreOverrides: true, horizonMonths: opts.horizonMonths });
      const cur = rowFor(sim, sim.current);
      return {
        strategy: k, label: STRATEGIES[k].label,
        debtFreeMonth: sim.debtFreeMonth, horizonReached: sim.horizonReached,
        monthsToDebtFree: sim.debtFreeMonth ? monthsBetween(sim.current, sim.debtFreeMonth) + 1 : null,
        totalInterestPence: sim.totalInterestFromCurrentPence,
        monthlyDebtPaymentPence: cur ? cur.debtPaidPence : 0,
        safeToSpendPence: cur ? cur.safeToSpendPence : 0
      };
    });
  }

  /** Per-debt summary as at the start of the given month. */
  function debtSummaries(state, sim, month) {
    const row = rowFor(sim, month);
    const payIdx = indexPayments(state);
    return state.debts.map(function (d) {
      const it = row ? row.debts.find(function (x) { return x.id === d.id; }) : null;
      let opening = it ? it.openingPence : (month < d.startMonth ? d.balancePence : 0);
      if (d.archived) opening = null;
      const totalPaid = sum(Object.keys(payIdx[d.id] || {}).filter(function (k) { return k >= d.startMonth; }), function (k) { return payIdx[d.id][k]; });
      const progress = d.balancePence > 0 && opening != null ? Math.min(1, Math.max(0, (d.balancePence - opening) / d.balancePence)) : (opening === 0 ? 1 : 0);
      return {
        debt: d, name: debtName(d), openingPence: opening, row: it,
        payoffMonth: sim.payoff[d.id] || null, futureInterestPence: sim.interestFutureByDebt[d.id] || 0,
        totalPaidPence: totalPaid, progress: progress,
        nonAmortising: sim.nonAmortising.some(function (n) { return n.id === d.id; }),
        pastContractEnd: !!(d.contractEndDate && sim.payoff[d.id] && sim.payoff[d.id] > monthOfDate(d.contractEndDate))
      };
    });
  }

  /* ------------------------------------------------------------------ *
   * Obligations and overdue items
   * ------------------------------------------------------------------ */
  function monthObligations(state, sim, m, today) {
    today = today || new Date();
    const current = monthKey(today);
    const day = today.getDate();
    const rec = state.months[m];
    const out = [];
    expensesForMonth(state, m).forEach(function (e) {
      const paid = !!(rec && rec.expenseStatus[e.id] && rec.expenseStatus[e.id].paid);
      const overdue = !paid && (m < current || (m === current && e.dueDay && day > Math.min(e.dueDay, daysInMonth(m))));
      out.push({ kind: 'expense', id: e.id, label: e.description, category: e.category, amountPence: e.amountPence, paidPence: paid ? e.amountPence : 0, dueDay: e.dueDay, dueDate: dueDateFor(m, e.dueDay), paid: paid, overdue: overdue, recurring: e.recurring });
    });
    const row = rowFor(sim, m);
    if (row) {
      row.debts.forEach(function (d) {
        const paid = d.actualPence >= d.minPence;
        const overdue = !paid && (m < current || (m === current && d.dueDay && day > Math.min(d.dueDay, daysInMonth(m))));
        out.push({ kind: 'debt', id: d.id, label: d.name, amountPence: d.minPence, plannedPence: d.plannedPence, paidPence: d.actualPence, dueDay: d.dueDay, dueDate: dueDateFor(m, d.dueDay), paid: paid, overdue: overdue });
      });
    }
    out.sort(function (a, b) { return (a.paid - b.paid) || ((a.dueDay || 99) - (b.dueDay || 99)); });
    return out;
  }

  /** Overdue items: missed debt minimums since each debt's start month (max 12 months back)
   * and unpaid expenses in the last 3 months the user actively used. */
  function overdueItems(state, sim, today) {
    today = today || new Date();
    const current = monthKey(today);
    const out = [];
    sim.rows.forEach(function (row) {
      if (row.month > current || row.month < addMonths(current, -12)) return;
      const used = row.month === current || monthHasData(state.months[row.month]);
      monthObligations(state, sim, row.month, today).forEach(function (o) {
        if (!o.overdue) return;
        if (o.kind === 'expense' && (!used || row.month < addMonths(current, -3))) return;
        out.push(Object.assign({ month: row.month, shortByPence: o.amountPence - o.paidPence }, o));
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Discretionary spending allocation (section 18)
   * ------------------------------------------------------------------ */
  function largestRemainder(total, weights, keys) {
    const out = {};
    keys.forEach(function (k) { out[k] = 0; });
    if (total <= 0 || !keys.length) return out;
    let w = keys.map(function (k) { return Math.max(0, Number(weights[k]) || 0); });
    let wsum = sum(w);
    if (wsum <= 0) { w = keys.map(function () { return 1; }); wsum = keys.length; }
    let used = 0;
    const rems = [];
    keys.forEach(function (k, i) {
      const exact = total * w[i] / wsum;
      const f = Math.floor(exact);
      out[k] = f; used += f; rems.push({ k: k, r: exact - f, i: i });
    });
    rems.sort(function (a, b) { return (b.r - a.r) || (a.i - b.i); });
    for (let left = total - used, i = 0; left > 0; left--, i++) out[rems[i % rems.length].k]++;
    return out;
  }

  function fillNeeds(keys, need, budget) {
    const total = sum(keys, function (k) { return need[k]; });
    if (total <= 0 || budget <= 0) { const z = {}; keys.forEach(function (k) { z[k] = 0; }); return { give: z, used: 0 }; }
    if (total <= budget) { const g = {}; keys.forEach(function (k) { g[k] = need[k]; }); return { give: g, used: total }; }
    return { give: largestRemainder(budget, need, keys), used: budget };
  }

  /**
   * Allocation order:
   *  1. Minimum essential amounts (groceries, transport, health), then other minimums.
   *  2. Top every category up towards its weighted target — essentials before optional.
   *     Weights come from reliable history (≥2 recent months) or the adjustable percentages.
   *  3. Anything left is shared by the same weights, so the full allowance is allocated.
   */
  function allocateSpending(pool, cfg) {
    pool = Math.max(0, pool);
    const coverage = cfg.coverage || {};
    const effMin = effectiveMins(cfg.mins, coverage);
    const alloc = {};
    SPEND_KEYS.forEach(function (k) { alloc[k] = 0; });
    let remaining = pool;
    let minShortfall = 0;
    ESSENTIAL_KEYS.concat(OPTIONAL_KEYS).forEach(function (k) {
      const g = Math.min(effMin[k], remaining);
      alloc[k] = g; remaining -= g; minShortfall += effMin[k] - g;
    });
    const weights = cfg.weights || {};
    const wsum = sum(SPEND_KEYS, function (k) { return Math.max(0, Number(weights[k]) || 0); });
    const covTotal = cfg.subtractCoverage ? sum(SPEND_KEYS, function (k) { return coverage[k] || 0; }) : 0;
    const base = pool + covTotal;
    const target = {}, need = {};
    SPEND_KEYS.forEach(function (k) {
      const w = Math.max(0, Number(weights[k]) || 0);
      target[k] = wsum > 0 ? Math.max(0, Math.round(base * w / wsum) - (cfg.subtractCoverage ? (coverage[k] || 0) : 0)) : 0;
      need[k] = Math.max(0, target[k] - alloc[k]);
    });
    [ESSENTIAL_KEYS, OPTIONAL_KEYS].forEach(function (group) {
      const r = fillNeeds(group, need, remaining);
      group.forEach(function (k) { alloc[k] += r.give[k]; });
      remaining -= r.used;
    });
    if (remaining > 0) {
      const extra = largestRemainder(remaining, wsum > 0 ? weights : { misc: 1 }, SPEND_KEYS);
      SPEND_KEYS.forEach(function (k) { alloc[k] += extra[k]; });
    }
    return { alloc: alloc, effMin: effMin, minShortfallPence: minShortfall, target: target };
  }

  /** Average discretionary spend per category over the last 3 recorded months (needs ≥2). */
  function spendingHistory(state, m) {
    const from = addMonths(m, -6);
    const keys = Object.keys(state.months).filter(function (k) {
      return k < m && k >= from && state.months[k].discretionarySpend.length > 0;
    }).sort().slice(-3);
    if (keys.length < 2) return null;
    const totals = {};
    SPEND_KEYS.forEach(function (k) { totals[k] = 0; });
    keys.forEach(function (k) {
      state.months[k].discretionarySpend.forEach(function (s) { if (totals[s.category] !== undefined) totals[s.category] += s.amountPence; });
    });
    const avg = {};
    SPEND_KEYS.forEach(function (k) { avg[k] = Math.round(totals[k] / keys.length); });
    if (sum(SPEND_KEYS, function (k) { return avg[k]; }) <= 0) return null;
    return { months: keys, avg: avg };
  }

  function daysLeftIn(m, today) {
    const current = monthKey(today);
    const dim = daysInMonth(m);
    if (m < current) return 0;
    if (m > current) return dim;
    return dim - today.getDate() + 1;
  }

  function spendingPlan(state, m, row, opts) {
    const today = (opts && opts.today) || new Date();
    const rec = state.months[m] || null;
    const sp = state.settings.spending;
    const pool = row ? row.safeToSpendPence : 0;
    const coverage = fixedCoverage(expensesForMonth(state, m));
    const hist = spendingHistory(state, m);
    const weights = hist ? hist.avg : sp.pcts;
    const r = allocateSpending(pool, { mins: sp.mins, weights: weights, coverage: coverage, subtractCoverage: !hist });
    const overrides = (rec && rec.categoryBudgets) || {};
    const carry = (rec && rec.carryIn) || {};
    const spent = {};
    SPEND_KEYS.forEach(function (k) { spent[k] = 0; });
    (rec ? rec.discretionarySpend : []).forEach(function (s) { if (spent[s.category] !== undefined) spent[s.category] += s.amountPence; });
    const dim = daysInMonth(m);
    const daysLeft = daysLeftIn(m, today);

    const cats = SPEND_CATS.map(function (c) {
      const k = c.key;
      const ov = overrides[k] != null ? overrides[k] : null;
      const budget = ov != null ? ov : r.alloc[k];
      const carryK = carry[k] || 0;
      const available = budget + carryK;
      const remaining = available - spent[k];
      return {
        key: k, label: c.label, essential: c.essential,
        suggestedPence: r.alloc[k], overridePence: ov, budgetPence: budget, carryPence: carryK, availablePence: available,
        spentPence: spent[k], remainingPence: remaining, over: remaining < 0,
        pctUsed: available > 0 ? spent[k] / available : (spent[k] > 0 ? 1 : 0),
        minPence: (sp.mins[k] || 0), effMinPence: r.effMin[k], coveredPence: coverage[k] || 0,
        perDayPence: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0
      };
    });
    const totalBudget = sum(cats, function (c) { return c.budgetPence; });
    const carryTotal = sum(cats, function (c) { return c.carryPence; });
    const totalSpent = sum(cats, function (c) { return c.spentPence; });
    const remainingTotal = pool + carryTotal - totalSpent;
    const perDay = daysLeft > 0 && remainingTotal > 0 ? Math.floor(remainingTotal / daysLeft) : 0;
    return {
      month: m, poolPence: pool, cats: cats, basis: hist ? 'history' : 'percentages', historyMonths: hist ? hist.months : [],
      totalBudgetPence: totalBudget, totalSuggestedPence: sum(cats, function (c) { return c.suggestedPence; }),
      unallocatedPence: pool - totalBudget, carryTotalPence: carryTotal, totalSpentPence: totalSpent,
      remainingTotalPence: remainingTotal, minShortfallPence: r.minShortfallPence,
      daysInMonth: dim, daysLeft: daysLeft, perDayPence: perDay,
      perWeekPence: Math.min(Math.max(0, remainingTotal), perDay * 7),
      hasOverrides: cats.some(function (c) { return c.overridePence != null; }),
      weights: weights
    };
  }

  /** Suggests moving money from discretionary categories with room into overspent ones. */
  function suggestReallocation(plan) {
    const room = {};
    plan.cats.forEach(function (c) { room[c.key] = c.over ? 0 : Math.max(0, c.remainingPence); });
    const moves = [];
    let uncovered = 0;
    plan.cats.filter(function (c) { return c.over; }).forEach(function (c) {
      let deficit = -c.remainingPence;
      DONOR_ORDER.forEach(function (k) {
        if (deficit <= 0 || k === c.key || room[k] <= 0) return;
        const amt = Math.min(room[k], deficit);
        room[k] -= amt; deficit -= amt;
        moves.push({ from: k, to: c.key, amountPence: amt });
      });
      uncovered += deficit;
    });
    return { moves: moves, uncoveredPence: uncovered };
  }

  /** New category budgets for the rest of the month, based on what is left and days remaining. */
  function rebalancePlan(state, plan) {
    const remainingPool = plan.poolPence + plan.carryTotalPence - plan.totalSpentPence;
    if (remainingPool <= 0 || plan.daysLeft <= 0) return { ok: false, remainingPoolPence: remainingPool };
    const frac = plan.daysLeft / plan.daysInMonth;
    const mins = {};
    plan.cats.forEach(function (c) { mins[c.key] = Math.round(c.effMinPence * frac); });
    const r = allocateSpending(remainingPool, { mins: mins, weights: plan.weights, coverage: {}, subtractCoverage: false });
    const proposed = {};
    plan.cats.forEach(function (c) { proposed[c.key] = Math.max(0, c.spentPence + r.alloc[c.key] - c.carryPence); });
    return { ok: true, remainingPoolPence: remainingPool, proposed: proposed, remainingAlloc: r.alloc };
  }

  /** Unspent money from the previous month, split by category (only applied when approved). */
  function carryForwardCandidates(state, sim, m, today) {
    const prev = addMonths(m, -1);
    const prevPlan = spendingPlan(state, prev, rowFor(sim, prev), { today: today });
    const total = Math.max(0, prevPlan.remainingTotalPence);
    const out = {};
    SPEND_KEYS.forEach(function (k) { out[k] = 0; });
    if (total <= 0) return { month: prev, totalPence: 0, byCat: out };
    const pos = {};
    prevPlan.cats.forEach(function (c) { pos[c.key] = Math.max(0, c.remainingPence); });
    const posSum = sum(SPEND_KEYS, function (k) { return pos[k]; });
    const fromCats = Math.min(total, posSum);
    const split = posSum > 0 ? (fromCats === posSum ? pos : largestRemainder(fromCats, pos, SPEND_KEYS)) : out;
    SPEND_KEYS.forEach(function (k) { out[k] = split[k] || 0; });
    out.misc += total - fromCats; // unallocated money left over
    return { month: prev, totalPence: total, byCat: out };
  }

  /* ------------------------------------------------------------------ *
   * CSV
   * ------------------------------------------------------------------ */
  /** Escapes a cell. Text that could be read as a formula is prefixed with an apostrophe. */
  function csvCell(v) {
    if (v && typeof v === 'object' && 'pence' in v) return v.pence == null ? '' : penceToDecimal(v.pence);
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(rows) {
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  const INCOME_BASIS_LABEL = {
    confirmed: 'Confirmed', 'assumed-manual': 'Assumed (your figure)', 'assumed-latest': 'Assumed (latest confirmed)', none: 'Not entered'
  };
  const STATUS_LABEL = { ok: 'On track', tight: 'Tight', over: 'Over-allocated', shortfall: 'Shortfall' };
  const PHASE_LABEL = { actual: 'Actual', current: 'Current', forecast: 'Forecast' };

  function spreadsheetCSV(state, sim, opts) {
    const today = (opts && opts.today) || new Date();
    const debts = state.debts.filter(function (d) { return !d.archived; });
    const header = ['Month', 'Type', 'Income basis', 'Income (£)', 'Essential expenses (£)', 'Minimum debt payments (£)',
      'Additional debt payments (£)', 'Total debt payments (£)', 'Savings contribution (£)', 'Financial buffer (£)',
      'Safe-to-spend (£)', 'Shortfall (£)', 'Closing debt balance (£)', 'Accumulated savings (£)', 'Budget status', 'Debt interest (est.) (£)']
      .concat(SPEND_CATS.map(function (c) { return c.label + ' budget (£)'; }))
      .concat(debts.map(function (d) { return debtName(d) + ' closing (£)'; }));
    const out = [header];
    sim.rows.forEach(function (r) {
      const plan = spendingPlan(state, r.month, r, { today: today });
      out.push([monthLabel(r.month), PHASE_LABEL[r.phase], INCOME_BASIS_LABEL[r.incomeBasis],
        { pence: r.incomePence }, { pence: r.essentialPence }, { pence: r.minDebtPence }, { pence: r.extraPaidPence },
        { pence: r.debtPaidPence }, { pence: r.savingsPence }, { pence: r.bufferPence }, { pence: r.safeToSpendPence },
        { pence: r.shortfallPence }, { pence: r.closingDebtPence }, { pence: r.savingsBalancePence },
        STATUS_LABEL[r.status], { pence: r.interestPence }]
        .concat(plan.cats.map(function (c) { return { pence: c.budgetPence }; }))
        .concat(debts.map(function (d) {
          const it = r.debts.find(function (x) { return x.id === d.id; });
          if (it) return { pence: it.closingPence };
          return { pence: d.startMonth > r.month ? null : 0 };
        })));
    });
    return toCSV(out);
  }

  return {
    // constants
    MAX_PENCE: MAX_PENCE, STRATEGIES: STRATEGIES, SAVINGS_APPROACHES: SAVINGS_APPROACHES,
    SPEND_CATS: SPEND_CATS, SPEND_KEYS: SPEND_KEYS, INCOME_BASIS_LABEL: INCOME_BASIS_LABEL,
    STATUS_LABEL: STATUS_LABEL, PHASE_LABEL: PHASE_LABEL, MONTHS: MONTHS,
    // utils
    escapeHtml: escapeHtml, sum: sum, clampInt: clampInt,
    isMonthKey: isMonthKey, isISODate: isISODate, monthKey: monthKey, isoDate: isoDate, monthOfDate: monthOfDate,
    addMonths: addMonths, monthsBetween: monthsBetween, daysInMonth: daysInMonth, monthLabel: monthLabel,
    formatDate: formatDate, dueDateFor: dueDateFor, ordinal: ordinal,
    parseMoney: parseMoney, parsePercentBps: parsePercentBps, formatGBP: formatGBP, penceToDecimal: penceToDecimal, formatBps: formatBps,
    monthlyInterest: monthlyInterest,
    // records
    expensesForMonth: expensesForMonth, confirmedIncome: confirmedIncome, monthHasData: monthHasData, debtName: debtName,
    fixedCoverage: fixedCoverage, livingReserve: livingReserve,
    // engine
    recommendSplit: recommendSplit, orderDebts: orderDebts, simulate: simulate, rowFor: rowFor,
    compareStrategies: compareStrategies, debtSummaries: debtSummaries,
    monthObligations: monthObligations, overdueItems: overdueItems,
    largestRemainder: largestRemainder, allocateSpending: allocateSpending, spendingHistory: spendingHistory,
    spendingPlan: spendingPlan, suggestReallocation: suggestReallocation, rebalancePlan: rebalancePlan,
    carryForwardCandidates: carryForwardCandidates, daysLeftIn: daysLeftIn,
    // csv
    csvCell: csvCell, toCSV: toCSV, spreadsheetCSV: spreadsheetCSV
  };
});
