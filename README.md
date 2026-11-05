# My Finance Planner

A private, offline personal finance planner for one UK household. It organises monthly income and bills, plans debt repayment (minimum, snowball, avalanche or your own priority order), suggests savings and discretionary spending budgets, and shows exactly how much is **safe to spend** each month — with an estimated debt-free date.

- Vanilla HTML, CSS and JavaScript. No frameworks, build tools, servers, accounts or paid services.
- Works by opening `index.html` directly, and on GitHub Pages (all paths are relative).
- GBP (£), British English, dates as DD/MM/YYYY.
- Data stays in your browser (`localStorage`). Nothing is transmitted — a Content Security Policy blocks all network connections.

---

## Quick start

1. Download and unzip the project.
2. Double-click `index.html` (Chrome, Edge, Firefox or Safari).
3. Either click **Try with example data**, or start with **Add income**, **Add a bill** and **Add a debt**.
4. Click **Backup data** regularly and keep the JSON file somewhere safe.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g. `my-finance-planner`).
2. Upload every file and folder from this project to the repository root (drag-and-drop in the GitHub web interface works), keeping the `js/` and `tests/` folders.
3. In the repository go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After a minute the site is live at `https://<your-username>.github.io/my-finance-planner/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files exactly as they are.

> Your data is stored per browser **and per address**. Data entered on `file:///…/index.html` is separate from data entered on your GitHub Pages URL. Use **Backup data** on one and **Restore from backup** on the other to move it.

## Folder structure

```
my-finance-planner/
├── index.html          App shell, navigation, dialog container, CSP
├── style.css           Design system (tokens, components, responsive layout)
├── app.js              User interface: pages, forms, dialogs, actions
├── js/
│   ├── engine.js       Calculation engine (pure functions, also runs in Node)
│   ├── store.js        Data model, validation, schema versioning, persistence, import/export
│   └── sample.js       Example household data
├── tests/
│   ├── engine.test.js  Engine tests (Node and browser)
│   └── index.html      Browser test runner
├── README.md
├── .gitignore
└── .nojekyll
```

## Using the app each month

1. **Open the app.** The current month is selected automatically. Use ‹ › or the calendar to visit past and future months.
2. **Monthly check-in.** At the start of each month you are asked to confirm income. Regular income is offered as an editable suggestion — it is *never* counted until you confirm it.
3. **Recurring bills and active debts load automatically** — nothing needs re-entering.
4. **Unpaid obligations** are listed with due dates; overdue items are flagged.
5. Debt payments, savings and spending budgets are recalculated, the repayment schedule is updated, and the **safe-to-spend** amount is shown.
6. During the month, record debt payments, savings deposits and spending. Mark bills as paid.

## How the numbers are calculated

### Safe to spend

```
  Confirmed income
− Essential (fixed) expenses
− Minimum debt payments (contractual, never reduced)
− Additional debt payments (recommended or your figure)
− Savings contribution (recommended or your figure)
− Financial buffer
= Safe-to-spend allowance   (never shown below £0 — a shortfall is shown instead)
```

The dashboard expands this calculation under **How this was calculated**. If income cannot cover obligations, the app shows the shortfall and lists, in due-date order, which obligations cannot be fully funded.

### Recommendations (deterministic, rule-based)

1. **Surplus** = income − essentials − minimum payments − buffer − *protected living reserve*. The reserve is the larger of your *minimum monthly living allowance* and the sum of your essential category minimums (after subtracting anything already entered as a fixed expense, so nothing is counted twice).
2. The surplus is split according to your **savings approach**:

   | Approach | Offered to savings (capped by your monthly target) | Of the rest, to extra debt payments |
   |---|---|---|
   | Conservative | 60% | 60% |
   | Balanced | 35% | 75% |
   | Debt-focused | 10% | 90% |

   Whatever is left is added to spending money. With **Emergency fund first**, the savings share drops to the debt-focused level once the emergency fund goal is reached. If there is no surplus, £0 savings and £0 extra payments are suggested.
3. Extra debt money is applied by strategy: **avalanche** (highest current interest rate first), **snowball** (smallest balance first) or **your priority** (priority 1 first). Extra payments are capped at what is actually owed. Money freed when a debt is cleared becomes surplus in later months and is split again by the same rules.
4. Every suggestion can be overridden for a month, or set as a default for all future months. **Reset to recommended** restores the engine's figure. The app never silently changes a figure you entered — if it exceeds available money, it warns you; if it exceeds what is owed, only the owed amount is applied and a note is shown.

### Discretionary spending allocation

Safe-to-spend money is split into seven editable categories (groceries & food, transport, health & wellbeing, personal care, leisure & entertainment, shopping, miscellaneous):

1. Minimum amounts for essentials are funded first (groceries → transport → health), then any optional minimums.
2. Categories are topped up towards weighted targets — essentials before optional ones. Weights come from your **average spending over the last 2–3 recorded months**; until that history exists, your **adjustable percentage split** is used.
3. Any remainder is shared by the same weights, so the whole allowance is allocated.

You can drag the slider or type a figure for any category. Each category shows suggested vs your budget, spent, remaining, percentage used and a per-day figure; the page shows remaining per week and per day. Overspending triggers a suggestion to move money from other discretionary categories only (debts, bills, savings and the buffer are never touched). **Rebalance my budget** re-spreads only the money left, using the days remaining. Unspent money from last month is **carried forward only if you approve it**.

### Interest convention and assumptions

- **Monthly interest = balance at the start of the month × APR ÷ 12**, rounded to the nearest penny, added before that month's payment. This is a simple estimate; most UK lenders calculate interest daily, may compound differently, and may charge fees. Projections are therefore estimates, not guaranteed outcomes.
- Fees, charges, promotional balance-transfer fees and changes in rates are not modelled.
- During an **interest-free period** (up to and including the month you enter) no interest is charged.
- All payments in a month are treated as made at the same point, after interest. Due dates decide ordering for overdue checks and shortfall funding, not interest.
- A debt's **balance** applies from the start of its **“balance as at” month**. Recorded payments from that month onwards reduce it. To correct drift from your statement, edit the debt and enter the statement balance and month (earlier payments remain in history but no longer reduce the balance).
- Balances never go below £0. A payment larger than the amount owed is recorded and shown as an overpayment.
- Savings interest is not modelled. Withdrawals reduce the savings balance but are not added to safe-to-spend.

### Actual vs scheduled vs projected

- **Past months** use only what you recorded: confirmed income, payments and deposits. Projections never become actual payments.
- **The current month** uses, for each debt, the higher of what you have recorded and what is planned — so a payment is never counted twice and the rest of the plan stays visible.
- **Future months** use confirmed income if you entered it in advance; otherwise a clearly labelled assumption (latest confirmed income, or your own figure for that month). Assumptions are never stored as income.
- The current month's forecast is snapshotted as you go, so past months can show **forecast at the time vs actual** in the spreadsheet.
- Debt repayments live only under Debts, so they are never counted as both an expense and a repayment. Recurring expenses are stored once and applied to each month in range, so regenerating projections never duplicates them. Changing a recurring bill can apply **from this month onwards** (history keeps the old amount) or correct **all months**.

### Projection limits

The spreadsheet runs until every debt is repaid (and at least 12 months ahead). If repayment is impossible under current assumptions — for example a minimum payment that does not cover interest — it stops at the **planning horizon** (default 120 months, adjustable 12–600), explains why, and flags the debts that will never amortise.

## Data, backups and privacy

- Data is stored in this browser's `localStorage` under the key `myFinancePlanner.data`, as structured JSON with a **schema version**. All money is stored as **integer pence** to avoid rounding errors.
- **localStorage is browser- and device-specific.** It can be lost if you clear browsing data, use private/incognito windows, or change browser or device. **Back up regularly** (the app reminds you after 30 days).
- **Backup data** downloads a JSON file. **Restore from backup** validates it (app identifier, schema version, every record and amount), reports any skipped malformed records, and asks for confirmation before replacing existing data. Files from a newer schema version are rejected.
- If saved data is ever unreadable, it is preserved under a separate key and the app starts fresh with a warning.
- All text you enter is HTML-escaped before display. CSV exports protect against spreadsheet formula injection (cells starting with `=`, `+`, `-`, `@` are prefixed with `'`), use plain numeric GBP values with two decimals, and include a UTF-8 BOM so the £ sign displays correctly in Excel.
- No analytics, cookies, trackers, external fonts or CDNs. No cloud synchronisation.

## Tests

The calculation engine has dependency-free tests that run in Node.js **or** in the browser.

```bash
node tests/engine.test.js
```

or open `tests/index.html` (also linked from Settings).

### Test results (05/11/2026)

**Engine: 36 of 36 tests passed** in Node.js 22 and in Chrome. Coverage:

| Calculation rules | Required scenarios |
|---|---|
| Money parsing and GBP / DD/MM/YYYY formatting | 1 No debts |
| Monthly interest convention | 2 Five debts, different rates (avalanche ≤ snowball < minimum interest) |
| Zero-interest repayment | 3 Income changing monthly + labelled assumptions |
| Final partial repayment, no overpayment | 4 Cannot cover minimum payments (shortfall, minimums unchanged) |
| Interest-free periods | 5 Additional payments |
| Month-to-month rollover | 6 Changing strategy |
| Snowball and avalanche allocation | 7 Changing savings targets (and overrides) |
| Savings accumulation | 8 Paying off early |
| No double counting; recurring expenses once | 9 Importing a backup (+ malformed, invalid and newer files rejected) |
| Projections never mutate actuals | 11 Zero income |
| Recalculation after manual overrides | 12 Payments that would exceed balances |
| Different due dates (funding order) | 13 Debt that never amortises (horizon stop) |
| Spending allocation: percentages, essentials first, no double counting, history, tracking, per-day/week, reallocation, rebalance, carry-forward | 14 Overdue obligations |
| CSV injection, numeric values, BOM | 15 Changing a future month's income assumption |

**Scenario 10 (mobile)** and the interface were verified in headless Chrome at 1440 × 1000 (desktop) and 390 × 844 (mobile): every page rendered without console errors or horizontal overflow, and an end-to-end run covered adding income, validation errors, HTML-injection text displayed safely, adding a debt, recording a payment, over-allocation warning and reset, spending entry, category budget edit, overspend reallocation, rebalance, spreadsheet row expansion and future-month edit, CSV export, JSON backup → erase → restore (identical data), rejection of an invalid backup, the month calendar and light mode.

## Known limitations

- Interest is an estimate (monthly APR ÷ 12 on the opening balance). It will differ slightly from lenders' daily calculations; update balances from statements periodically.
- Fees, penalty charges, rate changes and balance transfers are not modelled. Interest-free periods are supported; avalanche ordering uses the rate charged in that month.
- Income is monthly. Weekly or four-weekly pay should be entered as the amount actually received in each calendar month.
- Data is not synchronised between devices or browsers; use backup and restore.
- The planner covers one person or household; it is not a substitute for regulated financial advice. If you are struggling with debt, free help is available from StepChange, National Debtline and Citizens Advice.
- Native month pickers vary by browser (Firefox desktop shows a text box — type `YYYY-MM`). Dates are always typed and shown as DD/MM/YYYY.

## Licence

Personal use. Adapt freely.
