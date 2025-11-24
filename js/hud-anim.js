// main.js — version optimisée pour game.html

import { initializeMap } from "./map-init.js";
import { loadPOIs, updatePlayerPosition } from "./poi-manager.js";
import { initScore, updateScoreDisplay } from "./score-manager.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, getCurrentAdventureId } from "./firebase-config.js";
import { showConfirmationBanner } from "./confirmation-banner.js";

const db = getFirestore(app);
const auth = getAuth(app);

/* ============================================================
   ⚙️ CHARGEMENT CONFIGURATION D’AVENTURE
   ============================================================ */
async function loadAventureConfig() {
  const adventureId = getCurrentAdventureId();
  if (!adventureId) {
    console.warn("⚠️ Aucun ID d’aventure trouvé, retour à l’accueil.");
    window.location.href = "index.html";
    return null;
  }

  const ref = doc(db, "aventures", adventureId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.error("❌ Aventure introuvable dans Firestore :", adventureId);
    window.location.href = "index.html";
    return null;
  }

  const data = snap.data();
  window.aventureConfig = data;
  console.log("🎯 Aventure chargée :", data.nom || "(sans nom)");
  return data;
}

/* ============================================================
   🚪 QUITTER L’AVENTURE
   ============================================================ */
function confirmQuitAdventure() {
  showConfirmationBanner({
    message: "Voulez-vous vraiment quitter cette aventure ? Votre progression sera sauvegardée.",
    confirmText: "Oui, quitter",
    cancelText: "Non, rester",
    onConfirm: () => {
      window.location.href = "index.html";
    },
  });
}

/* ============================================================
   🔐 AUTHENTIFICATION + INITIALISATION DU JEU
   ============================================================ */
function checkAuthAndInit(aventure) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("⚠️ Aucun utilisateur connecté → redirection.");
      window.location.href = "identification.html";
      return;
    }

    console.log(`👤 Connecté : ${user.email}`);
    const name = localStorage.getItem("firstName") || "joueur";
    const welcomeEl = document.getElementById("playerName");
    if (welcomeEl) welcomeEl.textContent = name;

    // 🔖 Marquer ou créer la progression
    await markAventureAsStarted(user, aventure);

    // 🗺️ Initialisation carte
    initializeMap();

    // 💯 Initialisation score (synchro auto locale + Firestore)
    await initScore();
    updateScoreDisplay();

    // 📍 Activation géolocalisation continue
    startGeolocationWatcher();

    // 🎯 Chargement initial des POI
    await loadPOIs();

    // 🔁 Rafraîchit les POI périodiquement
    setInterval(loadPOIs, 20000);

    console.log("🚀 Aventure prête !");
  });
}

/* ============================================================
   🧩 PROGRESSION DU JOUEUR
   ============================================================ */
async function markAventureAsStarted(user, aventure) {
  const adventureId = getCurrentAdventureId();
  const ref = doc(db, "progress", `${user.uid}_${adventureId}`);
  const snap = await getDoc(ref);
  const now = serverTimestamp();

  if (!snap.exists()) {
    await setDoc(ref, {
      userId: user.uid,
      aventureId: adventureId,
      nomAventure: aventure.nom,
      ville: aventure.ville || "",
      pays: aventure.pays || "",
      totalPOI: 0,
      poiCompleted: 0,
      score: 0,
      status: "in_progress",
      startedAt: now,
      lastUpdate: now,
      completedAt: null,
    });
    console.log("🆕 Progression créée pour", user.uid);
  } else {
    await updateDoc(ref, { lastUpdate: now });
    console.log("ℹ️ Progression existante actualisée.");
  }
}

/* ============================================================
   🛰️ GÉOLOCALISATION CONTINUE
   ============================================================ */
function startGeolocationWatcher() {
  if (!navigator.geolocation) {
    console.warn("❌ Géolocalisation non supportée.");
    return;
  }

  let lastPos = null;

  const watcher = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const currentPos = { lat: latitude, lng: longitude };

      // 🔁 Mise à jour position joueur si changement significatif
      if (
        !lastPos ||
        Math.abs(lastPos.lat - currentPos.lat) > 0.0001 ||
        Math.abs(lastPos.lng - currentPos.lng) > 0.0001
      ) {
        lastPos = currentPos;
        updatePlayerPosition(currentPos);
      }
    },
    (err) => console.error("⚠️ Erreur géolocalisation :", err.message),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );

  window.geoWatcherId = watcher;
}

/* ============================================================
   🚀 INITIALISATION GLOBALE
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const aventure = await loadAventureConfig();
    if (!aventure) return;

    // Bouton Quitter
    const quitBtn = document.getElementById("quitButton");
    if (quitBtn) quitBtn.addEventListener("click", confirmQuitAdventure);

    // Authentification + setup complet
    checkAuthAndInit(aventure);
  } catch (err) {
    console.error("💥 Erreur d’initialisation :", err);
  }
});
