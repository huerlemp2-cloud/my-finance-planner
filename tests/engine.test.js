/*!
 * My Finance Planner — calculation engine tests.
 * Run in Node:     node tests/engine.test.js
 * Run in browser:  open tests/index.html
 * No dependencies.
 */
(function () {
  'use strict';
  const isNode = typeof module === 'object' && typeof require === 'function';
  const E = isNode ? require('../js/engine.js') : window.MFP.Engine;
  const Store = isNode ? require('../js/store.js') : window.MFP.Store;

  const tests = [];
  function test(name, fn) { tests.push({ name: name, fn: fn }); }
  function fail(msg) { throw new Error(msg); }
  function eq(actual, expected, msg) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) fail((msg ? msg + ': ' : '') + 'expected ' + b + ', got ' + a);
  }
  function ok(cond, msg) { if (!cond) fail(msg || 'assertion failed'); }

  /* ---------------- fixtures ---------------- */
  const TODAY = new Date(2026, 10, 15); // 15/11/2026
  const NOV = '2026-11', DEC = '2026-12', OCT = '2026-10', SEP = '2026-09';
  let seq = 0;
  function nid(p) { return (p || 'id') + '-' + (++seq); }
  function state(fn) {
    const s = Store.defaultState();
    s.settings.strategy = 'minimum';
    if (fn) fn(s);
    return s;
  }
  function month(s, m) { if (!s.months[m]) s.months[m] = Store.emptyMonth(); return s.months[m]; }
  function income(s, m, pence) { month(s, m).income.push({ id: nid('inc'), description: 'Salary', type: 'salary', amountPence: pence, sourceId: null }); }
  function expense(s, o) {
    const e = Object.assign({ id: nid('exp'), description: 'Expense', amountPence: 0, category: 'other', dueDay: null, recurring: true, startMonth: NOV, endMonth: null, createdAt: '' }, o);
    if (!e.recurring) e.endMonth = e.startMonth;
    s.expenses.push(e); return e;
  }
  function debt(s, o) {
    const d = Object.assign({ id: nid('debt'), creditor: 'Creditor', description: '', balancePence: 0, aprBps: 0, minPaymentPence: 0, dueDay: null, startMonth: NOV, interestFreeUntil: null, contractEndDate: null, priority: null, notes: '', archived: false, createdAt: '' }, o);
    s.debts.push(d); return d;
  }
  function pay(s, debtId, date, pence, kind) { s.debtPayments.push({ id: nid('pay'), debtId: debtId, date: date, month: date.slice(0, 7), amountPence: pence, kind: kind || 'regular', note: '' }); }
  function sim(s, opts) { return E.simulate(s, Object.assign({ today: TODAY }, opts || {})); }
  function row(r, m) { return E.rowFor(r, m); }
  function drow(rw, id) { return rw.debts.find(function (d) { return d.id === id; }); }
  function allNonNegative(r) {
    r.rows.forEach(function (rw) {
      ok(rw.safeToSpendPence >= 0, 'safe-to-spend negative in ' + rw.month);
      ok(rw.closingDebtPence >= 0, 'closing debt negative in ' + rw.month);
      rw.debts.forEach(function (d) { ok(d.closingPence >= 0, 'debt balance negative in ' + rw.month); });
    });
  }

  /* ---------------- money and dates ---------------- */
  test('Money parsing accepts valid GBP input and rejects invalid input', function () {
    eq(E.parseMoney('1,234.56'), 123456);
    eq(E.parseMoney('£12'), 1200);
    eq(E.parseMoney('12.5'), 1250);
    eq(E.parseMoney('.99'), 99);
    eq(E.parseMoney('0'), 0);
    eq(E.parseMoney('-5'), null, 'negative rejected by default');
    eq(E.parseMoney('-£5.10', { allowNegative: true }), -510);
    eq(E.parseMoney('12.345'), null, 'three decimals');
    eq(E.parseMoney('abc'), null);
    eq(E.parseMoney('1e5'), null);
    eq(E.parseMoney('12,34'), null, 'misplaced separator');
    eq(E.parseMoney(''), null);
    eq(E.parseMoney('999999999999'), null, 'above ceiling');
    eq(E.parsePercentBps('19.99'), 1999);
    eq(E.parsePercentBps('0'), 0);
    eq(E.parsePercentBps('-1'), null);
  });
  test('Formatting uses GBP and DD/MM/YYYY', function () {
    eq(E.formatGBP(123456), '£1,234.56');
    eq(E.formatGBP(-500), '−£5.00');
    eq(E.formatDate('2026-11-05'), '05/11/2026');
    eq(E.monthLabel('2026-11'), 'November 2026');
    eq(E.addMonths('2026-11', 3), '2027-02');
    eq(E.addMonths('2026-01', -1), '2025-12');
    eq(E.daysInMonth('2028-02'), 29);
    eq(E.penceToDecimal(-1234), '-12.34');
  });

  /* ---------------- calculation rules ---------------- */
  test('Monthly interest = balance × APR ÷ 12, rounded to the penny', function () {
    eq(E.monthlyInterest(100000, 1999), 1666); // £1,000 at 19.99% → £16.66
    eq(E.monthlyInterest(0, 1999), 0);
    eq(E.monthlyInterest(100000, 0), 0);
  });

  test('Zero-interest debt repays in exactly balance ÷ minimum months', function () {
    const s = state(function (s) { income(s, NOV, 200000); debt(s, { balancePence: 120000, minPaymentPence: 10000 }); });
    const r = sim(s);
    eq(r.debtFreeMonth, '2027-10');
    eq(r.totalInterestFromCurrentPence, 0);
    allNonNegative(r);
  });

  test('Final partial repayment never overpays and balance never goes negative', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 200000); d = debt(s, { balancePence: 25000, minPaymentPence: 10000 }); });
    const r = sim(s);
    eq([NOV, DEC, '2027-01'].map(function (m) { return drow(row(r, m), d.id).paidPence; }), [10000, 10000, 5000]);
    eq(drow(row(r, '2027-01'), d.id).closingPence, 0);
    eq(row(r, '2027-02').debts.length, 0, 'no payment after payoff');
    allNonNegative(r);
  });

  test('Interest-free period charges no interest until it ends', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 200000); d = debt(s, { balancePence: 120000, aprBps: 2400, minPaymentPence: 10000, interestFreeUntil: DEC }); });
    const r = sim(s);
    eq(drow(row(r, NOV), d.id).interestPence, 0);
    eq(drow(row(r, DEC), d.id).interestPence, 0);
    eq(drow(row(r, '2027-01'), d.id).interestPence, E.monthlyInterest(100000, 2400));
  });

  test('Month-to-month rollover: closing balance becomes next opening balance', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 200000); d = debt(s, { balancePence: 100000, aprBps: 1200, minPaymentPence: 10000 }); });
    const r = sim(s);
    const n = drow(row(r, NOV), d.id), dc = drow(row(r, DEC), d.id);
    eq(n.closingPence, 100000 + 1000 - 10000);
    eq(dc.openingPence, n.closingPence);
  });

  test('Snowball pays the smallest balance first; avalanche the highest rate first', function () {
    let A, B, C;
    const s = state(function (s) {
      income(s, NOV, 300000);
      A = debt(s, { creditor: 'A', balancePence: 100000, aprBps: 1000, minPaymentPence: 5000 });
      B = debt(s, { creditor: 'B', balancePence: 50000, aprBps: 2500, minPaymentPence: 2500 });
      C = debt(s, { creditor: 'C', balancePence: 20000, aprBps: 500, minPaymentPence: 2000 });
      month(s, NOV).overrides.extraDebtPence = 30000;
    });
    const av = row(sim(s, { strategy: 'avalanche' }), NOV);
    eq(drow(av, B.id).extraPence, 30000, 'avalanche → B (25%)');
    eq(drow(av, C.id).extraPence, 0);
    const sb = row(sim(s, { strategy: 'snowball' }), NOV);
    const cDue = 20000 + E.monthlyInterest(20000, 500);
    eq(drow(sb, C.id).extraPence, cDue - 2000, 'snowball clears C first');
    eq(drow(sb, B.id).extraPence, 30000 - (cDue - 2000), 'remainder rolls to next smallest');
    eq(drow(sb, A.id).extraPence, 0);
  });

  test('Savings accumulate month by month from the current balance', function () {
    const s = state(function (s) {
      income(s, NOV, 300000);
      s.settings.savingsApproach = 'conservative';
      s.savings.openingBalancePence = 50000; s.savings.baselineMonth = NOV; s.savings.targetMonthlyPence = 10000;
    });
    const r = sim(s);
    eq([NOV, DEC, '2027-01'].map(function (m) { return row(r, m).savingsBalancePence; }), [60000, 70000, 80000]);
  });

  test('Debt payments are never double-counted as expenses; recurring expenses count once', function () {
    const s = state(function (s) {
      income(s, NOV, 300000);
      expense(s, { description: 'Rent', category: 'rent', amountPence: 90000 });
      debt(s, { balancePence: 50000, minPaymentPence: 5000 });
    });
    const r1 = sim(s), r2 = sim(s);
    eq(row(r1, NOV).essentialPence, 90000);
    eq(row(r1, NOV).minDebtPence, 5000);
    eq(row(r1, DEC).essentialPence, 90000, 'recurring carried forward once');
    eq(E.expensesForMonth(s, DEC).length, 1);
    eq(JSON.stringify(r1.rows), JSON.stringify(r2.rows), 'regeneration is deterministic');
  });

  test('Projections never overwrite or mutate recorded actuals', function () {
    let d;
    const s = state(function (s) {
      income(s, OCT, 200000); income(s, NOV, 200000);
      d = debt(s, { balancePence: 100000, minPaymentPence: 10000, startMonth: OCT });
      pay(s, d.id, '2026-10-20', 4000);
    });
    const before = JSON.stringify(s);
    const r = sim(s);
    eq(JSON.stringify(s), before, 'state unchanged by simulation');
    const o = drow(row(r, OCT), d.id);
    eq(o.paidPence, 4000, 'past month uses actual payment only');
    ok(o.missedMin, 'missed minimum flagged');
    eq(row(r, OCT).phase, 'actual');
  });

  test('Recalculation after manual change: extra payment override brings debt-free date forward', function () {
    const s = state(function (s) { income(s, NOV, 300000); debt(s, { balancePence: 240000, aprBps: 1500, minPaymentPence: 10000 }); });
    const base = sim(s).debtFreeMonth;
    s.settings.defaultOverrides.extraDebtPence = 20000;
    const faster = sim(s).debtFreeMonth;
    ok(faster < base, 'override should shorten repayment (' + faster + ' vs ' + base + ')');
    eq(row(sim(s), NOV).overrides.extraSource, 'default');
  });

  /* ---------------- the 15 required scenarios ---------------- */
  test('Scenario 1 — user with no debts', function () {
    const s = state(function (s) {
      income(s, NOV, 250000);
      expense(s, { description: 'Rent', category: 'rent', amountPence: 100000 });
      s.settings.bufferPence = 10000;
    });
    const r = sim(s);
    const n = row(r, NOV);
    eq(r.debtFreeMonth, null); eq(r.hasDebts, false);
    eq(n.recommended.extraDebtPence, 0);
    eq(n.savingsPence, Math.floor(140000 * 0.35));
    eq(n.safeToSpendPence, 250000 - 100000 - 49000 - 10000);
    eq(r.rows.length, 12, 'twelve-month forecast');
  });

  test('Scenario 2 — five debts with different rates: avalanche ≤ snowball ≤ minimum interest', function () {
    const s = state(function (s) {
      income(s, NOV, 280000);
      expense(s, { description: 'Rent', category: 'rent', amountPence: 110000 });
      debt(s, { creditor: 'Card A', balancePence: 320000, aprBps: 2490, minPaymentPence: 9600 });
      debt(s, { creditor: 'Card B', balancePence: 85000, aprBps: 2990, minPaymentPence: 2500 });
      debt(s, { creditor: 'Loan', balancePence: 600000, aprBps: 790, minPaymentPence: 18500 });
      debt(s, { creditor: 'Overdraft', balancePence: 45000, aprBps: 3950, minPaymentPence: 2000 });
      debt(s, { creditor: 'Catalogue', balancePence: 30000, aprBps: 0, minPaymentPence: 1500 });
    });
    const cmp = E.compareStrategies(s, { today: TODAY });
    const by = {}; cmp.forEach(function (c) { by[c.strategy] = c; });
    ok(by.avalanche.debtFreeMonth && by.snowball.debtFreeMonth && by.minimum.debtFreeMonth, 'all strategies finish');
    ok(by.avalanche.totalInterestPence <= by.snowball.totalInterestPence, 'avalanche ≤ snowball');
    ok(by.snowball.totalInterestPence < by.minimum.totalInterestPence, 'snowball < minimum');
    ok(by.avalanche.debtFreeMonth <= by.minimum.debtFreeMonth);
    ['minimum', 'snowball', 'avalanche'].forEach(function (k) { allNonNegative(sim(s, { strategy: k })); });
  });

  test('Scenario 3 — income changes monthly; future months use latest confirmed income as a labelled assumption', function () {
    const s = state(function (s) {
      income(s, SEP, 200000); income(s, OCT, 250000); income(s, NOV, 220000);
    });
    const r = sim(s);
    eq([SEP, OCT, NOV].map(function (m) { return row(r, m).incomePence; }), [200000, 250000, 220000]);
    eq(row(r, SEP).phase, 'actual');
    eq(row(r, DEC).incomeBasis, 'assumed-latest'); eq(row(r, DEC).incomeFrom, NOV); eq(row(r, DEC).incomePence, 220000);
    s.settings.assumeIncomeRepeats = false;
    eq(row(sim(s), DEC).incomePence, 0, 'no assumption when disabled');
    eq(row(sim(s), DEC).incomeBasis, 'none');
  });

  test('Scenario 4 — cannot cover minimum payments: shortfall shown, minimums not reduced', function () {
    let d;
    const s = state(function (s) {
      income(s, NOV, 100000);
      expense(s, { description: 'Rent', category: 'rent', amountPence: 80000, dueDay: 1 });
      d = debt(s, { creditor: 'Card', balancePence: 300000, minPaymentPence: 30000, dueDay: 10 });
    });
    const n = row(sim(s), NOV);
    eq(n.status, 'shortfall');
    eq(n.minDebtPence, 30000, 'contractual minimum kept');
    eq(drow(n, d.id).paidPence, 30000);
    eq(n.safeToSpendPence, 0); eq(n.shortfallPence, 10000);
    eq(n.recommended.extraDebtPence, 0); eq(n.recommended.savingsPence, 0);
    eq(n.unfunded.length, 1); eq(n.unfunded[0].kind, 'debt-minimum'); eq(n.unfunded[0].shortByPence, 10000);
  });

  test('Different due dates decide which obligation goes unfunded first', function () {
    const s = state(function (s) {
      income(s, NOV, 30000);
      debt(s, { creditor: 'Late', balancePence: 100000, minPaymentPence: 20000, dueDay: 25 });
      debt(s, { creditor: 'Early', balancePence: 100000, minPaymentPence: 20000, dueDay: 3 });
    });
    const n = row(sim(s), NOV);
    eq(n.unfunded.map(function (u) { return u.label; }), ['Late (minimum payment)']);
    eq(n.unfunded[0].shortByPence, 10000);
  });

  test('Scenario 5 — additional payment reduces balance and repayment time', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 200000); d = debt(s, { balancePence: 100000, minPaymentPence: 10000 }); });
    eq(sim(s).debtFreeMonth, '2027-08');
    pay(s, d.id, '2026-11-10', 30000, 'extra');
    const r = sim(s);
    eq(drow(row(r, NOV), d.id).paidPence, 30000, 'actual payment counted once (not plus the minimum)');
    eq(drow(row(r, NOV), d.id).closingPence, 70000);
    eq(r.debtFreeMonth, '2027-06');
  });

  test('Scenario 6 — changing repayment strategy changes allocation and totals', function () {
    const s = state(function (s) {
      income(s, NOV, 300000);
      debt(s, { creditor: 'Big low', balancePence: 400000, aprBps: 500, minPaymentPence: 8000 });
      debt(s, { creditor: 'Small high', balancePence: 60000, aprBps: 3500, minPaymentPence: 3000 });
    });
    const a = sim(s, { strategy: 'avalanche' }), m = sim(s, { strategy: 'minimum' });
    eq(row(m, NOV).extraAppliedPence, 0);
    ok(row(a, NOV).extraAppliedPence > 0);
    ok(a.totalInterestFromCurrentPence < m.totalInterestFromCurrentPence);
    ok(a.debtFreeMonth < m.debtFreeMonth);
  });

  test('Scenario 7 — modifying the savings target changes contributions and projected balance', function () {
    const s = state(function (s) { income(s, NOV, 300000); s.settings.savingsApproach = 'conservative'; s.savings.targetMonthlyPence = 10000; });
    const r1 = sim(s);
    s.savings.targetMonthlyPence = 25000;
    const r2 = sim(s);
    eq(row(r1, NOV).savingsPence, 10000); eq(row(r2, NOV).savingsPence, 25000);
    eq(row(r2, '2027-10').savingsBalancePence, 25000 * 12);
    month(s, NOV).overrides.savingsPence = 5000;
    eq(row(sim(s), NOV).savingsPence, 5000, 'manual override respected');
    eq(row(sim(s), NOV).overrides.savingsSource, 'month');
  });

  test('Scenario 8 — paying off a debt early closes it and stops future payments', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 200000); d = debt(s, { balancePence: 100000, aprBps: 1999, minPaymentPence: 5000 }); });
    const due = 100000 + E.monthlyInterest(100000, 1999);
    pay(s, d.id, '2026-11-02', due, 'extra');
    const r = sim(s);
    eq(drow(row(r, NOV), d.id).closingPence, 0);
    eq(r.payoff[d.id], NOV);
    eq(r.debtFreeMonth, NOV);
    eq(row(r, DEC).debtPaidPence, 0);
  });

  test('Scenario 9 — import of a saved backup restores data and rejects bad files', function () {
    const s = state(function (s) {
      income(s, NOV, 200000);
      debt(s, { creditor: '<img src=x onerror=alert(1)>', balancePence: 5000, minPaymentPence: 500 });
      expense(s, { description: 'Rent', amountPence: 90000 });
    });
    const text = Store.exportJSON(s);
    const imp = Store.parseImport(text);
    eq(imp.state.debts.length, 1); eq(imp.state.expenses.length, 1);
    eq(E.confirmedIncome(imp.state, NOV), 200000);
    eq(imp.state.debts[0].creditor, '<img src=x onerror=alert(1)>', 'stored as plain text');
    ok(E.escapeHtml(imp.state.debts[0].creditor).indexOf('<') === -1, 'escaped before rendering');
    // malformed records
    const bad = JSON.parse(text);
    bad.data.debts.push({ id: 'x1', creditor: 'Bad', balancePence: '100', minPaymentPence: 1, startMonth: NOV });
    bad.data.debts.push({ id: 'x2', creditor: 'Neg', balancePence: -100, minPaymentPence: 1, startMonth: NOV });
    bad.data.expenses.push({ id: 'x3', amountPence: 12.5, startMonth: NOV });
    const imp2 = Store.parseImport(JSON.stringify(bad));
    eq(imp2.state.debts.length, 1); eq(imp2.state.expenses.length, 1);
    ok(imp2.warnings.length >= 2, 'warnings reported');
    function throws(t, why) { let threw = false; try { Store.parseImport(t); } catch (e) { threw = true; } ok(threw, why); }
    throws('not json', 'invalid JSON');
    throws(JSON.stringify({ foo: 1 }), 'not an app backup');
    const newer = JSON.parse(text); newer.schemaVersion = 99; newer.data.schemaVersion = 99;
    throws(JSON.stringify(newer), 'newer schema');
  });

  // Scenario 10 (mobile device) is a layout scenario, verified in a real browser at a
  // 390 × 844 viewport — see README "Test results".

  test('Scenario 11 — zero income: nothing is safe to spend, nothing suggested', function () {
    const s = state(function (s) { expense(s, { description: 'Rent', amountPence: 50000 }); debt(s, { balancePence: 10000, minPaymentPence: 2000 }); });
    const n = row(sim(s), NOV);
    eq(n.incomePence, 0); eq(n.incomeBasis, 'none');
    eq(n.safeToSpendPence, 0); eq(n.shortfallPence, 52000); eq(n.status, 'shortfall');
    eq(n.savingsPence, 0); eq(n.recommended.extraDebtPence, 0);
  });

  test('Scenario 12 — payments that would exceed the balance are capped', function () {
    let d;
    const s = state(function (s) { income(s, NOV, 300000); d = debt(s, { balancePence: 30000, minPaymentPence: 50000 }); month(s, NOV).overrides.extraDebtPence = 999999; });
    const r = sim(s, { strategy: 'avalanche' });
    const n = row(r, NOV);
    eq(drow(n, d.id).paidPence, 30000); eq(drow(n, d.id).closingPence, 0);
    ok(n.extraCapped, 'cap flagged');
    eq(n.overrides.extraDebtPence, 999999, 'user value kept, not silently changed');
    allNonNegative(r);
  });

  test('Scenario 13 — debt that never amortises stops at the planning horizon', function () {
    const s = state(function (s) { income(s, NOV, 200000); debt(s, { balancePence: 1000000, aprBps: 3000, minPaymentPence: 10000 }); s.settings.planningHorizonMonths = 24; });
    const r = sim(s);
    eq(r.nonAmortising.length, 1);
    ok(r.horizonReached, 'horizon reached');
    eq(r.debtFreeMonth, null);
    eq(r.rows.length, 24);
    ok(row(r, '2028-10').closingDebtPence > 1000000, 'balance grows');
  });

  test('Scenario 14 — overdue obligations are detected using due dates', function () {
    let d, rent;
    const s = state(function (s) {
      income(s, NOV, 300000);
      rent = expense(s, { description: 'Rent', amountPence: 90000, dueDay: 1 });
      expense(s, { description: 'Water', amountPence: 3000, dueDay: 28 });
      d = debt(s, { creditor: 'Card', balancePence: 100000, minPaymentPence: 5000, dueDay: 5, startMonth: SEP });
    });
    const r = sim(s);
    const od = E.overdueItems(s, r, TODAY);
    const labels = od.map(function (o) { return o.month + ':' + o.label; }).sort();
    eq(labels, ['2026-09:Card', '2026-10:Card', '2026-11:Card', '2026-11:Rent']);
    month(s, NOV).expenseStatus[rent.id] = { paid: true, date: '2026-11-01' };
    pay(s, d.id, '2026-11-04', 5000);
    const od2 = E.overdueItems(s, sim(s), TODAY).filter(function (o) { return o.month === NOV; });
    eq(od2.length, 0, 'paid items no longer overdue');
  });

  test('Scenario 15 — changing a future month’s income assumption affects only that month', function () {
    const s = state(function (s) { income(s, NOV, 200000); month(s, '2027-01').assumedIncomePence = 150000; });
    const r = sim(s);
    eq(row(r, NOV).incomeBasis, 'confirmed');
    eq(row(r, DEC).incomePence, 200000); eq(row(r, DEC).incomeBasis, 'assumed-latest');
    eq(row(r, '2027-01').incomePence, 150000); eq(row(r, '2027-01').incomeBasis, 'assumed-manual');
    eq(row(r, '2027-02').incomePence, 200000);
    eq(E.confirmedIncome(s, '2027-01'), null, 'assumption never becomes confirmed income');
  });

  /* ---------------- spending allocation (section 18) ---------------- */
  test('Spending: percentage fallback allocates the whole allowance exactly', function () {
    const s = state();
    const r = E.allocateSpending(100000, { mins: s.settings.spending.mins, weights: s.settings.spending.pcts, coverage: {}, subtractCoverage: true });
    eq(r.alloc, { groceries: 35000, transport: 15000, health: 5000, personal: 8000, leisure: 15000, shopping: 10000, misc: 12000 });
    [1, 7, 999, 12345, 100001].forEach(function (p) {
      const a = E.allocateSpending(p, { mins: s.settings.spending.mins, weights: s.settings.spending.pcts, coverage: {} }).alloc;
      eq(E.sum(E.SPEND_KEYS, function (k) { return a[k]; }), p, 'sum for ' + p);
    });
  });

  test('Spending: essential minimums are funded before optional categories', function () {
    const s = state(function (s) { s.settings.spending.mins.groceries = 25000; s.settings.spending.mins.transport = 10000; });
    const r = E.allocateSpending(30000, { mins: s.settings.spending.mins, weights: s.settings.spending.pcts, coverage: {} });
    eq(r.alloc.groceries, 25000); eq(r.alloc.transport, 5000); eq(r.alloc.leisure, 0);
    eq(r.minShortfallPence, 5000);
  });

  test('Spending: fixed grocery expense is not double-counted', function () {
    const s = state(function (s) {
      income(s, NOV, 300000);
      expense(s, { description: 'Weekly shop', category: 'groceries', amountPence: 20000 });
      s.settings.spending.mins.groceries = 25000;
    });
    const n = row(sim(s), NOV);
    eq(n.reservePence, 5000, 'only the uncovered £50 is reserved');
    const plan = E.spendingPlan(s, NOV, n, { today: TODAY });
    const g = plan.cats.find(function (c) { return c.key === 'groceries'; });
    eq(g.coveredPence, 20000); eq(g.effMinPence, 5000);
    eq(plan.totalBudgetPence, n.safeToSpendPence, 'all safe-to-spend allocated');
    eq(plan.basis, 'percentages');
  });

  test('Spending: history drives allocation when two or more months exist', function () {
    const s = state(function (s) {
      income(s, NOV, 300000);
      [SEP, OCT].forEach(function (m) {
        month(s, m).discretionarySpend.push({ id: nid('sp'), date: m + '-10', category: 'groceries', description: '', amountPence: 30000 });
        month(s, m).discretionarySpend.push({ id: nid('sp'), date: m + '-12', category: 'leisure', description: '', amountPence: 10000 });
      });
    });
    const r = sim(s);
    const plan = E.spendingPlan(s, NOV, row(r, NOV), { today: TODAY });
    eq(plan.basis, 'history');
    eq(plan.historyMonths, [SEP, OCT]);
    const g = plan.cats.find(function (c) { return c.key === 'groceries'; }), l = plan.cats.find(function (c) { return c.key === 'leisure'; });
    eq(plan.cats.filter(function (c) { return c.budgetPence > 0; }).length, 2, 'only categories with history');
    ok(Math.abs(g.budgetPence - 3 * l.budgetPence) <= 1, '3:1 ratio from history');
  });

  test('Spending: tracking, remaining per category, per-day and per-week allowances', function () {
    const s = state(function (s) { income(s, NOV, 200000); s.settings.savingsApproach = 'debt-focused'; s.savings.targetMonthlyPence = 1; });
    month(s, NOV).discretionarySpend.push({ id: nid('sp'), date: '2026-11-03', category: 'leisure', description: 'Cinema', amountPence: 2500 });
    const n = row(sim(s), NOV);
    const plan = E.spendingPlan(s, NOV, n, { today: TODAY });
    eq(plan.daysLeft, 16);
    eq(plan.totalSpentPence, 2500);
    eq(plan.remainingTotalPence, n.safeToSpendPence - 2500);
    eq(plan.perDayPence, Math.floor(plan.remainingTotalPence / 16));
    eq(plan.perWeekPence, plan.perDayPence * 7);
    const l = plan.cats.find(function (c) { return c.key === 'leisure'; });
    eq(l.remainingPence, l.budgetPence - 2500);
  });

  test('Spending: overspend suggests moving money between discretionary categories only', function () {
    const s = state(function (s) { income(s, NOV, 100000); });
    const n = row(sim(s), NOV);
    let plan = E.spendingPlan(s, NOV, n, { today: TODAY });
    const leisure = plan.cats.find(function (c) { return c.key === 'leisure'; });
    month(s, NOV).discretionarySpend.push({ id: nid('sp'), date: '2026-11-10', category: 'leisure', description: '', amountPence: leisure.budgetPence + 2000 });
    plan = E.spendingPlan(s, NOV, row(sim(s), NOV), { today: TODAY });
    const sug = E.suggestReallocation(plan);
    eq(sug.uncoveredPence, 0);
    eq(sug.moves[0].from, 'shopping'); eq(sug.moves[0].to, 'leisure'); eq(sug.moves[0].amountPence, 2000);
    const after = row(sim(s), NOV);
    eq(after.minDebtPence, n.minDebtPence); eq(after.savingsPence, n.savingsPence); eq(after.bufferPence, n.bufferPence);
  });

  test('Spending: Rebalance My Budget re-spreads only the remaining money', function () {
    const s = state(function (s) { income(s, NOV, 150000); });
    month(s, NOV).discretionarySpend.push({ id: nid('sp'), date: '2026-11-02', category: 'shopping', description: '', amountPence: 30000 });
    const n = row(sim(s), NOV);
    const plan = E.spendingPlan(s, NOV, n, { today: TODAY });
    const rb = E.rebalancePlan(s, plan);
    ok(rb.ok);
    eq(rb.remainingPoolPence, n.safeToSpendPence - 30000);
    eq(E.sum(E.SPEND_KEYS, function (k) { return rb.proposed[k]; }), n.safeToSpendPence, 'budgets sum to the allowance');
    ok(rb.proposed.shopping >= 30000, 'spent money stays in its category');
  });

  test('Spending: carry-forward offers only genuinely unspent money and needs approval', function () {
    const s = state(function (s) { income(s, OCT, 150000); income(s, NOV, 150000); });
    month(s, OCT).discretionarySpend.push({ id: nid('sp'), date: '2026-10-05', category: 'groceries', description: '', amountPence: 20000 });
    const r = sim(s);
    const cf = E.carryForwardCandidates(s, r, NOV, TODAY);
    eq(cf.month, OCT);
    eq(cf.totalPence, row(r, OCT).safeToSpendPence - 20000);
    eq(E.sum(E.SPEND_KEYS, function (k) { return cf.byCat[k]; }), cf.totalPence);
    eq(E.spendingPlan(s, NOV, row(r, NOV), { today: TODAY }).carryTotalPence, 0, 'nothing carried until approved');
  });

  /* ---------------- CSV ---------------- */
  test('CSV export: injection protection, numeric GBP values and Excel BOM', function () {
    eq(E.csvCell('=SUM(A1)'), "'=SUM(A1)");
    eq(E.csvCell('+44'), "'+44");
    eq(E.csvCell('@cmd'), "'@cmd");
    eq(E.csvCell('a,b'), '"a,b"');
    eq(E.csvCell('say "hi"'), '"say ""hi"""');
    eq(E.csvCell({ pence: -1234 }), '-12.34', 'negative numbers are not escaped');
    eq(E.csvCell({ pence: 123456 }), '1234.56');
    const s = state(function (s) { income(s, NOV, 200000); debt(s, { creditor: '=HYPERLINK("x")', balancePence: 10000, minPaymentPence: 5000 }); });
    const csv = E.spreadsheetCSV(s, sim(s), { today: TODAY });
    ok(csv.charCodeAt(0) === 0xFEFF, 'BOM');
    ok(csv.indexOf("\"'=HYPERLINK(\"\"x\"\") closing (£)\"") !== -1, 'header escaped');
    ok(csv.indexOf('November 2026,Current,Confirmed,2000.00') !== -1, 'row values');
  });

  /* ---------------- runner ---------------- */
  const results = tests.map(function (t) {
    try { t.fn(); return { name: t.name, pass: true }; } catch (e) { return { name: t.name, pass: false, error: e.message }; }
  });
  const passed = results.filter(function (r) { return r.pass; }).length;
  if (isNode) {
    results.forEach(function (r) { console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.name + (r.pass ? '' : '\n      ' + r.error)); });
    console.log('\n' + passed + '/' + results.length + ' tests passed');
    if (passed !== results.length) process.exitCode = 1;
  } else {
    window.MFP_TEST_RESULTS = results;
    const out = document.getElementById('results');
    const summary = document.getElementById('summary');
    summary.textContent = passed + ' of ' + results.length + ' tests passed';
    summary.className = passed === results.length ? 'pass' : 'fail';
    results.forEach(function (r) {
      const li = document.createElement('li');
      li.className = r.pass ? 'pass' : 'fail';
      li.textContent = (r.pass ? '✓ ' : '✗ ') + r.name + (r.pass ? '' : ' — ' + r.error);
      out.appendChild(li);
    });
  }
})();
