# FinnBlu team dashboard: Firebase

The team dashboard (`/team/`) and the few things the app shares (anonymous daily
counts, opt-ins, feedback, the notice, the extra-categories list) live in one
Firebase project. Users' money records never go here: they stay in each user's
own Google Drive.

- `firestore.rules`: who may read or change what (owner `vgfintrack@gmail.com`,
  founders, employees, guests, and the app without sign-in).
- `firebase.json`: points the Firebase CLI at the rules (`firebase deploy --only firestore`).

## Switching it on (once)

Use the project the app already uses: **vgfintrack-11a9c**, signed in as
**vgfintrack@gmail.com**.

1. **Add Firebase to the project**: <https://console.firebase.google.com> → *Add project* →
   choose the existing Google Cloud project **vgfintrack-11a9c**. Google Analytics: not needed.
2. **Firestore**: *Build → Firestore Database → Create database* → **Production mode** →
   location **asia-south1 (Mumbai)** (closest to Bangladesh; cannot be changed later).
3. **Rules**: *Firestore → Rules* → replace everything with the contents of `firestore.rules` → *Publish*.
4. **Sign-in**: *Build → Authentication → Get started → Sign-in method → Google → Enable*,
   support email vgfintrack@gmail.com → *Save*.
5. **Allowed website**: *Authentication → Settings → Authorized domains → Add domain* →
   `vgfintrack.github.io` (later also the new domain).
6. **Web app**: *Project settings (gear) → Your apps → Web (</>)* → nickname `FinnBlu` →
   *Register*. Copy the `firebaseConfig` it shows (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId) and send it to whoever updates the code. These values are not secret.
7. In the code:
   - `team/config.js`: `export const firebaseConfig = { …the whole config… };`
   - `AmrPotli/js/config.js`: `export const firebaseProject = { projectId: '…', apiKey: '…' };`

Then open <https://vgfintrack.github.io/team/> and sign in with vgfintrack@gmail.com.
