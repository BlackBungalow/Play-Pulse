// js/adventure-loader.js
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { app, getCurrentAdventureId } from "./firebase-config.js";
import { listenForMediaValidation } from "./challenge-manager.js";

const db = getFirestore(app);

/**
 * 🎯 Charge les infos complètes d’une aventure
 * → Sauvegarde dans window.aventureConfig
 * → Met à jour l’interface (titre + panneau d’infos)
 */
export async function loadAdventureConfig() {
  const aventureId = getCurrentAdventureId();
  console.log("🧭 Chargement de l’aventure :", aventureId);

  if (!aventureId || typeof aventureId !== "string" || aventureId.length < 5) {
    console.warn("⚠️ Aucun ID d’aventure valide détecté. Retour à l’accueil...");
    window.location.href = "index.html";
    return null;
  }

  try {
    // 🔹 Récupère le document principal
    const docRef = doc(db, "aventures", aventureId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      console.error("❌ Aventure introuvable dans Firestore :", aventureId);
      alert("Cette aventure n’existe pas ou a été supprimée.");
      window.location.href = "index.html";
      return null;
    }

    const data = snap.data();
    data.id = aventureId;

    // 🔹 Normalisation des dates (Firestore Timestamp → JS Date)
    data.dispoDebut = normalizeDate(data.dispoDebut);
    data.dispoFin = normalizeDate(data.dispoFin);

    // 🔹 Récupération du nombre total de POI
    let poisCount = 0;
    try {
      const poisSnap = await getDocs(collection(db, "aventures", aventureId, "pois"));
      poisCount = poisSnap.size;
    } catch (err) {
      console.warn("⚠️ Erreur lors du chargement des POI :", err.message);
    }
    data.totalPOI = poisCount;

    // ✅ Mise à disposition globale
    window.aventureConfig = data;
    localStorage.setItem("CURRENT_ADVENTURE_NAME", data.nom || "");
    console.log("✅ Aventure chargée :", data.nom || "Sans nom");
    console.table({
      Ville: data.ville || "—",
      Période: `${formatDate(data.dispoDebut)} → ${formatDate(data.dispoFin)}`,
      Points: poisCount
    });
   

    // =========================================================
    // 🎨 Mise à jour dynamique de l’interface
    // =========================================================
    const titleEl = document.getElementById("aventureTitle");
    if (titleEl) titleEl.textContent = data.nom || "Aventure";

    const infoPanel = document.getElementById("aventureInfo");
    if (infoPanel) {
      const city = data.ville || "Ville non précisée";
      const debut = formatDate(data.dispoDebut);
      const fin = formatDate(data.dispoFin);

      infoPanel.innerHTML = `
        <p><strong>📍 Ville :</strong> ${city}</p>
        <p><strong>🗓️ Période :</strong> du ${debut} au ${fin}</p>
        <p><strong>🎯 Points d’intérêt :</strong> ${poisCount}</p>
      `;
    }

    // 🔔 Affichage si l’aventure est expirée
    if (data.dispoFin && new Date() > data.dispoFin) {
      const notif = document.getElementById("notification");
      if (notif) {
        notif.textContent = "⏰ Cette aventure n’est plus disponible.";
        notif.classList.remove("hidden");
      }
    }

    return data;

  } catch (err) {
    console.error("💥 Erreur lors du chargement de l’aventure :", err);
    alert("Une erreur est survenue lors du chargement de cette aventure.");
    return null;
  }
}

/**
 * 🧩 Convertit un champ Firestore en Date JS sûre
 */
function normalizeDate(value) {
  if (!value) return null;
  try {
    if (value.toDate) return value.toDate();
    return new Date(value);
  } catch {
    return null;
  }
}

/**
 * 📅 Formate une date de manière lisible (fr-FR)
 */
function formatDate(ts) {
  if (!ts) return "—";
  try {
    return ts.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}
