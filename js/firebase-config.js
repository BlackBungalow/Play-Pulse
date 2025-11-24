// ============================================================
// 🔥 Configuration et initialisation Firebase - PlayPulse (universelle)
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/**
 * ⚙️ Configuration Firebase
 * ✅ Correction : storageBucket pointant sur .firebasestorage.app
 */
const firebaseConfig = {
  apiKey: "AIzaSyB7e3Fk1Sc8S9ykq1v3xVktS5UOUDBfaaM",
  authDomain: "coup-de-poker-ccd99.firebaseapp.com",
  projectId: "coup-de-poker-ccd99",
  storageBucket: "coup-de-poker-ccd99.firebasestorage.app", // ✅ corrigé ici
  messagingSenderId: "464219267705",
  appId: "1:464219267705:web:b39a36857091a0c0392aa8"
};

/**
 * 🚀 Initialisation unique (anti “duplicate-app”)
 */
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ✅ Forçage explicite sur ton vrai bucket
export const storage = getStorage(app, "gs://coup-de-poker-ccd99.firebasestorage.app");

console.log("🎯 Firebase initialisé sur bucket :", storage.bucket);

// ============================================================
// 🎯 Gestion de l’ID d’aventure actuelle (commun admin/joueur)
// ============================================================

let CURRENT_ADVENTURE_ID = null;

/**
 * 🔹 Définit l’ID d’aventure active
 */
export function setCurrentAdventureId(id) {
  if (!id) {
    console.warn("⚠️ Tentative d’enregistrement d’un ID d’aventure vide.");
    return;
  }

  CURRENT_ADVENTURE_ID = id;
  localStorage.setItem("CURRENT_ADVENTURE_ID", id);
  window.CURRENT_ADVENTURE_ID = id;
  console.log("🎯 Aventure définie :", id);
}

/**
 * 🔹 Récupère l’ID d’aventure active
 */
export function getCurrentAdventureId() {
  const fromUrl = new URLSearchParams(window.location.search).get("id");
  const fromMemory = CURRENT_ADVENTURE_ID;
  const fromStorage = localStorage.getItem("CURRENT_ADVENTURE_ID");

  const finalId = fromUrl || fromMemory || fromStorage;
  if (!finalId) {
    console.warn("⚠️ Aucun ID d’aventure trouvé (URL, mémoire ou localStorage).");
  }

  return finalId;
}

/**
 * 🔹 Nettoyage de l’ID courant
 */
export function clearAdventureId() {
  CURRENT_ADVENTURE_ID = null;
  localStorage.removeItem("CURRENT_ADVENTURE_ID");
  console.log("🧹 ID d’aventure effacé du stockage local.");
}

/**
 * 🔹 Raccourcis pratiques
 */
export const FIREBASE_SERVICES = { app, db, auth, storage };

/**
 * 🔹 Lecture rapide d’une aventure (utile à test-aventure ou jeu)
 */
export async function getAdventureById(id) {
  if (!id) return null;
  try {
    const ref = doc(db, "aventures", id);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    console.warn("⚠️ Aucune aventure trouvée pour l’ID :", id);
    return null;
  } catch (err) {
    console.error("❌ Erreur getAdventureById :", err);
    return null;
  }
}
