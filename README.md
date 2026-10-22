# AmrPotli · আমার পোটলি

*"My money pouch"*: a personal ledger named after the cloth potli Bengali families kept their savings in.

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `vendor/`
- **Hosting:** GitHub Pages. The app is in `AmrPotli/` and lives at <https://vgfintrack.github.io/AmrPotli/>;
  the repo root (`index.html`) is the vgfintrack home page. Every push to `main` goes live in about a minute.
- **Sign-in:** anyone can sign in with their own Google account
- **Languages:** English and বাংলা (Setup → Language, or the switch on the sign-in screen). Bangla text lives in
  `AmrPotli/js/i18n-bn.js`, keyed by the English phrase; documents in Reports stay in English.
- **Storage:** each user's data is one file in **their own Google Drive app data folder**
  (`drive.appdata` scope), plus a local copy in their browser for speed and offline use

### Privacy model
- There is no server or database. The site's owner never receives anyone's data.
- The app data folder is hidden from the user's Drive file list and readable only by this app's OAuth client.
- Signing out deletes the local copy from that browser. Signing in on any device downloads it again.
- Edits from several devices are merged per item (newest `updatedAt` wins; deletes are kept as tombstones).
- See `privacy.html`.

Until `AmrPotli/js/config.js` has a real client ID, the app runs in **demo mode** and keeps data in the browser only.

## One-time setup (Google Cloud project `vgfintrack-11a9c`)

1. **Enable the Drive API:** <https://console.cloud.google.com/apis/library/drive.googleapis.com?project=vgfintrack-11a9c> → **Enable**.
2. **Google Auth Platform → Branding:** app name `AmrPotli`, support email, home page
   `https://vgfintrack.github.io/AmrPotli/`, privacy policy `https://vgfintrack.github.io/AmrPotli/privacy.html`,
   authorised domain `vgfintrack.github.io`.
3. **Audience:** user type **External** → **Publish app** (so anyone can sign in, not just test users).
4. **Data access → Add or remove scopes:** `.../auth/drive.appdata`, plus `openid`, `email`, `profile`.
5. **Clients → Create client → Web application:** authorised JavaScript origin `https://vgfintrack.github.io`
   (add `http://localhost:8080` for local testing). Put the client ID in `AmrPotli/js/config.js`.

## First use
Open <https://vgfintrack.github.io/AmrPotli/>, sign in, then **Import backup file** or **Start fresh**.
On a phone: Chrome → ⋮ → **Add to Home screen**.

## Using it

| You did this | Type | Account | To |
|---|---|---|---|
| Got paid (tuition, scholarship) | Income | where it landed | |
| Bought something | Expense | where you paid from | |
| bKash cash-out, ATM withdrawal | Transfer | Bank / bKash | Cash in Hand |
| Deposit to the land fund | Transfer | Bank | Friends Land Fund |
| Borrowed money (person, bank, bKash) | **Loan → I borrowed** | lender (add new in the form) | where it landed; optional due date |
| Repaid a loan | **Loan → I repaid** | lender | paid from; interest counts as spending (*Loan Interest*) |
| Lent money to a friend | **Loan → I lent** | the friend | paid from; optional due date |
| Friend paid you back | **Loan → Someone paid me back** | the friend | received in |
| bKash cash-out / bank transfer fee | Transfer or Expense + **Service charge** | | counted as spending (*Service Charges*) |
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
npx http-server . -p 8080   # then open http://localhost:8080/AmrPotli/
```
