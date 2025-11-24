// test-aventure.js — v2.1 (Mode test admin unifié avec moteur de défi joueur)
import { app } from "/js/firebase-config.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showChallenge } from "/js/challenge-manager.js"; // ✅ Moteur du jeu

console.log("[TEST] module start");

// ======================================================
// 🧩 Gestion des erreurs globales
// ======================================================
window.addEventListener("error", (e) => {
  console.error("[TEST] window error:", e.message, e.filename, e.lineno, e.colno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[TEST] unhandledrejection:", e.reason);
});

// ======================================================
// 🗺️ Attente du chargement de Mapbox avant init()
// ======================================================
const mapEl = document.getElementById("map");
if (!mapEl) console.error("[TEST] #map introuvable");

waitForMapbox(init);

function waitForMapbox(cb) {
  if (window.mapboxgl) cb();
  else setTimeout(() => waitForMapbox(cb), 100);
}

// ======================================================
// 🚀 Initialisation principale
// ======================================================
async function init() {
  console.log("[TEST] init()");
  mapboxgl.accessToken =
    "pk.eyJ1Ijoibmljb3hpbW9uIiwiYSI6ImNtZ3RvNHVqdzA1Z2EybnFrMzVxZmxoYjIifQ.yQsRuetSej9oJ9Vx20rUyA";

  const db = getFirestore(app);
  const aventureId = localStorage.getItem("viewAventureId");
  if (!aventureId) {
    alert("❌ Aucune aventure sélectionnée");
    return;
  }

  // 🧾 Chargement des infos de l’aventure
  const aventureInfo = document.getElementById("aventureInfo");
  try {
    const aventureDoc = await getDoc(doc(db, "aventures", aventureId));
    if (aventureDoc.exists()) {
      const data = aventureDoc.data();
      aventureInfo.textContent = `🧩 Aventure en test : ${data.nom || "(Sans titre)"} (${data.ville || "ville inconnue"})`;
    } else {
      aventureInfo.textContent = "⚠️ Aventure introuvable";
    }
  } catch (e) {
    console.error("[TEST] Erreur lecture aventure:", e);
    aventureInfo.textContent = "⚠️ Erreur de chargement";
  }

  // 🗺️ Carte Mapbox
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v11",
    center: [2.35, 48.85],
    zoom: 12,
  });

  // ⚙️ Mode debug (drag des POI)
  const toggleDebug = document.getElementById("toggleDebug");
  const debugInfo = document.getElementById("debugInfo");
  let debugMode = false;

  toggleDebug.addEventListener("click", () => {
    debugMode = !debugMode;
    toggleDebug.textContent = debugMode ? "✅ Debug activé" : "🪄 Mode debug";
    debugInfo.textContent = debugMode
      ? "🟢 Déplacement des POI activé (drag & drop)"
      : "";
  });

  map.on("load", () => {
    console.log("[TEST] Map chargée");
    loadPois(map, db, aventureId, () => debugMode, debugInfo);
  });
}

// ✅ Active le bandeau si l’admin est connecté
const adminEmail = localStorage.getItem("adminEmail") || sessionStorage.getItem("adminEmail");
if (adminEmail) {
  const banner = document.getElementById("adminTestBanner");
  if (banner) banner.style.display = "block";
  console.log("🧪 Mode Test Admin actif pour :", adminEmail);
}

// ======================================================
// 🎯 Chargement et affichage des POI
// ======================================================
async function loadPois(map, db, aventureId, getDebug, debugInfo) {
  console.log("[TEST] Chargement des POI...");
  const poisSnap = await getDocs(collection(db, "aventures", aventureId, "pois"));
  const pois = [];
  poisSnap.forEach((docSnap) => pois.push({ id: docSnap.id, ...docSnap.data() }));

  if (!pois.length) {
    alert("Aucun POI trouvé !");
    return;
  }

  map.setCenter([pois[0].lng, pois[0].lat]);
  map.setZoom(13);

  pois.forEach((poi, i) => {
    const el = document.createElement("div");
    el.className = "marker";
    el.style.width = "25px";
    el.style.height = "25px";
    el.style.background = "#2b3a67";
    el.style.borderRadius = "50%";
    el.style.cursor = "pointer";
    el.title = poi.question || `Défi ${i + 1}`;

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([poi.lng, poi.lat])
      .addTo(map);

    marker.setDraggable(false);

    // 🧩 Ouverture du défi avec le moteur joueur
    el.addEventListener("click", () => {
      console.log(`[TEST] Ouverture défi : ${poi.question || "(sans question)"}`);
      try {
        // Simulation complète du défi sans contrainte de géolocalisation
        showChallenge(poi, {
          testMode: true,
          disableGeoCheck: true,
        });
      } catch (err) {
        console.error("[TEST] Erreur lors de l’ouverture du défi :", err);
      }
    });

    // 🎛️ Mode debug (drag & drop)
    const observer = new MutationObserver(() => {
      marker.setDraggable(getDebug());
    });
    observer.observe(document.getElementById("toggleDebug"), { childList: true });

    marker.on("dragend", async () => {
      if (!getDebug()) return;
      const newPos = marker.getLngLat();
      console.log(`📍 POI ${i + 1} déplacé →`, newPos);
      debugInfo.textContent = `POI ${i + 1}: ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}`;

      try {
        await updateDoc(doc(db, "aventures", aventureId, "pois", poi.id), {
          lat: newPos.lat,
          lng: newPos.lng,
        });
        console.log(`[TEST] ✅ POI ${poi.id} mis à jour dans Firestore`);
      } catch (e) {
        console.error(`[TEST] ❌ Erreur Firestore update:`, e);
      }
    });
  });

  console.log(`[TEST] ✅ ${pois.length} POI chargés et affichés.`);
}
