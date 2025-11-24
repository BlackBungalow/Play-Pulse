// choix-aventure.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB7e3Fk1Sc8S9ykq1v3xVktS5UOUDBfaaM",
  authDomain: "coup-de-poker-ccd99.firebaseapp.com",
  projectId: "coup-de-poker-ccd99",
  storageBucket: "coup-de-poker-ccd99.appspot.com",
  messagingSenderId: "464219267705",
  appId: "1:464219267705:web:b39a36857091a0c0392aa8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================================
// 🌍 Variables DOM
// =============================================================
const container = document.getElementById("aventuresContainer");
const paysFilter = document.getElementById("filterPays");
const villeFilter = document.getElementById("filterVille");
const statusMsg = document.getElementById("statusMsg") || document.getElementById("message");
const currentPage = window.location.pathname.split("/").pop();

let allAventures = [];
let userPosition = null;

// =============================================================
// 🎞️ Animation de chargement
// =============================================================
function showLoading(message = "⏳ Chargement des aventures...") {
  if (statusMsg) {
    statusMsg.innerHTML = `<span class="loading-spinner">🔄</span> ${message}`;
    statusMsg.style.opacity = "0.8";
  }
  if (container) {
    container.innerHTML = `
      <div style="text-align:center;margin-top:2rem;animation:fadeIn 0.5s ease;">
        <div class="spinner" style="
          width:40px;
          height:40px;
          border:4px solid #ccc;
          border-top:4px solid #2b3a67;
          border-radius:50%;
          animation:spin 1s linear infinite;
          margin:auto;
        "></div>
        <p style="margin-top:1rem;color:#555;">${message}</p>
      </div>
      <style>
        @keyframes spin {0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
        @keyframes fadeIn {from{opacity:0;}to{opacity:1;}}
      </style>
    `;
  }
}

function hideLoading() {
  if (statusMsg) statusMsg.innerHTML = "";
}

// =============================================================
// 🌍 Calcul distance (Haversine)
// =============================================================
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// =============================================================
// 🧭 Chargement des aventures visibles uniquement
// =============================================================
async function loadAventures() {
  try {
    showLoading("⏳ Recherche des aventures publiques proches...");

    const q = query(collection(db, "aventures"), where("public", "==", true));
    const snapshot = await getDocs(q);

    allAventures = [];
    const paysSet = new Set();
    const villesSet = new Set();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const aventure = { id: docSnap.id, ...data };

      // 🔹 Calcul distance si champ "centre" disponible
      if (userPosition && data.centre && Array.isArray(data.centre)) {
        const [lng, lat] = data.centre;
        aventure.distance = getDistanceKm(userPosition.lat, userPosition.lng, lat, lng);
      }

      // 🔹 Si pas de champ "centre", on essaie via le premier POI
      if (!aventure.distance && userPosition) {
        try {
          const poisSnap = await getDocs(collection(db, "aventures", docSnap.id, "pois"));
          poisSnap.forEach(p => {
            const poiData = p.data();
            if (poiData.lat && poiData.lng && !aventure.distance) {
              aventure.distance = getDistanceKm(
                userPosition.lat,
                userPosition.lng,
                poiData.lat,
                poiData.lng
              );
            }
          });
        } catch (err) {
          console.warn(`⚠️ Erreur lecture POI pour ${data.nom || docSnap.id}:`, err);
        }
      }

      console.log(`📍 ${data.nom || "Aventure"} — distance calculée :`, aventure.distance || "n/a");

      allAventures.push(aventure);
      if (data.pays) paysSet.add(data.pays);
      if (data.ville) villesSet.add(data.ville);
    }

    hideLoading();

    // 🎯 Sur explore.html, afficher les filtres
    if (paysFilter && villeFilter) {
      updateSelectOptions(paysFilter, paysSet);
      updateSelectOptions(villeFilter, villesSet);
    }

    // 🎯 Sur catalogue-proximite, filtrer à <5 km
    if (currentPage.includes("catalogue-proximite")) {
      const nearby = allAventures.filter(av => av.distance != null && av.distance <= 5);
      if (statusMsg) {
        if (nearby.length > 0) {
          statusMsg.textContent = `✅ ${nearby.length} aventure(s) publique(s) trouvée(s) à moins de 5 km.`;
        } else {
          statusMsg.innerHTML = "🥴 Aucune aventure publique à moins de 5 km.";
        }
      }
      displayAventures(nearby);
    } else {
      displayAventures(allAventures);
    }
  } catch (err) {
    console.error("💥 Erreur lors du chargement des aventures :", err);
    if (container)
      container.innerHTML = `<p style="color:#c00;">Erreur de chargement des aventures.</p>`;
  }
}

// =============================================================
// 🔽 Gestion filtres et affichage
// =============================================================
function updateSelectOptions(select, values) {
  select.innerHTML = `<option value="">${select.id === "filterPays" ? "🌍 Tous les pays" : "🏙️ Toutes les villes"}</option>`;
  [...values].sort().forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

function displayAventures(aventures) {
  if (!container) return;
  container.innerHTML = "";

  // ✅ Trie les aventures par distance si dispo
  aventures.sort((a, b) => {
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    if (a.distance != null) return -1;
    if (b.distance != null) return 1;
    return 0;
  });

  aventures.forEach((av, index) => {
    const card = document.createElement("div");
    card.className = "aventure-card";
    card.style.opacity = "0";
    card.style.transform = "translateY(10px)";
    card.style.transition = "opacity 0.6s ease, transform 0.6s ease";

    const thumb = av.illustrationUrl
      ? `<img src="${av.illustrationUrl}" alt="Illustration ${av.nom || "aventure"}" class="aventure-thumb" loading="lazy" />`
      : `<div class="aventure-thumb thumb-placeholder">🏝️</div>`;
    const presentation = av.presentation || "Pas encore de présentation fournie.";

    card.innerHTML = `
      <div class="aventure-card-header">
        ${thumb}
        <div class="aventure-card-title">
          <h2>${av.nom || "Sans titre"}</h2>
          <p class="aventure-location">📍 ${av.ville || "Ville inconnue"}, ${av.pays || "Pays inconnu"}</p>
          ${av.distance != null ? `<p class=\"aventure-distance\">📏 ~${av.distance} km</p>` : ""}
        </div>
      </div>
      <p class="aventure-presentation">${presentation}</p>
      <p class="aventure-mode">🎮 Mode : ${av.lineaire ? "Parcours linéaire" : "Libre"}</p>
      <div class="aventure-actions-row">
        <button class="btn-play" onclick="launchAventure('${av.id}')">▶️ Jouer</button>
        <div class="share-block">
          <button class="share-toggle" type="button">📨 Partager cette aventure avec mes amis</button>
          <div class="share-panel" hidden>
            <label class="share-label" for="share-${av.id}">Adresse email de votre ami</label>
            <div class="share-input-row">
              <input id="share-${av.id}" class="share-email-input" type="email" placeholder="ami@example.com" autocomplete="email" />
              <button class="share-send" type="button">Envoyer</button>
            </div>
            <p class="share-status" aria-live="polite"></p>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);

    setupShareInteractions(card, av);

    // ✨ Animation fade-in progressive
    setTimeout(() => {
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, 100 * index);
  });

  if (aventures.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;">Aucune aventure disponible pour le moment.</p>`;
  }
}

// =============================================================
// 🎮 Lancement de l’aventure
// =============================================================
window.launchAventure = (id) => {
  if (!id) {
    console.error("❌ ID d’aventure manquant !");
    return;
  }

  // Enregistre l'aventure dans le stockage local pour persistance
  localStorage.setItem("current_aventure_id", id);

  // Redirige directement vers la page de jeu avec l'ID en paramètre
  window.location.href = `game.html?id=${id}`;
};

// =============================================================
// 🤝 Invitations par email (stockées dans Firestore)
// =============================================================
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setupShareInteractions(card, aventure) {
  const toggleBtn = card.querySelector(".share-toggle");
  const panel = card.querySelector(".share-panel");
  const sendBtn = card.querySelector(".share-send");
  const emailInput = card.querySelector(".share-email-input");
  const statusEl = card.querySelector(".share-status");

  if (!toggleBtn || !panel || !sendBtn || !emailInput || !statusEl) return;

  toggleBtn.addEventListener("click", () => {
    const isOpen = !panel.hasAttribute("hidden");
    if (isOpen) {
      panel.setAttribute("hidden", "");
      statusEl.textContent = "";
    } else {
      panel.removeAttribute("hidden");
      emailInput.focus();
    }
  });

  sendBtn.addEventListener("click", () => {
    handleInvitationSend({ aventure, emailInput, statusEl, sendBtn });
  });

  emailInput.addEventListener("keypress", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      handleInvitationSend({ aventure, emailInput, statusEl, sendBtn });
    }
  });
}

async function handleInvitationSend({ aventure, emailInput, statusEl, sendBtn }) {
  const friendEmail = emailInput.value.trim();

  if (!emailRegex.test(friendEmail)) {
    statusEl.textContent = "Merci de saisir une adresse email valide.";
    statusEl.classList.remove("success");
    statusEl.classList.add("error");
    emailInput.focus();
    return;
  }

  const playerId = localStorage.getItem("playerId") || "joueur-anonyme";
  const ville = aventure.ville || "sa ville";
  const message = `${playerId} vous a invité à jouer à une véritable aventure en ville à ${ville}. Rejoignez PlayPulse et jouez en famille ou entre amis!`;
  const invitationLink = `${window.location.origin}/game.html?id=${aventure.id}`;

  statusEl.textContent = "Envoi de l'invitation en cours...";
  statusEl.classList.remove("error", "success");
  sendBtn.disabled = true;

  try {
    await addDoc(collection(db, "invitations"), {
      playerId,
      friendEmail,
      aventureId: aventure.id,
      aventureNom: aventure.nom || null,
      ville: aventure.ville || null,
      pays: aventure.pays || null,
      invitationLink,
      message,
      createdAt: new Date(),
      status: "pending_email",
      channel: "firebase_cloud_messaging"
    });

    statusEl.textContent = "Invitation envoyée ! Votre ami recevra un email.";
    statusEl.classList.remove("error");
    statusEl.classList.add("success");
    emailInput.value = "";
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'invitation :", error);
    statusEl.textContent = "Impossible d'envoyer l'invitation pour le moment.";
    statusEl.classList.remove("success");
    statusEl.classList.add("error");
  } finally {
    sendBtn.disabled = false;
  }
}

// =============================================================
// 🔍 Application des filtres
// =============================================================
function applyFilters() {
  const pays = paysFilter ? paysFilter.value : "";
  const ville = villeFilter ? villeFilter.value : "";

  const filtered = allAventures.filter(av => {
    return (!pays || av.pays === pays) && (!ville || av.ville === ville);
  });

  displayAventures(filtered);
}

// ✅ Ajout sécurisé des listeners
if (paysFilter) paysFilter.addEventListener("change", applyFilters);
if (villeFilter) villeFilter.addEventListener("change", applyFilters);

// =============================================================
// 🛰️ Géolocalisation du joueur
// =============================================================
function initGeolocation() {
  if (!navigator.geolocation) {
    console.warn("Géolocalisation non disponible.");
    loadAventures();
    return;
  }

  showLoading("📍 Détection de votre position...");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      console.log("🛰️ Position détectée :", userPosition);
      loadAventures();
    },
    (err) => {
      console.warn("Géolocalisation refusée ou échouée :", err.message);
      if (statusMsg) statusMsg.textContent = "❌ Géolocalisation refusée.";
      loadAventures();
    },
    { enableHighAccuracy: true }
  );
}

initGeolocation();
