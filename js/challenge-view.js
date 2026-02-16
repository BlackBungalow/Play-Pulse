// js/challenge-view.js (v5.0 – Intégration SpeechRecognition + fallback simulé)
// --------------------------------------------------
// Affichage des défis (texte, image, vidéo, audio)
// avec réponses texte, QCM, vocale ou captureMedia
// --------------------------------------------------

import { app } from "/js/firebase-config.js"; // ✅ ajout essentiel
import { getStorage, ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFirestore, doc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ on relie correctement les services à ton app Firebase
const storage = getStorage(app);
const db = getFirestore(app);

export class ChallengeView {
  constructor(challengeData, callbacks = {}) {
    this.data = challengeData;
    this.onValidate = callbacks.onValidate || (() => { });
    this.onClose = callbacks.onClose || (() => { });
    this.modal = null;
    this.selectedQcmIndex = null;
    this.selectedQcmIndex = null;
    this.recognition = null; // 🎙️ Ajout reconnaissance vocale native
    this.hintsUsed = 0; // 0 = aucun, 1 = indice 1, 2 = indice 2
  }


  /* -------------------------------------------------------------
    🏗️ Création du bloc principal
 ------------------------------------------------------------- */
  render() {
    const d = this.data || {};
    const mediaHtml = this.getMediaHTML(d);
    const responseHtml = this.getResponseHTML(d);

    this.modal = document.createElement("div");
    this.modal.className = "challenge-modal fadeIn";

    this.modal.innerHTML = `
    <div class="challenge-container">
      <header class="challenge-header">
        <h2>${d.nom || d.titre || "🎯 Défi"}</h2>
        <button class="close-btn" id="closeBtn" aria-label="Fermer">✖</button>
      </header>

      <section class="challenge-body">
        ${d.question ? `<p class="challenge-question">${d.question}</p>` : ""}
        
        <!-- 💡 Zone Indices -->
        ${(d.indice1 || d.indice2) ? `
        <div class="hints-container">
          <button id="btnHint" class="btn-hint">💡 Indice (0)</button>
          <p id="hintText" class="hint-text" style="display:none;"></p>
        </div>` : ""}

        ${mediaHtml}
        ${responseHtml}
      </section>

      <footer class="challenge-footer">
        <button class="btn-main" id="validateBtn" disabled>Valider</button>
      </footer>
    </div>
  `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  /* -------------------------------------------------------------
     📤 Upload du média du joueur sur Firebase
  ------------------------------------------------------------- */
  async uploadPlayerMedia(file, aventureId, poiId, playerId) {
    const path = `player_uploads/${aventureId}/${poiId}/${playerId}_${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    console.log("✅ Média joueur enregistré :", url);

    const submissionRef = doc(db, "aventures", aventureId, "submissions", `${poiId}_${playerId}`);
    await setDoc(submissionRef, {
      poiId,
      playerId,
      mediaUrl: url,
      validated: false,
      createdAt: serverTimestamp(),
    });

    return url;
  }


  /* -------------------------------------------------------------
     🎞️ Génération du média
  ------------------------------------------------------------- */
  getMediaHTML(d) {
    const m = d.media || {};
    const image = d.image || m.image;
    const video = d.video || m.video;
    const audio = d.audio || m.audio;
    const texte = d.mediaTexte || d.texteMedia || m.texte;

    let html = "";

    if (texte) html += `<div class="challenge-text-block">${texte}</div>`;
    if (image) html += `<img src="${image}" class="challenge-img" alt="illustration défi">`;

    if (video) {
      const url = video.includes("youtube")
        ? video.replace("watch?v=", "embed/")
        : video;
      html += `<video src="${url}" class="challenge-video" controls playsinline></video>`;
    }

    if (audio) {
      html += `
        <audio src="${audio}" class="challenge-audio" controls>
          Votre navigateur ne supporte pas la lecture audio.
        </audio>`;
    }

    if (d.typeMedia === "iframe" && d.mediaUrl) {
      html += `
        <div class="challenge-iframe-container" style="position:relative; width:100%; height:60vh; overflow:hidden; border-radius:8px; border:1px solid #ddd;">
          <iframe 
            src="${d.mediaUrl}" 
            style="width:100%; height:100%; border:0;" 
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            allow="camera *; microphone *; fullscreen; autoplay; geolocation; clipboard-read; clipboard-write">
          </iframe>
        </div>`;
    }

    return html ? `<section class="challenge-media">${html}</section>` : "";
  }

  /* -------------------------------------------------------------
     💬 Bloc de réponse
  ------------------------------------------------------------- */
  getResponseHTML(d) {
    const type = d.typeReponse || "texte";
    let html = "";

    if (type === "texte") {
      html = `
      < div class="answer-block" id = "textAnswerBlock" >
        <input type="text" id="challengeAnswer" placeholder="Votre réponse..." autocomplete="off" />
        </div > `;
    } else if (type === "qcm") {
      const options = [d.choix1, d.choix2, d.choix3, d.choix4].filter(Boolean);
      if (options.length) {
        html = `
      < div class="answer-block" id = "qcmAnswerBlock" >
        ${options
            .map(
              (opt, i) =>
                `<button class="qcm-btn" data-index="${i}">${opt}</button>`
            )
            .join("")
          }
          </div > `;
      } else {
        html = `< p class="challenge-error" >⚠️ QCM non configuré.</p > `;
      }
    } else if (type === "vocal") {
      html = `
      < div class="answer-block" id = "vocalAnswerBlock" >
          <button id="btnVocal" class="btn-vocal">🎤 Démarrer l'écoute</button>
          <p id="vocalFeedback" class="vocal-feedback"></p>
        </div > `;
    } else if (type === "captureMedia") {
      html = `
      < div class="answer-block" id = "mediaCaptureBlock" >
        <input type="file" id="playerMediaInput"
          accept="image/*,video/*" capture="environment">
          <p id="mediaFeedback" class="vocal-feedback"></p>
        </div>`;
    }

    return html;
  }

  /* -------------------------------------------------------------
     🔗 Gestion des interactions utilisateur
  ------------------------------------------------------------- */
  bindEvents() {
    const validateBtn = this.modal.querySelector("#validateBtn");
    const closeBtn = this.modal.querySelector("#closeBtn");
    const textInput = this.modal.querySelector("#challengeAnswer");
    const qcmButtons = this.modal.querySelectorAll(".qcm-btn");
    const vocalBtn = this.modal.querySelector("#btnVocal");

    // 🚪 Fermeture
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());

    // ✍️ Texte
    if (textInput) {
      textInput.addEventListener("input", () => {
        validateBtn.disabled = textInput.value.trim().length === 0;
      });
    }

    // 🧩 QCM
    qcmButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        qcmButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.selectedQcmIndex = parseInt(btn.dataset.index, 10);
        validateBtn.disabled = false;
      });
    });

    // 🧠 Validation
    if (validateBtn) {
      validateBtn.addEventListener("click", async () => {
        // Cas particulier : défi de type capture photo / vidéo
        if (this.data.typeReponse === "captureMedia") {
          const fileInput = this.modal.querySelector("#playerMediaInput");
          const file = fileInput?.files[0];
          if (!file) return alert("📸 Merci de prendre une photo ou une vidéo avant de valider !");

          // ✅ Récupération propre de l’ID d’aventure
          const aventureId =
            this.data.aventureId ||
            localStorage.getItem("CURRENT_ADVENTURE_ID") ||
            localStorage.getItem("editAventureId") ||
            "unknown-aventure";

          const poiId = this.data.id || "unknown-poi";
          const playerId = localStorage.getItem("playerId") || "anonymous";

          try {
            // ✅ Message pendant l’envoi
            this.showStatusPopup("⏳ Votre envoi est en cours de validation...");
            await this.uploadPlayerMedia(file, aventureId, poiId, playerId);
            alert("✅ Média envoyé pour validation par l’administrateur !");
            this.onValidate("media-uploaded");
          } catch (err) {
            console.error("❌ Erreur lors de l’envoi du média :", err);
            alert("Une erreur est survenue pendant l’envoi du média.");
          }
          return;
        }

        // Cas normal : texte / QCM / vocal
        const response = this.getResponse();
        if (response !== null && response !== undefined && response !== "") {
          this.onValidate(response, { hintsUsed: this.hintsUsed });
        }
      });
    }


    // 📸 Activation du bouton "Valider" quand un média est choisi (nouveau)
    const mediaInput = this.modal.querySelector("#playerMediaInput");
    if (mediaInput) {
      mediaInput.addEventListener("change", () => {
        const file = mediaInput.files[0];
        validateBtn.disabled = !file; // active le bouton si un fichier est choisi
      });
    }

    // 🎙️ Activation vocale
    if (vocalBtn) {
      vocalBtn.addEventListener("click", () => this.startVocalRecognition());
    }

    // 💡 Gestion des indices
    const btnHint = this.modal.querySelector("#btnHint");
    const hintText = this.modal.querySelector("#hintText");

    if (btnHint && hintText) {
      btnHint.addEventListener("click", () => {
        // Si on n'a pas encore utilisé d'indice
        if (this.hintsUsed === 0) {
          if (this.data.indice1) {
            this.hintsUsed = 1;
            hintText.textContent = `💡 Indice 1 : ${this.data.indice1} `;
            hintText.style.display = "block";
            hintText.style.color = "#d97706";
            btnHint.textContent = "💡 Indice suivant (-20%)";
            // Si pas d'indice 2, on désactive le bouton
            if (!this.data.indice2) btnHint.style.display = "none";
          } else if (this.data.indice2) {
            // Cas rare ou indice 1 vide mais 2 existe
            this.hintsUsed = 2;
            hintText.textContent = `💡 Indice 2 : ${this.data.indice2} `;
            hintText.style.display = "block";
            btnHint.style.display = "none";
          }
        }
        // Si on a déjà vu l'indice 1, on veut le 2
        else if (this.hintsUsed === 1 && this.data.indice2) {
          this.hintsUsed = 2;
          hintText.innerHTML += `< br > <br>💡 Indice 2 : ${this.data.indice2}`;
          btnHint.style.display = "none";
        }
      });
    }
  }

  /* -------------------------------------------------------------
     🔔 Popup d’état (upload / attente validation)
  ------------------------------------------------------------- */
  showStatusPopup(message, duration = 3000) {
    const popup = document.createElement("div");
    popup.className = "status-popup";
    popup.textContent = message;
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.classList.add("fadeOut");
      setTimeout(() => popup.remove(), 500);
    }, duration);
  }


  /* -------------------------------------------------------------
     🎤 Vraie reconnaissance vocale via Web Speech API
  ------------------------------------------------------------- */
  startVocalRecognition() {
    const feedback = this.modal.querySelector("#vocalFeedback");
    const btn = this.modal.querySelector("#btnVocal");
    const validateBtn = this.modal.querySelector("#validateBtn");

    if (!feedback || !btn) return;

    // ✅ Vérifie support navigateur
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("⚠️ SpeechRecognition non supportée, fallback simulé.");
      return this.fakeRecognition(feedback, btn, validateBtn);
    }

    try {
      // Initialisation API
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "fr-FR";
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      feedback.textContent = "🎧 Écoute en cours...";
      btn.disabled = true;

      this.recognition.start();

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log("🎤 Reconnu :", transcript);
        feedback.textContent = `✅ Réponse captée : "${transcript}"`;
        feedback.dataset.recognized = transcript;
        validateBtn.disabled = false;
        btn.disabled = false;
      };

      this.recognition.onerror = (err) => {
        console.error("❌ Erreur reconnaissance :", err);
        feedback.textContent =
          "❌ Erreur reconnaissance vocale : " + (err.error || "inconnue");
        btn.disabled = false;
      };

      this.recognition.onend = () => {
        if (btn.disabled) btn.disabled = false;
        console.log("🎙️ Fin d'écoute.");
      };
    } catch (err) {
      console.error("❌ Exception SpeechRecognition :", err);
      this.fakeRecognition(feedback, btn, validateBtn);
    }
  }

  /* -------------------------------------------------------------
     🎧 Fallback simulé (comme avant)
  ------------------------------------------------------------- */
  fakeRecognition(feedback, btn, validateBtn) {
    feedback.textContent = "🎧 Écoute simulée...";
    btn.disabled = true;

    setTimeout(() => {
      const fake = "mot clé détecté";
      feedback.textContent = `✅ Réponse simulée : "${fake}"`;
      feedback.dataset.recognized = fake;
      validateBtn.disabled = false;
      btn.disabled = false;
    }, 2000);
  }

  /* -------------------------------------------------------------
     🧩 Récupération réponse
  ------------------------------------------------------------- */
  getResponse() {
    const textInput = this.modal.querySelector("#challengeAnswer");
    const qcmSelected = this.modal.querySelector(".qcm-btn.selected");
    const feedback = this.modal.querySelector("#vocalFeedback");
    let response = null;

    if (textInput && textInput.value.trim()) response = textInput.value.trim();
    else if (qcmSelected) response = this.selectedQcmIndex;
    else if (feedback && feedback.dataset.recognized)
      response = feedback.dataset.recognized;

    return response;
  }

  /* -------------------------------------------------------------
     🚪 Fermeture
  ------------------------------------------------------------- */
  close() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn("Erreur arrêt reconnaissance :", e);
      }
    }
    this.modal.classList.add("fadeOut");
    setTimeout(() => {
      if (this.modal && this.modal.remove) this.modal.remove();
      this.onClose();
    }, 250);
  }
}
