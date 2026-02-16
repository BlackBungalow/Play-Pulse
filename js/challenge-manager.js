// challenge-manager.js (v5.6 – Ajout écoute temps réel validation médias + intégration sûre)
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, getCurrentAdventureId } from "./firebase-config.js";
import { updateScoreDisplay, updateScore } from "./score-manager.js";
import { disablePOI } from "./poi-manager.js";
import { ChallengeView } from "./challenge-view.js";

const db = getFirestore(app);
const auth = getAuth(app);
let attempts = {}; // suivi des tentatives par POI

/* -------------------------------------------------------------
   🟢 ÉCOUTE TEMPS RÉEL DES VALIDATIONS MÉDIAS (avec logs)
------------------------------------------------------------- */
export function listenForMediaValidation(aventureId, playerId, updatePOIVisual, showNotification) {
  const submissionsRef = collection(db, "aventures", aventureId, "submissions");
  const q = query(submissionsRef, where("playerId", "==", playerId));

  console.log("📡 [listenForMediaValidation] Écoute active pour le joueur :", playerId);

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== "modified") return;

      const data = change.doc.data();
      const poiId = data.poiId;
      const points = data.points || 0;

      console.log("📬 [Validation détectée Firestore] POI :", poiId, " | Data :", data);

      // ✅ Cas validé
      if (data.validated && !data.refused) {
        console.log("✅ [VALIDÉ] Détection validation média !");
        if (showNotification) {
          showNotification(`🎉 Votre envoi a été validé ! Vous gagnez ${points} points.`, "success");
        } else {
          showFloatingPopup(`🎉 Votre envoi a été validé ! Vous gagnez ${points} points.`, "success");
        }

        if (updatePOIVisual) updatePOIVisual(poiId, true, points);

        // 🔍 Vérifie présence du popup dans le DOM
        setTimeout(() => {
          const popup = document.querySelector(".floating-popup");
          if (popup) {
            console.log("🟢 Popup affichée sur game.html :", popup.textContent);
          } else {
            console.warn("⚠️ Popup non trouvée dans le DOM (peut être masquée par CSS)");
          }
        }, 300);

        return;
      }

      // ❌ Cas refusé
      if (data.refused) {
        console.log("❌ [REFUSÉ] Détection refus média !");
        if (showNotification) {
          showNotification("❌ Votre envoi n'a pas été validé !", "fail");
        } else {
          showFloatingPopup("❌ Votre envoi n'a pas été validé !", "fail");
        }

        if (updatePOIVisual) updatePOIVisual(poiId, false, 0);

        // 🔍 Vérifie présence du popup dans le DOM
        setTimeout(() => {
          const popup = document.querySelector(".floating-popup");
          if (popup) {
            console.log("🟠 Popup affichée après refus :", popup.textContent);
          } else {
            console.warn("⚠️ Popup non trouvée dans le DOM après refus (peut être masquée)");
          }
        }, 300);

        return;
      }

      console.log("ℹ️ [Changement détecté mais sans validation/refus exploitable]");
    });
  });
}



/* -------------------------------------------------------------
   🧩 AFFICHAGE DU DÉFI
------------------------------------------------------------- */
export function showChallenge(poi, options = {}) {
  if (!poi) return console.warn("❌ showChallenge() appelé sans POI valide.");

  const currentPage = window.location.pathname.split("/").pop();
  const isTestPage = currentPage === "test-aventure.html";
  const adminEmail = localStorage.getItem("adminEmail") || sessionStorage.getItem("adminEmail");
  const isAdmin = !!adminEmail;

  if (options.testMode) {
    // Relaxed check: Allow testMode if user is admin (works on game.html?mode=simulation)
    if (!isAdmin) {
      console.warn("🚫 Accès refusé au mode test — réservé à l'administration.");
      alert("⚠️ Fonction de test accessible uniquement depuis l’espace admin authentifié.");
      return;
    }
    console.log("🧩 Mode test admin activé pour :", adminEmail);
  }

  const view = new ChallengeView(poi, {
    onValidate: (response) => validateChallenge(poi, response, options),
    onClose: () => console.log("🪄 Défi fermé"),
  });

  view.render();
}

/* -------------------------------------------------------------
   🧠 VALIDATION DU DÉFI
------------------------------------------------------------- */
async function validateChallenge(poi, response, options = {}) {
  const user = auth.currentUser;
  const aventureId = getCurrentAdventureId();
  const poiId = poi.id;

  const isTestMode = options.testMode === true;
  if (isTestMode) {
    console.log("🧪 Validation en mode test admin (aucune sauvegarde en base).");
    const success = simulateValidation(poi, response);
    if (success) {
      playSound("success");
      vibrateDevice();
      showFloatingPopup(`🎯 Réponse correcte (test admin)`, "success");
    } else {
      playSound("fail");
      showFloatingPopup("❌ Mauvaise réponse (test admin)", "fail");
    }
    return;
  }

  if (!user) return alert("Connecte-toi pour jouer !");
  const mode = (window.aventureConfig?.lineaire ? "lineaire" : "libre") || "libre";
  const baseScore = Number(poi.score || 10);
  let poiScore = baseScore;

  if (options.hintsUsed === 1) poiScore = Math.ceil(baseScore * 0.9); // -10%
  if (options.hintsUsed === 2) poiScore = Math.ceil(baseScore * 0.8); // -20%

  const expected = (poi.reponse || "").trim().toLowerCase();
  const type = poi.typeReponse || "texte";

  const maxAllowed = poi.limitAttempts ? Number(poi.maxAttempts || 1) : (mode === "libre" ? 1 : Infinity);
  const currentAttempt = (attempts[poiId] || 0) + 1;
  attempts[poiId] = currentAttempt;

  let success = false;
  if (type === "texte") success = response?.trim().toLowerCase() === expected;
  else if (type === "qcm") success = response === poi.qcmCorrectIndex;
  else if (type === "vocal") success = response?.toLowerCase().includes(expected);

  if (success) {
    playSound("success");
    vibrateDevice();

    await handleSuccess(user.uid, aventureId, poiId, poiScore, currentAttempt);
    disablePOI(poiId, "success", poiScore);

    setTimeout(() => {
      showFloatingPopup(`🎉 Bravo ! +${poiScore} points`, "success");

      // ✅ Fermeture automatique après succès
      setTimeout(() => {
        const closeBtn = document.getElementById("closeBtn"); // Fallback ancien
        // Si on a accès à la vue, on ferme. Sinon on simule le clic fermer.
        // Comme validateChallenge est appelé par ChallengeView, on ne peut pas appeler view.close() directement ici facilement sans refonte.
        // Mais on peut déclencher le clic sur le bouton fermer de la modale active.
        const activeCloseBtn = document.querySelector(".challenge-modal .close-btn") || document.getElementById("closeBtn");
        if (activeCloseBtn) activeCloseBtn.click();
      }, 1500); // 1.5s pour lire le message
    }, 250);
    return;
  }

  playSound("fail");
  const remaining = maxAllowed - currentAttempt;

  setTimeout(async () => {
    if (currentAttempt >= maxAllowed) {
      await handleFailure(user.uid, aventureId, poiId, currentAttempt);
      disablePOI(poiId, "fail", 0);
      showFloatingPopup("😞 Échec du défi (plus de tentatives)", "fail");

      // ✅ Fermeture automatique après échec définitif
      setTimeout(() => {
        const activeCloseBtn = document.querySelector(".challenge-modal .close-btn") || document.getElementById("closeBtn");
        if (activeCloseBtn) activeCloseBtn.click();
      }, 2000);
    } else {
      showFloatingPopup(
        `❌ Mauvaise réponse, il vous reste ${remaining} tentative${remaining > 1 ? "s" : ""}.`,
        "warning"
      );
    }
  }, 250);
}

/* -------------------------------------------------------------
   🧪 SIMULATION VALIDATION (MODE TEST)
------------------------------------------------------------- */
function simulateValidation(poi, response) {
  const expected = (poi.reponse || "").trim().toLowerCase();
  const type = poi.typeReponse || "texte";
  if (type === "texte") return response?.trim().toLowerCase() === expected;
  if (type === "qcm") return response === poi.qcmCorrectIndex;
  if (type === "vocal") return response?.toLowerCase().includes(expected);
  return false;
}

/* -------------------------------------------------------------
   🏆 SUCCÈS
------------------------------------------------------------- */
async function handleSuccess(userId, aventureId, poiId, poiScore, tries) {
  try {
    const progressRef = doc(db, "progress", `${userId}_${aventureId}`);
    const poiRef = doc(db, "progress", `${userId}_${aventureId}`, "pois", poiId);

    await setDoc(poiRef, {
      userId,
      aventureId,
      poiId,
      status: "success",
      attempts: tries,
      scoreGained: poiScore,
      updatedAt: serverTimestamp(),
    });

    await updateScore(poiScore);
    updateScoreDisplay();

    await setDoc(progressRef, { lastUpdate: serverTimestamp() }, { merge: true });
    console.log(`✅ Succès enregistré pour POI ${poiId}`);
  } catch (err) {
    console.error("❌ Erreur Firestore handleSuccess :", err);
  }
}

/* -------------------------------------------------------------
   💀 ÉCHEC
------------------------------------------------------------- */
async function handleFailure(userId, aventureId, poiId, tries) {
  try {
    const progressRef = doc(db, "progress", `${userId}_${aventureId}`);
    const poiRef = doc(db, "progress", `${userId}_${aventureId}`, "pois", poiId);

    await setDoc(poiRef, {
      userId,
      aventureId,
      poiId,
      status: "fail",
      attempts: tries,
      scoreGained: 0,
      updatedAt: serverTimestamp(),
    });

    await setDoc(progressRef, { lastUpdate: serverTimestamp() }, { merge: true });
    console.log(`⚠️ Échec enregistré pour POI ${poiId}`);
  } catch (err) {
    console.error("❌ Erreur Firestore handleFailure :", err);
  }
}

/* -------------------------------------------------------------
   🔊 SONS ET VIBRATIONS
------------------------------------------------------------- */
function playSound(type = "success") {
  let path = "./sounds/notify.mp3";
  if (type === "success") path = "./sounds/success.wav";
  else if (type === "fail") path = "./sounds/fail.wav";

  try {
    const audio = new Audio(path);
    audio.volume = 0.7;
    audio.play().catch(() => console.warn("🔇 Lecture audio bloquée"));
  } catch (err) {
    console.warn("⚠️ Erreur lecture audio :", err);
  }
}

function vibrateDevice() {
  if ("vibrate" in navigator) navigator.vibrate([100, 60, 100]);
}

/* -------------------------------------------------------------
   🌈 POPUP + VISUEL + NOTIFS
------------------------------------------------------------- */
function showFloatingPopup(message, type = "info") {
  document.querySelectorAll(".floating-popup").forEach(p => p.remove());
  const popup = document.createElement("div");
  popup.className = `floating-popup ${type}`;
  popup.textContent = message;
  Object.assign(popup.style, {
    position: "fixed",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    padding: "14px 24px",
    borderRadius: "12px",
    fontSize: "1.1rem",
    fontWeight: "600",
    zIndex: "9999",
    opacity: "1",
    transition: "opacity 0.9s ease",
  });
  document.body.appendChild(popup);
  setTimeout(() => { popup.style.opacity = "0"; setTimeout(() => popup.remove(), 500); }, 2200);
}

function updatePOIVisual(poiId, validated, points) {
  const el = document.querySelector(`[data-poi-id="${poiId}"]`);
  if (!el) return;
  el.classList.toggle("poi-success", validated);
  const scoreEl = el.querySelector(".poi-score");
  if (scoreEl) scoreEl.textContent = validated ? `+${points} pts` : "";
}

function showNotification(message, type = "info") {
  const notif = document.createElement("div");
  notif.className = `notif notif-${type}`;
  notif.textContent = message;
  Object.assign(notif.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "error" ? "#d9534f" : type === "success" ? "#28a745" : "#333",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: "10px",
    fontSize: "1rem",
    zIndex: "9999",
  });
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

/* -------------------------------------------------------------
   ✅ EXPORTS COMPATIBILITÉ
------------------------------------------------------------- */
export function closeChallenge() {
  console.warn("closeChallenge() n'est plus utilisé (géré via ChallengeView).");
}
export async function loadProgressAndDisablePOIs() {
  console.warn("loadProgressAndDisablePOIs() n'est plus utilisé (déplacé vers poi-manager).");
}

// -------------------------------------------------------------
// ✅ Exports publics supplémentaires
// -------------------------------------------------------------
export { showFloatingPopup };
