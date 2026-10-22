# Money Tracker

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `vendor/`
- **Hosting:** GitHub Pages at <https://vgfintrack.github.io>. Every push to `main` goes live in about a minute.
- **Login:** Google sign-in, **only `vgfintrack@gmail.com`** (set in `js/firebase-config.js` and enforced in `firestore.rules`)
- **Data:** Cloud Firestore (project `vgfintrack-11a9c`), works offline and syncs later

No financial data is stored in this repository, so it is safe for it to be public.

## One-time setup

### 1. GitHub Pages
1. Repo **Settings → General → Danger Zone → Change visibility → Public**.
2. Repo **Settings → Pages**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`, **Save**.

### 2. Firebase (`vgfintrack-11a9c`, free Spark plan)
1. **Authentication → Sign-in method → Google → Enable.**
2. **Authentication → Settings → Authorized domains → Add domain:** `vgfintrack.github.io`
3. **Firestore → Rules:** paste the contents of `firestore.rules` and **Publish**.
   Do this again whenever `firestore.rules` changes.

### 3. Bring in your data
Open <https://vgfintrack.github.io>, sign in as vgfintrack@gmail.com, choose **Import backup file**, and
pick `omayer-money-data.json`. Keep that file private and never commit it.

### 4. Put it on your phone
Open the site in Chrome → menu → **Add to Home screen**. It opens like a normal app.

## Using it

| You did this | Type | Account | To |
|---|---|---|---|
| Got paid (tuition, scholarship) | Income | where it landed | |
| Bought something | Expense | where you paid from | |
| bKash cash-out, ATM withdrawal | Transfer | Bank / bKash | Cash in Hand |
| Deposit to the land fund | Transfer | Bank | Friends Land Fund |
| Lent money to a friend | Transfer | Bank / Cash | Lent to … (a *Lend* account) |
| Friend paid you back | Transfer | Lent to … | Bank / Cash |
| Gave money to family | Expense, category *Family Support* | Bank | |
| Someone holds savings for you | Transfer | Bank | their account (add it as *Liquid* or *Investment*) |

Account types:
- **Liquid**: money you can spend now (bank, cash, bKash)
- **Lend**: money others owe you
- **Investment**: fund, cow, savings. Set *Current value* to revalue it.
- **Debt**: money you owe

**Setup → Download backup** saves everything to a JSON file. Do this now and then.

## Run locally
```sh
npx http-server . -p 8080
```
