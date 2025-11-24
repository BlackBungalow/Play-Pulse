// create-aventure.js (v6.5 – fix Firestore POI + tri linéaire + limite tentatives dynamique)
import { app } from "/js/firebase-config.js";
import {
  getFirestore, doc, setDoc, addDoc, getDoc, deleteDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const db = getFirestore(app);
const storage = getStorage(app);
const form = document.getElementById("createForm");
const poiContainer = document.getElementById("poiContainer");
const addPoiBtn = document.getElementById("addPoiBtn");

let aventureId = null;
let hasUnsavedChanges = false;
let aventureLineaire = false;

// ===========================================================
// 📦 Upload média Firebase Storage
// ===========================================================
async function uploadMediaFile(file, type, aventureId, oldUrl = null) {
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
    const path = `aventures/${aventureId}/medias/${type}/${Date.now()}_${file.name}`;
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
// ➕ Ajout d’un POI dans le DOM
// ===========================================================
function addPoiToDOM(poi = {}, poiId = null) {
  const uniq = Date.now().toString(36);
  const poiDiv = document.createElement("div");
  poiDiv.classList.add("poi-item");
  if (poiId) poiDiv.dataset.id = poiId;

  // --- Champ ordre si aventure linéaire ---
  const ordreHtml = aventureLineaire
    ? `<label>Ordre d’apparition</label>
       <input type="number" class="poi-ordre" value="${poi.ordre ?? 0}" min="0" step="1" style="width:80px;">`
    : "";

  poiDiv.innerHTML = `
    <hr/>
    <h3>📍 Point d’intérêt</h3>
    ${ordreHtml}

    <label>Coordonnées (lat, lng)</label>
    <input type="text" class="poi-coord" placeholder="Ex: 48.8566, 2.3522" value="${poi.lat || ""}, ${poi.lng || ""}" />

    <label>Question</label>
    <input type="text" class="poi-question" placeholder="Intitulé du défi" value="${poi.question || ""}" />

    <label>Type de média</label>
    <div class="radio-group poi-media-type">
      <label><input type="radio" name="mediaType${uniq}" value="texte" ${!poi.typeMedia || poi.typeMedia === "texte" ? "checked" : ""}> Texte</label>
      <label><input type="radio" name="mediaType${uniq}" value="image" ${poi.typeMedia === "image" ? "checked" : ""}> Image</label>
      <label><input type="radio" name="mediaType${uniq}" value="video" ${poi.typeMedia === "video" ? "checked" : ""}> Vidéo</label>
      <label><input type="radio" name="mediaType${uniq}" value="audio" ${poi.typeMedia === "audio" ? "checked" : ""}> Audio</label>
    </div>

    <div class="poi-media" style="margin-top:0.5rem;">
      <textarea class="poi-media-texte" rows="2" style="${!poi.typeMedia || poi.typeMedia === "texte" ? "" : "display:none"}">${poi.mediaTexte || ""}</textarea>
      <input type="file" class="poi-media-fichier" style="${["image","video","audio"].includes(poi.typeMedia) ? "" : "display:none"}">
      <div class="mediaPreview">
        ${
          poi.image
            ? `<img src="${poi.image}" width="120"/>`
            : poi.video
            ? `<video src="${poi.video}" width="120" controls></video>`
            : poi.audio
            ? `<audio src="${poi.audio}" controls style="width:120px;"></audio>`
            : ""
        }
      </div>
    </div>

    <label>Type de réponse</label>
    <div class="radio-group poi-reponse-type">
      <label><input type="radio" name="reponseType${uniq}" value="texte" ${!poi.typeReponse || poi.typeReponse === "texte" ? "checked" : ""}> Texte</label>
      <label><input type="radio" name="reponseType${uniq}" value="qcm" ${poi.typeReponse === "qcm" ? "checked" : ""}> QCM</label>
      <label><input type="radio" name="reponseType${uniq}" value="vocal" ${poi.typeReponse === "vocal" ? "checked" : ""}> Vocal</label>
    </div>

    <div class="reponse-zone"></div>

    <label>Score</label>
    <input type="number" class="poi-score" value="${poi.score || 10}" />

    <div class="poi-limit-container" style="margin-top:12px;">
      <label>
        <input type="checkbox" class="poi-limit-checkbox" ${poi.limitAttempts ? "checked" : ""}/>
        Limiter le nombre de tentatives
      </label>
      <div class="poi-limit-input" style="${poi.limitAttempts ? "display:block" : "display:none"}; margin-top:4px;">
        <label>Nombre maximum :</label>
        <input type="number" class="poi-max-attempts" value="${poi.maxAttempts || 3}" min="1" max="10" style="width:80px;" />
      </div>
    </div>

    <div style="margin-top:8px;display:flex;gap:8px;">
      <button type="button" class="duplicatePoiBtn">📄 Dupliquer</button>
      <button type="button" class="deletePoiBtn">🗑️ Supprimer</button>
    </div>
  `;

  poiContainer.appendChild(poiDiv);

  // === Gestion des médias ===
  const radiosMedia = poiDiv.querySelectorAll(`input[name="mediaType${uniq}"]`);
  const mediaText = poiDiv.querySelector(".poi-media-texte");
  const mediaFile = poiDiv.querySelector(".poi-media-fichier");
  const preview = poiDiv.querySelector(".mediaPreview");

  function renderPreview(file, type) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    let html = "";
    if (type === "image") html = `<img src="${url}" width="120" />`;
    if (type === "video") html = `<video src="${url}" width="120" controls></video>`;
    if (type === "audio") html = `<audio src="${url}" controls style="width:120px;"></audio>`;
    preview.innerHTML = html;
  }

  radiosMedia.forEach(radio => {
    radio.addEventListener("change", () => {
      const type = poiDiv.querySelector(`input[name="mediaType${uniq}"]:checked`).value;
      mediaText.style.display = "none";
      mediaFile.style.display = "none";
      preview.innerHTML = "";
      if (type === "texte") mediaText.style.display = "block";
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

  // === ✅ Gestion limite de tentatives (fix dynamique) ===
  const limitCheckbox = poiDiv.querySelector(".poi-limit-checkbox");
  const limitInput = poiDiv.querySelector(".poi-limit-input");
  limitCheckbox.addEventListener("change", () => {
    limitInput.style.display = limitCheckbox.checked ? "block" : "none";
  });

  console.log("✅ POI ajouté au DOM avec succès.");

  // === Tri automatique si linéaire ===
  if (aventureLineaire) sortPoisByOrder();
}

// ===========================================================
// 🎚️ Gestion du mode Linéaire / Libre dynamique
// ===========================================================
const lineaireRadios = form.querySelectorAll('input[name="lineaire"]');
lineaireRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    aventureLineaire = radio.value === "true";
    console.log("🧭 Mode linéaire :", aventureLineaire);
    const pois = poiContainer.querySelectorAll(".poi-item");
    pois.forEach(p => p.remove());
    if (aventureLineaire) console.log("ℹ️ Les prochains POI auront un champ d’ordre visible.");
  });
});

// ===========================================================
// ➕ Ajouter un POI
// ===========================================================
addPoiBtn.addEventListener("click", () => addPoiToDOM());

// ===========================================================
// 🔢 Tri automatique des POI en mode linéaire
// ===========================================================
function sortPoisByOrder() {
  const pois = Array.from(poiContainer.children);
  pois.sort((a, b) => {
    const ordreA = parseInt(a.querySelector(".poi-ordre")?.value || 0);
    const ordreB = parseInt(b.querySelector(".poi-ordre")?.value || 0);
    return ordreA - ordreB;
  });
  poiContainer.innerHTML = "";
  pois.forEach(p => poiContainer.appendChild(p));
  console.log("🔃 POI triés par ordre linéaire.");
}

// ===========================================================
// 💾 Sauvegarde Aventure + POI + Upload médias
// ===========================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nom = form.nom.value.trim();
  if (!nom) return alert("Merci de donner un nom à ton aventure !");
  aventureId = nom.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  aventureLineaire = form.querySelector('input[name="lineaire"]:checked').value === "true";

  const aventureData = {
    nom,
    pays: form.pays.value.trim(),
    ville: form.ville.value.trim(),
    lineaire: aventureLineaire,
    public: form.querySelector('input[name="public"]:checked').value === "true",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const aventureRef = doc(db, "aventures", aventureId);
  await setDoc(aventureRef, aventureData, { merge: true });
  console.log("📘 Aventure sauvegardée :", aventureId);

  // Tri si linéaire avant sauvegarde
  if (aventureLineaire) sortPoisByOrder();

  // Ajout POI
  const poisCollection = collection(aventureRef, "pois");
  const items = poiContainer.querySelectorAll(".poi-item");

  for (const item of items) {
    const [lat, lng] = (item.querySelector(".poi-coord").value || "0,0").split(",").map(v => parseFloat(v.trim()));
    const typeMedia = item.querySelector("input[name^='mediaType']:checked").value;
    const typeReponse = item.querySelector("input[name^='reponseType']:checked").value;

    const poi = {
      lat, lng,
      question: item.querySelector(".poi-question").value.trim(),
      typeMedia,
      typeReponse,
      score: parseInt(item.querySelector(".poi-score").value || "10", 10),
      ordre: aventureLineaire ? parseInt(item.querySelector(".poi-ordre")?.value || 0) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const limitAttempts = item.querySelector(".poi-limit-checkbox").checked;
    const maxAttempts = parseInt(item.querySelector(".poi-max-attempts")?.value || "3", 10);
    poi.limitAttempts = limitAttempts;
    if (limitAttempts) poi.maxAttempts = maxAttempts;

    if (["image", "video", "audio"].includes(typeMedia)) {
      const file = item.querySelector(".poi-media-fichier").files[0];
      if (file) poi[typeMedia] = await uploadMediaFile(file, typeMedia, aventureId);
    } else if (typeMedia === "texte") {
      poi.mediaTexte = item.querySelector(".poi-media-texte")?.value.trim() || "";
    }

    if (typeReponse === "texte")
      poi.reponse = item.querySelector(".poi-reponse-texte").value.trim();
    if (typeReponse === "vocal")
      poi.reponse = item.querySelector(".poi-reponse-vocale").value.trim();
    if (typeReponse === "qcm") {
      poi.choix1 = item.querySelector(".poi-choix1").value.trim();
      poi.choix2 = item.querySelector(".poi-choix2").value.trim();
      poi.choix3 = item.querySelector(".poi-choix3").value.trim();
      poi.choix4 = item.querySelector(".poi-choix4").value.trim();
      const checked = item.querySelector(`input[name^='qcmCorrect']:checked`);
      poi.qcmCorrectIndex = checked ? parseInt(checked.value) : 0;
    }

    await addDoc(poisCollection, poi);
    console.log("📍 POI sauvegardé :", poi);
  }

  localStorage.setItem("editAventureId", aventureId);
  alert("✅ Aventure créée avec succès !");
  window.location.href = "edit-aventure.html";
});

// ===========================================================
// 🧱 DUPLICATION & SUPPRESSION DE POI
// ===========================================================
poiContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const poiDiv = btn.closest(".poi-item");

  if (btn.classList.contains("deletePoiBtn")) {
    poiDiv.remove();
    console.log("🗑️ POI supprimé localement.");
  }

  if (btn.classList.contains("duplicatePoiBtn")) {
    const clone = poiDiv.cloneNode(true);
    clone.querySelectorAll("input, textarea").forEach(el => {
      if (el.type === "radio" || el.type === "checkbox") el.checked = el.defaultChecked;
    });
    poiContainer.appendChild(clone);
    console.log("📄 POI dupliqué localement.");
    if (aventureLineaire) sortPoisByOrder();
  }
});
