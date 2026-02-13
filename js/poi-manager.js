// poi-manager.js — version stable v4.8
// 🔹 Gère l’affichage, la proximité, les états et la désactivation des POI (verrouillage persistant)

import mapboxgl from "https://cdn.skypack.dev/mapbox-gl";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, getCurrentAdventureId } from "./firebase-config.js";
import { showChallenge, listenForMediaValidation } from "./challenge-manager.js";
import { showFloatingPopup } from "./challenge-manager.js"; // ✅ Import ajouté pour affichage message joueur

let poiMarkers = [];
let poiLabels = [];
let playerPosition = null;
let lastLoadedPois = [];

/* -------------------------------------------------------------
   📏 Distance Haversine (en mètres)
------------------------------------------------------------- */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* -------------------------------------------------------------
   🔁 Chargement et affichage des POI
------------------------------------------------------------- */
export async function loadPOIs() {
  try {
    const db = getFirestore(app);
    const auth = getAuth(app);
    const adventureId = getCurrentAdventureId();
    const user = auth.currentUser;

    // 🎧 Écoute des validations / refus admin pour les médias du joueur
    if (user && adventureId) {
      listenForMediaValidation(
        adventureId,
        user.uid,
        (poiId, validated, points) => {
          // ✅ Mise à jour visuelle du POI
          const marker = poiMarkers.find(m => m.getElement().dataset.id === poiId);
          if (marker) {
            const icon = marker.getElement().querySelector(".poi-icon");
            if (icon) {
              icon.classList.remove("poi-default", "pulse");
              icon.classList.add(validated ? "poi-won" : "poi-lost");
              icon.style.opacity = "0.85";
              icon.style.cursor = "not-allowed";
            }
          }

          // ✅ Label de points
          const existingLabel = poiLabels.find(l => l.getElement().dataset?.poiId === poiId);
          if (existingLabel) {
            existingLabel.remove();
            poiLabels = poiLabels.filter(l => l !== existingLabel);
          }
          const label = document.createElement("div");
          label.className = "poi-label " + (validated ? "success" : "fail");
          label.dataset.poiId = poiId;
          label.textContent = validated ? `+${points} pts` : "0 pt - Refusé";
          const labelMarker = new mapboxgl.Marker({
            element: label,
            offset: [0, -44],
          })
            .setLngLat(marker?.getLngLat())
            .addTo(window.cityMap);
          poiLabels.push(labelMarker);
        },
        (message, type) => {
          // ✅ Notification joueur
          showFloatingPopup(message, type || "info");
        }
      );
      console.log("📡 Écoute validation admin activée pour :", user.uid);
    }

    if (!adventureId) {
      console.warn("⚠️ Aucun ID d’aventure trouvé pour les POI.");
      return;
    }
    if (!user) {
      console.warn("⚠️ Aucun joueur connecté.");
      return;
    }

    console.log("🗺️ Chargement des POI pour aventure :", adventureId);
    const poisRef = collection(db, "aventures", adventureId, "pois");
    const snapshot = await getDocs(poisRef);

    if (snapshot.empty) {
      console.warn("⚠️ Aucun POI trouvé pour cette aventure.");
      return;
    }

    // 🔍 Statut des POI joués depuis progress/{userId_aventureId}/pois
    const completedRef = collection(db, "progress", `${user.uid}_${adventureId}`, "pois");
    const completedSnap = await getDocs(completedRef);
    const completedStatus = {};
    completedSnap.forEach((docSnap) => {
      const data = docSnap.data();
      completedStatus[docSnap.id] = data.status; // "success" | "fail"
    });

    // 🧹 Nettoyage de la carte avant rechargement
    poiMarkers.forEach((m) => m.remove());
    poiLabels.forEach((l) => l.remove());
    poiMarkers = [];
    poiLabels = [];

    let poisCount = 0;
    const now = new Date();

    for (const docSnap of snapshot.docs) {
      const poi = docSnap.data();
      poi.id = docSnap.id;
      poisCount++;

      if (!poi.lat || !poi.lng) continue;

      // Vérifie période active du POI
      const start = poi.dateDebut?.toDate?.() || new Date(poi.dateDebut || 0);
      const end = poi.dateFin?.toDate?.() || new Date(poi.dateFin || now.getTime() + 86400000);
      if (now < start || now > end) continue;

      const poiStatus = completedStatus[poi.id] || null;
      const el = document.createElement("div");
      el.className = "poi-marker";
      el.dataset.id = poi.id;
      el.dataset.radius = poi.activationRadius || 25;

      const icon = document.createElement("div");
      icon.className = "poi-icon";
      el.appendChild(icon);

      // 🎨 Couleur selon statut
      if (poiStatus === "success") {
        icon.classList.add("poi-won");
        icon.style.opacity = "0.85";
      } else if (poiStatus === "fail") {
        icon.classList.add("poi-lost");
        icon.style.opacity = "0.85";
      } else {
        icon.classList.add("poi-default");
      }

      // 🧭 Détection proximité joueur
      let isNearby = false;
      const isSimulation = new URLSearchParams(window.location.search).get("mode") === "simulation";

      if (isSimulation) {
        isNearby = true;
        // Pas de pulse en simulation pour éviter de clignoter partout, juste clickable
        // Ou pulse si on veut attirer l'attention. Disons pulse.
        icon.classList.add("pulse");
      } else if (playerPosition && !poiStatus) {
        const dist = getDistanceMeters(poi.lat, poi.lng, playerPosition.lat, playerPosition.lng);
        // Utilise le rayon personnalisé ou 25m par défaut
        const radius = poi.activationRadius || 25;
        if (dist <= radius) {
          isNearby = true;
          icon.classList.add("pulse");
        }
      }

      const marker = new mapboxgl.Marker(el)
        .setLngLat([Number(poi.lng), Number(poi.lat)])
        .addTo(window.cityMap);
      poiMarkers.push(marker);

      // 🚫 Blocage définitif des POI terminés ou échoués
      if (poiStatus === "success" || poiStatus === "fail") {
        icon.style.pointerEvents = "none";
        icon.style.cursor = "not-allowed";
        icon.title = poiStatus === "fail" ? "Défi échoué — non rejouable" : "Défi réussi — déjà terminé";
      } else if (isNearby) {
        icon.style.cursor = "pointer";
        icon.addEventListener("click", (e) => {
          e.stopPropagation();
          console.log("🎯 Clic sur POI :", poi.id);
          showChallenge(poi); // ✅ ouvre le défi
        });
      }

      // 🏷️ Label “score” ou “perdu”
      if (poiStatus) {
        const label = document.createElement("div");
        label.className = "poi-label " + (poiStatus === "fail" ? "fail" : "success");
        label.dataset.poiId = poi.id;
        label.textContent = poiStatus === "fail" ? "0 pt - Perdu" : `+${poi.score || 0} pts`;

        const labelMarker = new mapboxgl.Marker({
          element: label,
          offset: [0, -44],
        })
          .setLngLat([Number(poi.lng), Number(poi.lat)])
          .addTo(window.cityMap);
        poiLabels.push(labelMarker);
      }
    }

    // ✅ Mise à jour du total dans progress
    if (user && poisCount > 0) {
      const progressRef = doc(db, "progress", `${user.uid}_${adventureId}`);
      try {
        await updateDoc(progressRef, { totalPOI: poisCount });
        console.log(`📊 Progression mise à jour (${poisCount} POI)`);
      } catch {
        console.warn("⚠️ Progress non encore créé (sera mis à jour plus tard).");
      }
    }

    lastLoadedPois = snapshot.docs.map((d) => d.id);
  } catch (err) {
    console.error("💥 Erreur lors du chargement des POI :", err);
  }
}

/* -------------------------------------------------------------
   🛰️ Mise à jour position du joueur
------------------------------------------------------------- */
export function updatePlayerPosition(position) {
  playerPosition = position;

  poiMarkers.forEach((marker) => {
    const el = marker.getElement();
    const icon = el.querySelector(".poi-icon");
    if (!icon || icon.classList.contains("poi-won") || icon.classList.contains("poi-lost"))
      return;

    const lngLat = marker.getLngLat();
    const dist = getDistanceMeters(lngLat.lat, lngLat.lng, position.lat, position.lng);
    const isSimulation = new URLSearchParams(window.location.search).get("mode") === "simulation";

    // Récupère le rayon du POI (il faut qu'il soit stocké dans le dataset ou géré autrement)
    // Comme on n'a pas les données brutes ici facilements (juste les markers), on va tricher
    // ou mieux : on stocke le rayon dans le dataset du marker lors de la création
    // Pour l'instant on garde 25m défaut si pas d'accès, mais on modifie loadPOIs pour stocker
    const radius = Number(el.dataset.radius) || 25;

    if (isSimulation || dist <= radius) {
      icon.classList.add("pulse");
      icon.style.cursor = "pointer";
    } else {
      icon.classList.remove("pulse");
      icon.style.cursor = "default";
    }
  });
}

/* -------------------------------------------------------------
   🚫 Désactivation d’un POI (succès / échec)
------------------------------------------------------------- */
export function disablePOI(poiId, status, score = 0) {
  const marker = poiMarkers.find((m) => m.getElement().dataset.id === poiId);
  if (!marker) {
    console.warn("⚠️ Impossible de désactiver le POI (introuvable) :", poiId);
    return;
  }

  const icon = marker.getElement().querySelector(".poi-icon");
  if (!icon) return;

  icon.classList.remove("poi-default", "pulse");
  icon.style.pointerEvents = "none";
  icon.classList.add(status === "success" ? "poi-won" : "poi-lost");
  icon.style.opacity = "0.85";
  icon.style.cursor = "not-allowed";

  // 🔄 Supprime ancien label si existant
  const existing = poiLabels.find((l) => l.getElement().dataset?.poiId === poiId);
  if (existing) {
    existing.remove();
    poiLabels = poiLabels.filter((l) => l !== existing);
  }

  // 🏷️ Crée un nouveau label
  const label = document.createElement("div");
  label.className = "poi-label " + (status === "fail" ? "fail" : "success");
  label.dataset.poiId = poiId;
  label.textContent = status === "fail" ? "0 pt - Perdu" : `+${score} pts`;

  const labelMarker = new mapboxgl.Marker({
    element: label,
    offset: [0, -44],
  })
    .setLngLat(marker.getLngLat())
    .addTo(window.cityMap);

  poiLabels.push(labelMarker);
  console.log(`✅ POI ${poiId} désactivé (${status})`);
}
