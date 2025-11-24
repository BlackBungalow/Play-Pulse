// score-manager.js (v4.6 - Sync Firestore + LocalStorage + compatibilité progression)

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, getCurrentAdventureId } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

let currentScore = 0;

/* -------------------------------------------------------------
   🎯 Initialisation du score d’aventure
------------------------------------------------------------- */
export async function initScore() {
  const adventureId = getCurrentAdventureId();
  if (!adventureId) {
    console.warn("⚠️ Aucun ID d’aventure trouvé pour initScore().");
    return;
  }

  const key = `score_${adventureId}`;
  const localScore = parseInt(localStorage.getItem(key) || "0", 10);
  currentScore = localScore;

  const user = auth.currentUser;
  if (user) {
    try {
      const progressRef = doc(db, "progress", `${user.uid}_${adventureId}`);
      const snap = await getDoc(progressRef);

      if (snap.exists()) {
        const data = snap.data();
        const remoteScore = typeof data.score === "number" ? data.score : 0;

        // 🔄 Synchronisation locale <-> Firestore
        if (remoteScore > localScore) {
          currentScore = remoteScore;
          localStorage.setItem(key, remoteScore);
          console.log(`☁️ Score synchronisé depuis Firestore (${remoteScore})`);
        } else if (remoteScore < localScore) {
          await updateDoc(progressRef, {
            score: localScore,
            lastUpdate: serverTimestamp(),
          });
          console.log(`⬆️ Firestore mis à jour (${localScore})`);
        }
      } else {
        // 🆕 Création du document si inexistant
        await setDoc(progressRef, {
          userId: user.uid,
          aventureId: adventureId,
          score: currentScore,
          status: "in_progress",
          startedAt: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
        console.log("🆕 Document progress créé avec score initial 0");
      }
    } catch (err) {
      console.error("❌ Erreur Firestore initScore :", err.message);
    }
  }

  updateScoreDisplay();
  window.dispatchEvent(new Event("scoreUpdated"));
}

/* -------------------------------------------------------------
   ➕ Mise à jour du score global
------------------------------------------------------------- */
export async function updateScore(amount = 0) {
  if (!amount) return;

  const adventureId = getCurrentAdventureId();
  if (!adventureId) {
    console.warn("⚠️ updateScore sans aventure active.");
    return;
  }

  const key = `score_${adventureId}`;
  const stored = parseInt(localStorage.getItem(key) || "0", 10);
  currentScore = stored + Number(amount || 0);
  localStorage.setItem(key, currentScore);

  updateScoreDisplay();
  window.dispatchEvent(new Event("scoreUpdated"));

  const user = auth.currentUser;
  if (user) {
    try {
      const progressRef = doc(db, "progress", `${user.uid}_${adventureId}`);
      await updateDoc(progressRef, {
        score: currentScore,
        lastUpdate: serverTimestamp(),
      });
      console.log(`📤 Score Firestore mis à jour : ${currentScore}`);
    } catch (err) {
      console.warn("⚠️ Erreur Firestore updateScore :", err.message);
    }
  } else {
    console.log("🕹️ Score mis à jour localement (offline ou non connecté).");
  }
}

/* -------------------------------------------------------------
   📊 Getter du score courant
------------------------------------------------------------- */
export function getScore() {
  return currentScore;
}

/* -------------------------------------------------------------
   🧾 Affichage du score à l’écran
------------------------------------------------------------- */
export function updateScoreDisplay() {
  const el = document.getElementById("scoreDisplay");
  if (el) {
    el.textContent = `Score : ${currentScore} pts`;
    el.classList.add("score-update");
    setTimeout(() => el.classList.remove("score-update"), 600);
  }
}

/* -------------------------------------------------------------
   🔄 Réinitialisation (nouvelle aventure / debug)
------------------------------------------------------------- */
export function resetScore() {
  const adventureId = getCurrentAdventureId();
  if (!adventureId) {
    console.warn("⚠️ resetScore appelé sans aventure active.");
    return;
  }

  const key = `score_${adventureId}`;
  currentScore = 0;
  localStorage.setItem(key, "0");

  updateScoreDisplay();
  window.dispatchEvent(new Event("scoreUpdated"));

  const user = auth.currentUser;
  if (user) {
    const ref = doc(db, "progress", `${user.uid}_${adventureId}`);
    updateDoc(ref, {
      score: 0,
      lastUpdate: serverTimestamp(),
    }).catch((err) => console.warn("⚠️ resetScore Firestore :", err.message));
  }
}
