// Google OAuth client ID for this site (Google Cloud console -> Google Auth
// Platform -> Clients -> Web application). Not a secret: it only identifies
// the app to Google's sign-in screen.
//
// While it still starts with "REPLACE" the app runs in demo mode and keeps
// data in this browser only.
export const googleClientId = '500818833749-s37cmbrjlrdeon2a44idf5ibhi70d5sl.apps.googleusercontent.com';

// The AmrPotli team's Firebase project (team/config.js has the same one).
// The app only reads the public notice and the scrambled list of people who
// get more categories, and sends anonymous daily counts, plus contact details
// or feedback when the user chooses to send them. null = not connected yet.
export const firebaseProject = { projectId: 'vgfintrack-11a9c', apiKey: 'AIzaSyA72Snb52RhFTMfcwm5Me3GJ6WMf0GEsrA' };
