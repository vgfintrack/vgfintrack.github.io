# Money Tracker

A personal finance web app: log income, expenses and transfers, see monthly and weekly
dashboards, budgets, savings goal, investments and net worth. Amounts are in BDT and weeks
run Saturday to Friday.

- **Frontend:** plain HTML/CSS/JS (no build step), Chart.js bundled in `vendor/`
- **Hosting:** GitHub Pages at <https://vgfintrack.github.io>. Every push to `main` goes live in about a minute.
- **Sign-in:** anyone can sign in with their own Google account
- **Storage:** each user's data is one file in **their own Google Drive app data folder**
  (`drive.appdata` scope), plus a local copy in their browser for speed and offline use

### Privacy model
- There is no server or database. The site's owner never receives anyone's data.
- The app data folder is hidden from the user's Drive file list and readable only by this app's OAuth client.
- Signing out deletes the local copy from that browser. Signing in on any device downloads it again.
- Edits from several devices are merged per item (newest `updatedAt` wins; deletes are kept as tombstones).
- See `privacy.html`.

Until `js/config.js` has a real client ID, the app runs in **demo mode** and keeps data in the browser only.

## One-time setup (Google Cloud project `vgfintrack-11a9c`)

1. **Enable the Drive API:** <https://console.cloud.google.com/apis/library/drive.googleapis.com?project=vgfintrack-11a9c> → **Enable**.
2. **Google Auth Platform → Branding:** app name `Money Tracker`, support email, home page
   `https://vgfintrack.github.io`, privacy policy `https://vgfintrack.github.io/privacy.html`,
   authorised domain `vgfintrack.github.io`.
3. **Audience:** user type **External** → **Publish app** (so anyone can sign in, not just test users).
4. **Data access → Add or remove scopes:** `.../auth/drive.appdata`, plus `openid`, `email`, `profile`.
5. **Clients → Create client → Web application:** authorised JavaScript origin `https://vgfintrack.github.io`
   (add `http://localhost:8080` for local testing). Put the client ID in `js/config.js`.

## First use
Open <https://vgfintrack.github.io>, sign in, then **Import backup file** or **Start fresh**.
On a phone: Chrome → ⋮ → **Add to Home screen**.

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
