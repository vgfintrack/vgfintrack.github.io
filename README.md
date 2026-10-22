# Money Tracker

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `public/vendor/`
- **Login:** Firebase Authentication (Google sign-in)
- **Data:** Cloud Firestore, private per user (`firestore.rules`), works offline and syncs later
- **Hosting:** Firebase Hosting, deployed by GitHub Actions on every push to `main`

Until `public/js/firebase-config.js` is filled in, the app runs in **demo mode** and keeps
data in the browser only.

## One-time setup

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics is not needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Build → Firestore Database → Create database** → choose a location close to you
   (e.g. `asia-south1`) → start in **production mode**.
4. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register an app
   (no need to tick Hosting here). Copy the `firebaseConfig` values into
   `public/js/firebase-config.js`.
5. Put your project ID in `.firebaserc` instead of `REPLACE_WITH_FIREBASE_PROJECT_ID`.

### 2. Let GitHub deploy it
1. In Google Cloud console → **IAM & Admin → Service Accounts** (same project) →
   **Create service account**, name it `github-deploy`, and give it these roles:
   *Firebase Hosting Admin*, *Firebase Rules Admin*, *Service Account User*, *API Keys Viewer*.
2. Open the account → **Keys → Add key → JSON**. A file downloads.
3. In GitHub → this repo → **Settings → Secrets and variables → Actions → New repository secret**:
   name `FIREBASE_SERVICE_ACCOUNT`, value = the whole contents of that JSON file.
   Then delete the downloaded file from your computer.
4. Push to `main` (or run the workflow manually from the **Actions** tab). The site goes live at
   `https://<project-id>.web.app`.

### 3. Bring in your data
Open the site, sign in with Google, choose **Import backup file**, and pick your
`omayer-money-data.json`. That file holds your personal data and is **not** stored in this repo.

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
npx http-server public -p 8080
```
