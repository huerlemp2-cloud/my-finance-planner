/*!
 * My Finance Planner — example data so the app can be explored before entering real figures.
 * Dates are generated relative to today. The current month's income is deliberately left
 * unconfirmed so the monthly check-in can be tried.
 */
(function (root) {
  'use strict';
  const E = root.MFP.Engine, Store = root.MFP.Store;

  function build(today) {
    today = today || new Date();
    const cur = E.monthKey(today);
    const m1 = E.addMonths(cur, -2), m2 = E.addMonths(cur, -1);
    const s = Store.defaultState();
    const id = Store.uid;
    const now = new Date().toISOString();

    const salary = { id: id(), description: 'Salary (Acme Logistics)', type: 'salary', amountPence: 215000, active: true };
    const uc = { id: id(), description: 'Child Benefit', type: 'benefits', amountPence: 10660, active: true };
    s.incomeSources = [salary, uc];

    const exp = function (description, category, amount, dueDay) {
      return { id: id(), description: description, amountPence: amount, category: category, dueDay: dueDay, recurring: true, startMonth: m1, endMonth: null, createdAt: now };
    };
    s.expenses = [
      exp('Rent', 'rent', 85000, 1), exp('Council Tax', 'council-tax', 14200, 1), exp('Electricity', 'electricity', 6800, 15),
      exp('Gas', 'gas', 5400, 15), exp('Water', 'water', 3800, 20), exp('Broadband', 'internet', 3000, 12),
      exp('Mobile phone', 'mobile', 1800, 8), exp('Streaming & music', 'subscriptions', 1600, 22)
    ];

    const debt = function (creditor, description, bal, aprBps, min, dueDay, extra) {
      return Object.assign({ id: id(), creditor: creditor, description: description, balancePence: bal, aprBps: aprBps, minPaymentPence: min, dueDay: dueDay, startMonth: m1, interestFreeUntil: null, contractEndDate: null, priority: null, notes: '', archived: false, createdAt: now }, extra || {});
    };
    s.debts = [
      debt('Barclaycard', 'Credit card', 240000, 2490, 7200, 18),
      debt('Klarna', 'Laptop — pay in instalments', 18000, 0, 6000, 5),
      debt('Black Horse', 'Car finance', 520000, 990, 18500, 1, { contractEndDate: E.addMonths(cur, 30) + '-01' }),
      debt('Lloyds', 'Arranged overdraft', 45000, 3990, 2500, 28),
      debt('Mum', 'Family loan', 80000, 0, 5000, 10, { notes: 'Flexible — no interest.' })
    ];

    const mo = function (m) { if (!s.months[m]) s.months[m] = Store.emptyMonth(); return s.months[m]; };
    [m1, m2].forEach(function (m, i) {
      const rec = mo(m);
      rec.income.push({ id: id(), description: salary.description, type: 'salary', amountPence: salary.amountPence, sourceId: salary.id });
      rec.income.push({ id: id(), description: uc.description, type: 'benefits', amountPence: uc.amountPence, sourceId: uc.id });
      s.expenses.forEach(function (e) { rec.expenseStatus[e.id] = { paid: true, date: E.dueDateFor(m, e.dueDay) }; });
      s.debts.forEach(function (d) {
        s.debtPayments.push({ id: id(), debtId: d.id, date: E.dueDateFor(m, d.dueDay), month: m, amountPence: d.minPaymentPence, kind: 'regular', note: '' });
      });
      if (i === 1) s.debtPayments.push({ id: id(), debtId: s.debts[3].id, date: m + '-20', month: m, amountPence: 10000, kind: 'extra', note: 'Overtime' });
      const spend = function (day, cat, desc, amt) { rec.discretionarySpend.push({ id: id(), date: m + '-' + String(day).padStart(2, '0'), category: cat, description: desc, amountPence: amt }); };
      spend(3, 'groceries', 'Weekly shop', 6200 + i * 300); spend(10, 'groceries', 'Weekly shop', 5850); spend(17, 'groceries', 'Weekly shop', 6400); spend(24, 'groceries', 'Weekly shop', 5900);
      spend(2, 'transport', 'Bus pass', 6800); spend(14, 'transport', 'Train to Leeds', 2450);
      spend(8, 'leisure', 'Cinema', 2200); spend(19, 'leisure', 'Meal out', 3800 - i * 900);
      spend(12, 'personal', 'Haircut', 1800); spend(21, 'shopping', 'Winter jacket', i ? 0 + 4500 : 2600);
      spend(15, 'health', 'Prescription', 990); spend(26, 'misc', 'Birthday present', 2500);
      rec.savingsDeposits.push({ id: id(), date: m + '-28', amountPence: 5000, note: 'Monthly transfer' });
    });

    s.savings = { targetMonthlyPence: 10000, emergencyGoalPence: 150000, openingBalancePence: 30000, baselineMonth: m1, priority: 'emergency' };
    s.settings.bufferPence = 5000;
    s.settings.minLivingAllowancePence = 30000;
    s.settings.spending.mins.groceries = 22000;
    s.settings.spending.mins.transport = 8000;
    s.settings.strategy = 'avalanche';
    return s;
  }

  root.MFP.Sample = { build: build };
})(typeof self !== 'undefined' ? self : this);
