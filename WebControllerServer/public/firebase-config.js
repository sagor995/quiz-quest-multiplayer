// Safe default Firebase config for public repositories.
// For real values, create firebase-config.local.js (ignored by git).
if (!window.FIREBASE_CONFIG) {
  window.FIREBASE_CONFIG = {
    apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
    authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
    databaseURL: "REPLACE_WITH_FIREBASE_DATABASE_URL",
    projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
    appId: "REPLACE_WITH_FIREBASE_APP_ID",
    messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
    storageBucket: "REPLACE_WITH_FIREBASE_STORAGE_BUCKET"
  };
}
