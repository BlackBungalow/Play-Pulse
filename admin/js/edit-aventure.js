// ===========================================================
// ⚙️ edit-aventure.js (v4.0 - compatibilité bucket firebasestorage.app + debug complet)
// ===========================================================

import { app, storage as globalStorage } from "/js/firebase-config.js";
import {
  getFirestore, doc, getDoc, setDoc, Timestamp, serverTimestamp,
  collection, getDocs, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===========================================================
// 🔥 Initialisation Firestore + Storage
// ===========================================================
const db = getFirestore(app);
const storage = globalStorage || getStorage(app);

console.log("🎯 [STORAGE] Bucket utilisé :", storage.bucket);

// ===========================================================
// 🧭 Variables globales
// ===========================================================
let aventureId = localStorage.getItem("editAventureId");

if (!aventureId) {
  alert("❌ Aucune aventure sélectionnée pour édition.");
  window.location.href = "admin.html";
}

const form = document.getElementById("editForm");
const poiContainer = document.getElementById("poiContainer");
const addPoiBtn = document.getElementById("addPoiBtn");
const backBtn = document.getElementById("backBtn");
const lineaireBanner = document.getElementById("lineaireBanner");
const illustrationInput = document.getElementById("illustration");
const illustrationPreview = document.getElementById("illustrationPreview");

let aventureLineaire = false;
let hasUnsavedChanges = false;
let currentIllustrationUrl = null;
let currentPois = []; // 🌍 Stockage global des POI chargés

console.log("🧭 [INIT] Chargement du module edit-aventure.js...");
console.log("📌 ID aventure :", aventureId);

// ===========================================================
// ⚠️ Alerte si on quitte sans sauvegarder
// ===========================================================
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = "⚠️ Vos modifications ne sont pas enregistrées.";
  }
});

if (backBtn) {
  backBtn.addEventListener("click", (e) => {
    if (hasUnsavedChanges && !confirm("⚠️ Vos modifications ne sont pas enregistrées. Quitter quand même ?")) {
      e.preventDefault();
    } else {
      window.location.href = "admin.html";
    }
  });
}

document.addEventListener("input", () => (hasUnsavedChanges = true));

// ===========================================================
// 📦 Upload média Firebase Storage (corrigé pour CORS + suppression ancienne URL)
// ===========================================================
async function uploadMediaFile(file, type, poiId, oldUrl = null) {
  if (!file) return null;
  try {
    if (oldUrl) {
      const pathStart = oldUrl.indexOf("/o/") + 3;
      const pathEnd = oldUrl.indexOf("?") > -1 ? oldUrl.indexOf("?") : undefined;
      const oldPath = decodeURIComponent(oldUrl.substring(pathStart, pathEnd));
      const oldRef = ref(storage, oldPath);
      await deleteObject(oldRef);
      console.log(`🗑️ Ancien média supprimé : ${oldPath}`);
    }

    const path = `aventures/${aventureId}/pois/${poiId || "temp"}/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    console.log(`✅ Upload ${type} réussi :`, url);
    return url;
  } catch (err) {
    console.error("❌ Erreur upload média :", err);
    return null;
  }
}

// ===========================================================
// 🖼️ Upload illustration aventure
// ===========================================================
async function uploadIllustration(file, oldUrl = null) {
  if (!file) return null;
  try {
    if (oldUrl) {
      const pathStart = oldUrl.indexOf("/o/") + 3;
      const pathEnd = oldUrl.indexOf("?") > -1 ? oldUrl.indexOf("?") : undefined;
      const oldPath = decodeURIComponent(oldUrl.substring(pathStart, pathEnd));
      const oldRef = ref(storage, oldPath);
      await deleteObject(oldRef);
      console.log(`🗑️ Ancienne illustration supprimée : ${oldPath}`);
    }

    const path = `aventures/${aventureId}/illustration/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    console.log(`✅ Illustration téléversée : ${url}`);
    return url;
  } catch (err) {
    console.error("❌ Erreur upload illustration :", err);
    return null;
  }
}

// ===========================================================
// 🔹 Bannière linéaire
// ===========================================================
function updateLineaireBanner(show) {
  if (!lineaireBanner) return;
  lineaireBanner.style.display = show ? "block" : "none";
}

// ===========================================================
// 🖼️ Preview illustration
// ===========================================================
function renderIllustrationPreview(source) {
  if (!illustrationPreview) return;
  if (!source) {
    illustrationPreview.innerHTML = "";
    return;
  }

  const url = source instanceof File ? URL.createObjectURL(source) : source;
  illustrationPreview.innerHTML = `<img src="${url}" alt="Illustration de l’aventure" style="max-width: 240px; border-radius: 8px;" />`;
}

if (illustrationInput) {
  illustrationInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    renderIllustrationPreview(file || currentIllustrationUrl);
    hasUnsavedChanges = true;
  });
}

// ===========================================================
// 🔹 Chargement aventure + POI
// ===========================================================
async function loadAventure() {
  console.log("📂 Chargement des données de l’aventure...");
  try {
    const docRef = doc(db, "aventures", aventureId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      alert("❌ Aventure introuvable");
      window.location.href = "admin.html";
      return;
    }

    const data = snap.data();
    console.log("✅ Données aventure récupérées :", data);

    form.pays.value = data.pays || "";
    form.ville.value = data.ville || "";
    form.nom.value = data.nom || "";
    form.presentation.value = data.presentation || "";
    currentIllustrationUrl = data.illustrationUrl || null;
    renderIllustrationPreview(currentIllustrationUrl);
    aventureLineaire = !!data.lineaire;

    const lineRadio = form.querySelector(`input[name="lineaire"][value="${String(aventureLineaire)}"]`);
    if (lineRadio) lineRadio.checked = true;
    updateLineaireBanner(aventureLineaire);

    const publicRadio = form.querySelector(`input[name="public"][value="${String(!!data.public)}"]`);
    if (publicRadio) publicRadio.checked = true;

    if (data.dispoDebut?.toDate) form.dispoDebut.value = data.dispoDebut.toDate().toISOString().slice(0, 16);
    if (data.dispoFin?.toDate) form.dispoFin.value = data.dispoFin.toDate().toISOString().slice(0, 16);

    await loadPOIs();
  } catch (err) {
    console.error("❌ Erreur chargement aventure :", err);
  }
}

// ===========================================================
// 🔹 Chargement des POI existants
// ===========================================================
async function loadPOIs() {
  poiContainer.innerHTML = "";
  try {
    console.log("📍 Chargement des POI existants...");
    const poisSnap = await getDocs(collection(db, "aventures", aventureId, "pois"));
    if (poisSnap.empty) {
      poiContainer.innerHTML = `<p style="color:#666;">Aucun POI pour le moment.</p>`;
      console.warn("ℹ️ Aucun POI trouvé pour cette aventure.");
      return;
    }

    let pois = [];
    poisSnap.forEach((poiDoc) => {
      pois.push({ id: poiDoc.id, ...poiDoc.data() });
    });

    // Configurer la variable globale
    currentPois = pois;

    if (aventureLineaire) pois.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

    pois.forEach((poi) => {
      try {
        addPoiToDOM(poi, poi.id);
      } catch (err) {
        console.error("⚠️ Erreur ajout POI dans DOM :", err);
      }
    });

    console.log(`✅ ${pois.length} POI chargés avec succès.`);
  } catch (err) {
    console.error("[EDIT] Erreur chargement POI :", err);
    poiContainer.innerHTML = `<p style="color:#c00;">Erreur de chargement des POI.</p>`;
  }
}

// ===========================================================
// 🧩 Ajout manuel d’un POI via bouton
// ===========================================================
if (addPoiBtn) {
  console.log("🟢 Bouton Ajouter POI détecté, initialisation...");
  addPoiBtn.addEventListener("click", async () => {
    try {
      console.log("➕ Clic sur Ajouter POI...");
      const poiRef = await addDoc(collection(db, "aventures", aventureId, "pois"), {
        lat: 0,
        lng: 0,
        question: "",
        typeMedia: "texte",
        typeReponse: "texte",
        mediaTexte: "",
        reponse: "",
        score: 10,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Nouveau POI créé dans Firestore :", poiRef.id);
      addPoiToDOM({ id: poiRef.id, question: "", typeMedia: "texte", typeReponse: "texte" }, poiRef.id);
      hasUnsavedChanges = true;
    } catch (err) {
      console.error("❌ Erreur création POI :", err);
      alert("Impossible de créer un nouveau POI (voir console).");
    }
  });
} else {
  console.warn("⚠️ Aucun bouton #addPoiBtn trouvé dans le DOM !");
}

// ===========================================================
// 🔹 Ajout d’un POI dans le DOM (inchangé et complet)
// ===========================================================
function addPoiToDOM(poi = {}, poiId = null) {
  console.log(`🧱 Ajout du POI dans le DOM (ID: ${poiId || "nouveau"})`);

  const uniq = Date.now().toString(36);
  const poiDiv = document.createElement("div");
  poiDiv.classList.add("poi-item");
  if (poiId) poiDiv.dataset.id = poiId;

  const checkedIdx = poi.qcmCorrectIndex ?? 0;

  poiDiv.innerHTML = `
    <hr/>
    <h3>📍 Point d’intérêt</h3>

    <label>Coordonnées (lat, lng)</label>
    <input type="text" class="poi-coord" value="${poi.lat || ""}, ${poi.lng || ""}" />

    <label>Rayon d'activation (mètres)</label>
    <input type="number" class="poi-radius" value="${poi.activationRadius || 25}" min="5" max="500" />

    <label>Question</label>
    <input type="text" class="poi-question" value="${poi.question || ""}" />

    <label>Type de média</label>
    <div class="radio-group poi-media-type">
      <label><input type="radio" name="mediaType${uniq}" value="texte" ${!poi.typeMedia || poi.typeMedia === "texte" ? "checked" : ""}> Texte</label>
      <label><input type="radio" name="mediaType${uniq}" value="image" ${poi.typeMedia === "image" ? "checked" : ""}> Image</label>
      <label><input type="radio" name="mediaType${uniq}" value="video" ${poi.typeMedia === "video" ? "checked" : ""}> Vidéo</label>
      <label><input type="radio" name="mediaType${uniq}" value="audio" ${poi.typeMedia === "audio" ? "checked" : ""}> Audio</label>
      <label><input type="radio" name="mediaType${uniq}" value="iframe" ${poi.typeMedia === "iframe" ? "checked" : ""}> Module (Iframe)</label>
    </div>

    <div class="poi-media" style="margin-top:0.5rem;">
      <textarea class="poi-media-texte" rows="2" style="${!poi.typeMedia || poi.typeMedia === "texte" ? "" : "display:none"}">${poi.mediaTexte || ""}</textarea>
      <input type="text" class="poi-media-iframe" placeholder="URL du module (https://...)" style="${poi.typeMedia === "iframe" ? "width:100%;" : "display:none; width:100%;"}" value="${poi.mediaUrl || ""}">
      <input type="file" class="poi-media-fichier" style="${["image", "video", "audio"].includes(poi.typeMedia) ? "" : "display:none"}" >
    <div class="mediaPreview">
      ${poi.image
      ? `<img src="${poi.image}" width="120"/>`
      : poi.video
        ? `<video src="${poi.video}" width="120" controls></video>`
        : poi.audio
          ? `<audio src="${poi.audio}" controls style="width:120px;"></audio>`
          : poi.typeMedia === "iframe"
            ? `<iframe src="${poi.mediaUrl}" width="120" height="80"></iframe>`
            : ""
    }
    </div>
    </div >

    <label>Type de réponse</label>
    <div class="radio-group poi-reponse-type">
      <label><input type="radio" name="reponseType${uniq}" value="texte" ${!poi.typeReponse || poi.typeReponse === "texte" ? "checked" : ""}> Texte</label>
      <label><input type="radio" name="reponseType${uniq}" value="qcm" ${poi.typeReponse === "qcm" ? "checked" : ""}> QCM</label>
      <label><input type="radio" name="reponseType${uniq}" value="vocal" ${poi.typeReponse === "vocal" ? "checked" : ""}> Vocal</label>
      <label><input type="radio" name="reponseType${uniq}" value="captureMedia" ${poi.typeReponse === "captureMedia" ? "checked" : ""}> captureMedia</label>
    </div>

    <div class="reponse-zone"></div>

    <label>Score</label>
    <input type="number" class="poi-score" value="${poi.score || 10}" />

    <div class="poi-limit-container" style="margin-top:12px;">
      <label>
        <input type="checkbox" class="poi-limit-checkbox" ${poi.limitAttempts ? "checked" : ""} />
        Limiter le nombre de tentatives
      </label>
      <div class="poi-limit-input" style="${poi.limitAttempts ? "display:block" : "display:none"}; margin-top:4px;">
        <label>Nombre maximum :</label>
        <input type="number" class="poi-max-attempts" value="${poi.maxAttempts || 3}" min="1" max="10" style="width:80px;" />
      </div>
    </div >

    <div style="margin-top:8px;display:flex;gap:8px;">
      <button type="button" class="duplicatePoiBtn" ${poiId ? `data-id="${poiId}"` : ""}>📄 Dupliquer</button>
      <button type="button" class="deletePoiBtn" ${poiId ? `data-id="${poiId}"` : ""}>🗑️ Supprimer</button>
    </div>
  `;

  poiContainer.appendChild(poiDiv);

  // === Gestion du type de média ===
  const radiosMedia = poiDiv.querySelectorAll(`input[name = "mediaType${uniq}"]`);
  const mediaText = poiDiv.querySelector(".poi-media-texte");
  const mediaFile = poiDiv.querySelector(".poi-media-fichier");
  const preview = poiDiv.querySelector(".mediaPreview");

  function renderPreview(file, type) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    let html = "";
    if (type === "image") html = `< img src = "${url}" width = "120" /> `;
    if (type === "video") html = `< video src = "${url}" width = "120" controls ></video > `;
    if (type === "audio") html = `< audio src = "${url}" controls style = "width:120px;" ></audio > `;
    preview.innerHTML = html;
  }

  radiosMedia.forEach(radio => {
    radio.addEventListener("change", () => {
      const type = poiDiv.querySelector(`input[name="mediaType${uniq}"]:checked`).value;
      mediaText.style.display = "none";
      mediaFile.style.display = "none";
      const mediaIframe = poiDiv.querySelector(".poi-media-iframe");
      if (mediaIframe) mediaIframe.style.display = "none";

      const prev = poiDiv.querySelector(".mediaPreview");
      if (prev) prev.innerHTML = "";

      if (type === "texte") mediaText.style.display = "block";
      else if (type === "iframe") {
        if (mediaIframe) mediaIframe.style.display = "block";
      }
      else if (["image", "video", "audio"].includes(type)) {
        mediaFile.style.display = "block";
        mediaFile.accept = `${type}/*`;
      }
    });
  });

  mediaFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    const type = poiDiv.querySelector(`input[name="mediaType${uniq}"]:checked`).value;
    renderPreview(file, type);
    hasUnsavedChanges = true;
  });

  // === Gestion dynamique du bloc réponse ===
  const reponseZone = poiDiv.querySelector(".reponse-zone");
  const radiosReponse = poiDiv.querySelectorAll(`input[name="reponseType${uniq}"]`);

  function renderReponse(type) {
    if (type === "texte") {
      reponseZone.innerHTML = `
        <div class="reponse-texte">
          <label>Réponse attendue</label>
          <input type="text" class="poi-reponse-texte" value="${poi.reponse || ""}" />
        </div>`;
    } else if (type === "vocal") {
      reponseZone.innerHTML = `
        <div class="reponse-vocale">
          <label>Phrase à prononcer</label>
          <input type="text" class="poi-reponse-vocale" value="${poi.reponse || ""}" />
          <small style="color:#666;">Fallback texte si navigateur incompatible.</small>
        </div>`;
    } else if (type === "qcm") {
      const checkedIdx = poi.qcmCorrectIndex ?? 0;
      reponseZone.innerHTML = `
        <div class="qcm">
          <div class="qcm-choice"><input type="radio" name="qcmCorrect${uniq}" value="0" ${checkedIdx === 0 ? "checked" : ""}><input type="text" class="poi-choix1" value="${poi.choix1 || ""}" placeholder="Choix 1" /></div>
          <div class="qcm-choice"><input type="radio" name="qcmCorrect${uniq}" value="1" ${checkedIdx === 1 ? "checked" : ""}><input type="text" class="poi-choix2" value="${poi.choix2 || ""}" placeholder="Choix 2" /></div>
          <div class="qcm-choice"><input type="radio" name="qcmCorrect${uniq}" value="2" ${checkedIdx === 2 ? "checked" : ""}><input type="text" class="poi-choix3" value="${poi.choix3 || ""}" placeholder="Choix 3" /></div>
          <div class="qcm-choice"><input type="radio" name="qcmCorrect${uniq}" value="3" ${checkedIdx === 3 ? "checked" : ""}><input type="text" class="poi-choix4" value="${poi.choix4 || ""}" placeholder="Choix 4" /></div>
        </div>`;
    }
  }

  renderReponse(poi.typeReponse || "texte");
  radiosReponse.forEach(r => {
    r.addEventListener("change", () => {
      const type = poiDiv.querySelector(`input[name="reponseType${uniq}"]:checked`).value;
      renderReponse(type);
    });
  });

  // === Gestion limite de tentatives ===
  const limitCheckbox = poiDiv.querySelector(".poi-limit-checkbox");
  const limitInput = poiDiv.querySelector(".poi-limit-input");
  limitCheckbox.addEventListener("change", () => {
    limitInput.style.display = limitCheckbox.checked ? "block" : "none";
  });

  console.log("✅ POI ajouté au DOM avec succès.");
}

// ===========================================================
// 💾 Sauvegarde aventure complète (corrigée et fonctionnelle)
// ===========================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("💾 Début de sauvegarde de l’aventure...");

  try {
    const aventureRef = doc(db, "aventures", aventureId);

    let illustrationUrl = currentIllustrationUrl;
    const illustrationFile = illustrationInput?.files?.[0];
    if (illustrationFile) {
      illustrationUrl = await uploadIllustration(illustrationFile, currentIllustrationUrl);
    }

    // Récupération des valeurs du formulaire
    const aventureData = {
      pays: form.pays.value.trim(),
      ville: form.ville.value.trim(),
      nom: form.nom.value.trim(),
      lineaire: form.querySelector('input[name="lineaire"]:checked')?.value === "true",
      public: form.querySelector('input[name="public"]:checked')?.value === "true",
      dispoDebut: form.dispoDebut.value ? Timestamp.fromDate(new Date(form.dispoDebut.value)) : null,
      dispoFin: form.dispoFin.value ? Timestamp.fromDate(new Date(form.dispoFin.value)) : null,
      presentation: form.presentation.value.trim(),
      illustrationUrl: illustrationUrl || null,
      updatedAt: serverTimestamp(),
    };

    await setDoc(aventureRef, aventureData, { merge: true });
    console.log("✅ Aventure sauvegardée :", aventureData);
    currentIllustrationUrl = aventureData.illustrationUrl;
    renderIllustrationPreview(currentIllustrationUrl);

    // --- Sauvegarde des POI ---
    const poiItems = poiContainer.querySelectorAll(".poi-item");
    for (const poiDiv of poiItems) {
      const poiId = poiDiv.dataset.id;
      const poiRef = doc(db, "aventures", aventureId, "pois", poiId);

      const coordStr = poiDiv.querySelector(".poi-coord").value;
      const [lat, lng] = coordStr.split(",").map((v) => parseFloat(v.trim()));

      const typeMedia = poiDiv.querySelector(`input[name^="mediaType"]:checked`)?.value || "texte";
      const typeReponse = poiDiv.querySelector(`input[name^="reponseType"]:checked`)?.value || "texte";
      const score = parseInt(poiDiv.querySelector(".poi-score").value) || 10;

      let mediaTexte = "";
      let mediaUrl = null;
      const originalPoi = (currentPois || []).find(p => p.id === poiId) || {};

      // Initialize poiData with common fields
      const poiData = {
        id: poiId || Date.now().toString(36), // Ensure ID
        lat,
        lng,
        question: poiDiv.querySelector(".poi-question").value.trim(),
        typeMedia,
        typeReponse,
        score,
        activationRadius: parseInt(poiDiv.querySelector(".poi-radius").value || "25", 10),
        updatedAt: serverTimestamp(),
      };

      // 🔹 Gestion du média (Texte / Iframe / Fichier)
      if (typeMedia === "texte") {
        poiData.mediaTexte = poiDiv.querySelector(".poi-media-texte")?.value.trim() || "";
      } else if (typeMedia === "iframe") {
        poiData.mediaUrl = poiDiv.querySelector(".poi-media-iframe")?.value.trim() || "";
      } else if (["image", "video", "audio"].includes(typeMedia)) {
        const fileInput = poiDiv.querySelector(".poi-media-fichier");
        if (fileInput && fileInput.files.length > 0) {
          // Upload new file (and delete old if exists)
          const url = await uploadMediaFile(fileInput.files[0], typeMedia, poiData.id, originalPoi[typeMedia]);
          poiData[typeMedia] = url;
        } else {
          // Keep existing
          poiData[typeMedia] = originalPoi[typeMedia];
        }
      }

      // 🔹 QCM
      if (typeReponse === "qcm") {
        poiData.choix1 = poiDiv.querySelector(".poi-choix1")?.value || "";
        poiData.choix2 = poiDiv.querySelector(".poi-choix2")?.value || "";
        poiData.choix3 = poiDiv.querySelector(".poi-choix3")?.value || "";
        poiData.choix4 = poiDiv.querySelector(".poi-choix4")?.value || "";
        poiData.qcmCorrectIndex = parseInt(poiDiv.querySelector('input[name^="qcmCorrect"]:checked')?.value || 0);
      }

      // 🔹 Vocal ou texte simple
      if (typeReponse === "texte" || typeReponse === "vocal") {
        poiData.reponse =
          poiDiv.querySelector(".poi-reponse-texte")?.value ||
          poiDiv.querySelector(".poi-reponse-vocale")?.value ||
          "";
      }

      // 🔹 Limite de tentatives
      poiData.limitAttempts = poiDiv.querySelector(".poi-limit-checkbox")?.checked || false;
      if (poiData.limitAttempts) {
        poiData.maxAttempts = parseInt(poiDiv.querySelector(".poi-max-attempts")?.value || 3);
      }

      // 🔹 Média uploadé (si applicable)
      if (mediaUrl) {
        if (typeMedia === "image") poiData.image = mediaUrl;
        if (typeMedia === "video") poiData.video = mediaUrl;
        if (typeMedia === "audio") poiData.audio = mediaUrl;
      }

      await setDoc(poiRef, poiData, { merge: true });
      console.log(`✅ POI ${poiId} sauvegardé avec succès.`);
    }

    hasUnsavedChanges = false;
    alert("✅ Aventure et POI sauvegardés avec succès !");
  } catch (err) {
    console.error("❌ Erreur pendant la sauvegarde :", err);
    alert("Erreur pendant la sauvegarde. Vérifie la console.");
  }
});


// ===========================================================
// 🧪 Test upload (CORS debug)
// ===========================================================
(async () => {
  console.log("🧪 Test upload direct depuis edit-aventure.js");
  try {
    const response = await fetch("https://picsum.photos/200");
    const blob = await response.blob();
    const url = await uploadMediaFile(blob, "image", "test-poi");
    console.log("🔗 URL obtenue :", url);
  } catch (err) {
    console.error("🚫 Erreur pendant le test upload :", err);
  }
})();

// ===========================================================
// 🧱 DUPLICATION & SUPPRESSION DE POI (corrigées)
// ===========================================================

// Écouteurs globaux pour les boutons dans le DOM
poiContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const poiDiv = btn.closest(".poi-item");
  const poiId = poiDiv?.dataset?.id;

  // --- SUPPRESSION ---
  if (btn.classList.contains("deletePoiBtn")) {
    if (!confirm("🗑️ Supprimer définitivement ce point d’intérêt ?")) return;
    try {
      const poiRef = doc(db, "aventures", aventureId, "pois", poiId);

      // Suppression des médias associés dans Storage
      const poiSnap = await getDoc(poiRef);
      if (poiSnap.exists()) {
        const poiData = poiSnap.data();
        const urls = [poiData.image, poiData.video, poiData.audio];
        for (const url of urls) {
          if (url) {
            const pathStart = url.indexOf("/o/") + 3;
            const pathEnd = url.indexOf("?") > -1 ? url.indexOf("?") : undefined;
            const path = decodeURIComponent(url.substring(pathStart, pathEnd));
            try {
              await deleteObject(ref(storage, path));
              console.log("🗑️ Média supprimé :", path);
            } catch (err) {
              console.warn("⚠️ Erreur suppression média :", err);
            }
          }
        }
      }

      // Suppression du POI Firestore
      await deleteDoc(poiRef);
      poiDiv.remove();
      console.log("✅ POI supprimé :", poiId);
      hasUnsavedChanges = true;
    } catch (err) {
      console.error("❌ Erreur suppression POI :", err);
      alert("Erreur lors de la suppression du POI.");
    }
  }

  // --- DUPLICATION ---
  if (btn.classList.contains("duplicatePoiBtn")) {
    try {
      const oldPoiRef = doc(db, "aventures", aventureId, "pois", poiId);
      const oldSnap = await getDoc(oldPoiRef);
      if (!oldSnap.exists()) return alert("❌ POI introuvable.");

      const oldData = oldSnap.data();
      delete oldData.createdAt;
      delete oldData.updatedAt;

      const newPoiRef = await addDoc(collection(db, "aventures", aventureId, "pois"), {
        ...oldData,
        question: oldData.question + " (copie)",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log("✅ POI dupliqué :", newPoiRef.id);
      addPoiToDOM({ id: newPoiRef.id, ...oldData }, newPoiRef.id);
      hasUnsavedChanges = true;
    } catch (err) {
      console.error("❌ Erreur duplication POI :", err);
      alert("Erreur lors de la duplication du POI.");
    }
  }
});

// ===========================================================
// 🚀 Lancement
// ===========================================================
loadAventure();
