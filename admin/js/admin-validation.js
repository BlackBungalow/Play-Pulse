// admin-validation.js
import { app } from "/js/firebase-config.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const db = getFirestore(app);
const storage = getStorage(app);
const container = document.getElementById("validationContainer");

/**
 * 🔹 Récupère les infos d’un POI (question)
 */
async function getPoiQuestion(aventureId, poiId) {
  try {
    const poiRef = doc(db, "aventures", aventureId, "pois", poiId);
    const poiSnap = await getDoc(poiRef);
    if (poiSnap.exists()) {
      const data = poiSnap.data();
      return data.question || "(question non définie)";
    }
  } catch (err) {
    console.warn("⚠️ Erreur récupération POI :", err);
  }
  return "(POI inconnu)";
}

/**
 * 🔹 Récupère les infos de l’aventure (nom)
 */
async function getAventureNom(aventureId) {
  try {
    const aventureRef = doc(db, "aventures", aventureId);
    const aventureSnap = await getDoc(aventureRef);
    if (aventureSnap.exists()) {
      return aventureSnap.data().nom || aventureId;
    }
  } catch (err) {
    console.warn("⚠️ Erreur récupération aventure :", err);
  }
  return aventureId;
}

/**
 * 🔹 Récupère le nom du joueur (si disponible)
 * (prévoit une table “players” plus tard)
 */
async function getPlayerName(playerId) {
  if (!playerId || playerId === "anonymous") return "Joueur anonyme";
  try {
    const playerRef = doc(db, "players", playerId);
    const playerSnap = await getDoc(playerRef);
    if (playerSnap.exists()) {
      return playerSnap.data().nom || playerId;
    }
  } catch (err) {
    console.warn("⚠️ Erreur récupération joueur :", err);
  }
  return playerId;
}

/**
 * 🔹 Charge les médias en attente de validation
 */
async function loadPendingSubmissions() {
  container.innerHTML = "<p>Chargement des médias en attente...</p>";

  const aventureId =
    localStorage.getItem("CURRENT_ADVENTURE_ID") ||
    localStorage.getItem("editAventureId");

  if (!aventureId) {
    container.innerHTML = "<p>❌ Aucune aventure sélectionnée.</p>";
    return;
  }

  // Nom de l’aventure
  const aventureNom = await getAventureNom(aventureId);

  const submissionsRef = collection(db, "aventures", aventureId, "submissions");
  const snap = await getDocs(submissionsRef);

  const pending = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.mediaUrl && !data.validated) {
      const poiQuestion = await getPoiQuestion(aventureId, data.poiId);
      const playerName = await getPlayerName(data.playerId);
      pending.push({
        id: docSnap.id,
        ...data,
        poiQuestion,
        playerName,
        aventureNom,
      });
    }
  }

  if (pending.length === 0) {
    container.innerHTML =
      "<p>✅ Aucun média en attente de validation pour cette aventure.</p>";
    return;
  }

  container.innerHTML = pending
    .map(
      (item) => `
        <div class="submission-card">
          <h3>🎯 Aventure : ${item.aventureNom}</h3>
          <p><strong>📍 Défi :</strong> ${item.poiQuestion}</p>
          <p><strong>👤 Joueur :</strong> ${item.playerName}</p>
          ${
            item.mediaUrl.includes(".mp4") || item.mediaUrl.includes("video")
              ? `<video src="${item.mediaUrl}" controls></video>`
              : `<img src="${item.mediaUrl}" alt="Média du joueur"/>`
          }
          <div style="margin-top:10px;display:flex;gap:10px;">
            <button class="btn-validate" data-id="${item.id}">✅ Valider</button>
            <button class="btn-refuse" data-id="${item.id}" data-url="${item.mediaUrl}">❌ Refuser</button>
          </div>
        </div>`
    )
    .join("");
}

/**
 * 🔹 Actions sur validation ou refus
 */
container.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const aventureId =
    localStorage.getItem("CURRENT_ADVENTURE_ID") ||
    localStorage.getItem("editAventureId");

  const submissionRef = doc(db, "aventures", aventureId, "submissions", id);
  const submissionSnap = await getDoc(submissionRef);
  const submissionData = submissionSnap.exists() ? submissionSnap.data() : null;

  // 🔍 Récupération du score du POI pour les points
  const poiRef = submissionData
    ? doc(db, "aventures", aventureId, "pois", submissionData.poiId)
    : null;
  const poiSnap = poiRef ? await getDoc(poiRef) : null;
  const poiData = poiSnap?.exists() ? poiSnap.data() : { score: 10 };

// ✅ VALIDATION
if (btn.classList.contains("btn-validate")) {
  await updateDoc(submissionRef, {
    validated: true,
    refused: false,
    status: "validated", // ✅ Ajout pour déclencher le listener
    validatedAt: new Date(),
    points: poiData.score || 10,
  });
  alert(`✅ Média validé ! +${poiData.score} points`);
}

// ❌ REFUS
else if (btn.classList.contains("btn-refuse")) {
  const url = btn.dataset.url;
  if (url) {
    try {
      const pathStart = url.indexOf("/o/") + 3;
      const pathEnd = url.indexOf("?") > -1 ? url.indexOf("?") : undefined;
      const path = decodeURIComponent(url.substring(pathStart, pathEnd));
      await deleteObject(ref(storage, path));
      console.log("🗑️ Média supprimé du Storage :", path);
    } catch (err) {
      console.warn("⚠️ Erreur suppression média :", err);
    }
  }

  await updateDoc(submissionRef, {
    validated: false,
    refused: true,
    status: "refused", // ✅ Ajout pour déclencher le listener
    validatedAt: new Date(),
  });

  alert("❌ Média refusé !");
}


  await loadPendingSubmissions();
});

loadPendingSubmissions();
