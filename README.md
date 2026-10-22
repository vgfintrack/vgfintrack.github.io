# Money Tracker

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `vendor/`
- **Hosting:** Firebase Hosting at <https://vgfintrack-11a9c.web.app>, deployed by GitHub Actions on every push to `main`
- **Login:** Google sign-in, **only `vgfintrack@gmail.com`** (set in `js/firebase-config.js` and enforced in `firestore.rules`)
- **Data:** Cloud Firestore, works offline and syncs later

No financial data is stored in this repository.

Until `js/firebase-config.js` is filled in, the app runs in **demo mode** and keeps
data in the browser only.

## One-time setup

### 1. Firebase project (`vgfintrack-11a9c`, free Spark plan)
1. **Authentication → Sign-in method → Google → Enable.**
2. **Firestore Database → Create database** → `asia-south1` (Mumbai) → **production mode**.
3. **Project settings → Your apps → Web app** config goes in `js/firebase-config.js`.
4. Firestore rules are deployed automatically from `firestore.rules`.

### 2. Let GitHub deploy it
1. Firebase console → ⚙ **Project settings → Service accounts → Generate new private key**.
   A JSON file downloads.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   name `FIREBASE_SERVICE_ACCOUNT`, value = the whole contents of that file.
   Then delete the downloaded file.
3. Push to `main`, or run **Actions → Deploy to Firebase → Run workflow**.

### 3. Bring in your data
Open <https://vgfintrack-11a9c.web.app>, sign in as vgfintrack@gmail.com, choose **Import backup file**, and
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
