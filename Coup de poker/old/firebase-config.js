// admin/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ✅ Configuration Firebase (admin)
export const firebaseConfig = {
  apiKey: "AIzaSyB7e3Fk1Sc8S9ykq1v3xVktS5UOUDBfaaM",
  authDomain: "coup-de-poker-ccd99.firebaseapp.com",
  projectId: "coup-de-poker-ccd99",
  storageBucket: "gs://coup-de-poker-ccd99.firebasestorage.app",
  messagingSenderId: "464219267705",
  appId: "1:464219267705:web:b39a36857091a0c0392aa8"
};

// ✅ Initialisation unique
export const app = initializeApp(firebaseConfig);

// (Optionnel) ID courant d’aventure si tu veux un défaut côté admin
export const CURRENT_ADVENTURE_ID = "aventures-lyon-2025";
