// Paste your Firebase web app config here (Firebase console -> Project settings
// -> Your apps -> Web app -> SDK setup and configuration -> Config).
// These values are not secret: access is protected by firestore.rules.
//
// While apiKey is still "REPLACE_ME" the app runs in demo mode and keeps data
// in this browser only.
export const firebaseConfig = {
  apiKey: 'AIzaSyA72Snb52RhFTMfcwm5Me3GJ6WMf0GEsrA',
  authDomain: 'vgfintrack-11a9c.firebaseapp.com',
  projectId: 'vgfintrack-11a9c',
  storageBucket: 'vgfintrack-11a9c.firebasestorage.app',
  messagingSenderId: '500818833749',
  appId: '1:500818833749:web:0b08dfb75936072e173fdc',
};

// The only Google account allowed to use the app. Anyone else is signed out
// immediately, and firestore.rules blocks them from the data as well.
export const allowedEmail = 'vgfintrack@gmail.com';
