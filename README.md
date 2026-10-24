# FinnBlu tests (kept apart from the app)

This branch (`testing`) holds only tests. It shares no history with `main`, is
never merged into it, and GitHub Pages does not publish it. The app and the
team dashboard contain no test code: the tests swap things in from the outside,
inside their own test browser.

**Only made-up data.** No real person's money, backup file or email belongs
here. `.gitignore` refuses `seed*.json`, backups and a `private/` folder.

## What runs

| Group | What | How |
|---|---|---|
| `app` | The app in a browser: start screens, setup, shop, purchases, baki, simple screen, voice, product limit, gifts, install, offline, layout on small phones, and team shops (owner, helper, a second phone, removing a helper) | Playwright, demo mode or the fake Google in `lib/fake-google.mjs` (sign-in, a Drive with owners and sharing, the file picker) |
| `site` | Every website page: links, images, both languages, day/night | Playwright |
| `firebase` | Firestore rules, the team dashboard, and what the app sends (counts, kinds of work, feedback, contact) | Local Firestore + Auth emulators (project `demo-amrpotli`), never the real project |

For the dashboard, the test serves Firebase files that connect to the local
emulators and lets a test sign in as anyone (`window.__login(email)`), only in
the test browser.

## Use

Put this branch next to the site checkout (the `main` branch):

```
git clone https://github.com/vgfintrack/vgfintrack.github.io            # main: the site
git -C vgfintrack.github.io worktree add ../amrpotli-tests testing      # this kit beside it
cd amrpotli-tests
npm install
npm test                 # everything
node run.mjs app         # or: site, firebase, or test names: node run.mjs shop prof
```

Needs Node 20+, Java 11+ (for the Firestore emulator) and Chromium for Playwright
(`npx playwright install chromium` if it is not there). If the site is somewhere
else: `AMRPOTLI_SITE=/path/to/site npm test`.

The runner serves the site on port 8090 (and a demo copy on 8091 for the offline
test), starts the emulators for the Firebase group, and reads the security rules
from the site's `firebase/firestore.rules`, so the tests always check the rules
as they are now. Screenshots land in `out/`.
