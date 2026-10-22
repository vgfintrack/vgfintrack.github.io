# Money Tracker

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `vendor/`
- **Hosting:** GitHub Pages at <https://vgfintrack.github.io>
- **Login:** Firebase Authentication (Google sign-in)
- **Data:** Cloud Firestore, private per user (`firestore.rules`), works offline and syncs later

No financial data is stored in this repository. It lives in your Firestore database,
which only your Google account can read.

Until `js/firebase-config.js` is filled in, the app runs in **demo mode** and keeps
data in the browser only.

## One-time setup

### 1. GitHub Pages
Repo **Settings → Pages → Build and deployment**: Source *Deploy from a branch*,
branch `main`, folder `/ (root)`. The site updates a minute after every push.

### 2. Firebase project (free Spark plan is enough)
1. <https://console.firebase.google.com> → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains → Add domain:** `vgfintrack.github.io`
4. **Build → Firestore Database → Create database** → location `asia-south1` (Mumbai)
   → **production mode**.
5. **Firestore → Rules:** replace everything with the contents of `firestore.rules`
   and click **Publish**. This makes each user's data visible to that user only.
6. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register an app.
   Copy the `firebaseConfig` values into `js/firebase-config.js` and push.

### 3. Bring in your data
Open <https://vgfintrack.github.io>, sign in with Google, choose **Import backup file**, and
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
