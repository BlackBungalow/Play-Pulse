// admin/js/admin.js (v4.0 - Refonte visuelle claire des cartes d’aventures)
import {
  getFirestore, collection, getDocs, getDoc, setDoc, addDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app } from "/js/firebase-config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);
  const aventuresRef = collection(db, "aventures");
  const container = document.getElementById("aventuresContainer");
  const newBtn = document.getElementById("newAventureBtn");

  // ===========================================================
  // 🆕 Bouton de création d’aventure
  // ===========================================================
  newBtn.addEventListener("click", () => {
    window.location.href = "create-aventure.html";
  });

  try {
    const snapshot = await getDocs(aventuresRef);
    const aventures = [];

    // 1️⃣ Récupération des aventures
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      data.id = docSnap.id;
      aventures.push(data);
    });

    // 2️⃣ Comptage des POI
    const adventuresWithPOIs = await Promise.all(aventures.map(async aventure => {
      const poisSnap = await getDocs(collection(db, "aventures", aventure.id, "pois"));
      aventure.poiCount = poisSnap.size;
      return aventure;
    }));

    // 3️⃣ Groupement par pays / ville
    const grouped = {};
    adventuresWithPOIs.forEach(aventure => {
      const { pays = "Autre", ville = "Inconnue" } = aventure;
      if (!grouped[pays]) grouped[pays] = {};
      if (!grouped[pays][ville]) grouped[pays][ville] = [];
      grouped[pays][ville].push(aventure);
    });

    // 4️⃣ Filtres dynamiques
    createFilters(grouped);

    // 5️⃣ Affichage principal
    renderAventures(grouped);

    // 6️⃣ Filtres dynamiques
    document.getElementById("paysFilter").addEventListener("change", () => applyFilters(grouped));
    document.getElementById("villeFilter").addEventListener("change", () => applyFilters(grouped));

    // 7️⃣ Gestion des actions (éditer, voir, dupliquer, supprimer)
    container.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      // ✏️ Modifier
      if (e.target.classList.contains("edit-btn")) {
        localStorage.setItem("editAventureId", id);
        window.location.href = "edit-aventure.html";
      }

      // 👁 Visualiser
      if (e.target.classList.contains("view-btn")) {
        localStorage.setItem("viewAventureId", id);
        window.open(`./test-aventure.html?id=${id}`, "_blank");
      }

      // 🗑️ Supprimer
      if (e.target.classList.contains("delete-btn")) {
        if (confirm("Supprimer cette aventure ?")) {
          await deleteDoc(doc(db, "aventures", id));
          alert("Aventure supprimée.");
          location.reload();
        }
      }

      // 📄 Dupliquer
      if (e.target.classList.contains("duplicate-btn")) {
        const confirmDup = confirm("Dupliquer cette aventure ?");
        if (!confirmDup) return;

        try {
          await duplicateAventure(db, id);
          alert("✅ Aventure dupliquée !");
          location.reload();
        } catch (err) {
          console.error("Erreur duplication :", err);
          alert("❌ Échec de la duplication (voir console).");
        }
      }
    });

  } catch (err) {
    console.error("❌ Erreur de chargement des aventures :", err);
    alert("Erreur de chargement (voir console).");
  }

  // ===========================================================
  // 🧩 FONCTIONS UTILITAIRES
  // ===========================================================

  function createReadableId(name) {
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  // 🗂️ Création des filtres dynamiques
  function createFilters(grouped) {
    const paysSelect = document.getElementById("paysFilter");
    const villeSelect = document.getElementById("villeFilter");

    paysSelect.innerHTML = `<option value="all">🌍 Tous les pays</option>`;
    Object.keys(grouped).forEach(pays => {
      const count = Object.values(grouped[pays]).flat().length;
      paysSelect.innerHTML += `<option value="${pays}">${pays} (${count})</option>`;
    });

    villeSelect.innerHTML = `<option value="all">🏙️ Toutes les villes</option>`;
  }

  // 🎨 Rendu principal amélioré
  function renderAventures(grouped, selectedPays = "all", selectedVille = "all") {
    container.innerHTML = "";

    for (const pays in grouped) {
      if (selectedPays !== "all" && pays !== selectedPays) continue;

      const totalAventuresPays = Object.values(grouped[pays]).flat().length;
      const paysDiv = document.createElement("section");
      paysDiv.classList.add("pays-section");
      const paysTitle = document.createElement("h2");
      paysTitle.classList.add("country-title");
      paysTitle.textContent = `🌍 ${pays} (${totalAventuresPays} aventures)`;
      paysDiv.appendChild(paysTitle);

      const villes = grouped[pays];
      for (const ville in villes) {
        if (selectedVille !== "all" && ville !== selectedVille) continue;

        const totalVille = villes[ville].length;
        const villeDiv = document.createElement("div");
        villeDiv.classList.add("ville-section");
        const villeTitle = document.createElement("h3");
        villeTitle.classList.add("city-title");
        villeTitle.textContent = `🏙️ ${ville} (${totalVille})`;
        villeDiv.appendChild(villeTitle);

        villes[ville].forEach(aventure => {
          const card = document.createElement("div");
          card.className = "aventure-card";

          const createdAt = formatDate(aventure.createdAt);
          const updatedAt = formatDate(aventure.updatedAt);

          card.innerHTML = `
            <div class="aventure-header">
              <h3>🏝️ ${aventure.nom || "(Sans titre)"}</h3>
              <span class="tag ${aventure.public ? "public" : "prive"}">${aventure.public ? "Public" : "Privé"}</span>
              <span class="tag ${aventure.lineaire ? "lineaire" : "libre"}">${aventure.lineaire ? "Linéaire" : "Libre"}</span>
              <span class="tag poi">${aventure.poiCount || 0} POI</span>
            </div>

            <div class="aventure-meta">
              <small>📍 ${aventure.ville || "Ville inconnue"} — ${aventure.pays || "Pays inconnu"}</small><br>
              <small>🕒 Créée : ${createdAt}</small> |
              <small>✏️ Modifiée : ${updatedAt}</small>
            </div>

            <div class="aventure-actions">
              <button class="btn btn-edit edit-btn" data-id="${aventure.id}">✏️ Modifier</button>
              <button class="btn btn-view view-btn" data-id="${aventure.id}">👁️ Visualiser</button>
              <button class="btn btn-copy duplicate-btn" data-id="${aventure.id}">📄 Dupliquer</button>
              <button class="btn btn-delete delete-btn" data-id="${aventure.id}">🗑️ Supprimer</button>
            </div>
          `;

          villeDiv.appendChild(card);
        });

        paysDiv.appendChild(villeDiv);
      }

      container.appendChild(paysDiv);
    }
  }

  // 🎯 Application des filtres
  function applyFilters(grouped) {
    const selectedPays = document.getElementById("paysFilter").value;
    const selectedVille = document.getElementById("villeFilter").value;

    if (selectedPays !== "all") {
      const villes = Object.keys(grouped[selectedPays]);
      const villeSelect = document.getElementById("villeFilter");
      villeSelect.innerHTML = `<option value="all">🏙️ Toutes les villes</option>`;
      villes.forEach(ville => {
        const count = grouped[selectedPays][ville].length;
        villeSelect.innerHTML += `<option value="${ville}">${ville} (${count})</option>`;
      });
    }

    renderAventures(grouped, selectedPays, selectedVille);
  }

  // 🧩 Formatage des dates
  function formatDate(ts) {
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : ts;
    return date.toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  // 📋 Duplication d’une aventure (avec ID lisible)
  async function duplicateAventure(db, originalId) {
    const originalRef = doc(db, "aventures", originalId);
    const originalSnap = await getDoc(originalRef);
    if (!originalSnap.exists()) throw new Error("Aventure source introuvable.");

    const originalData = originalSnap.data();
    const newName = generateNewName(originalData.nom || "Aventure sans titre");

    const readableId = createReadableId(newName);
    const newAventure = {
      ...originalData,
      nom: newName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(doc(db, "aventures", readableId), newAventure);

    const poisSnap = await getDocs(collection(db, "aventures", originalId, "pois"));
    for (const poi of poisSnap.docs) {
      const data = poi.data();
      await addDoc(collection(db, "aventures", readableId, "pois"), data);
    }
  }

  function generateNewName(oldName) {
    const match = oldName.match(/\((\d+)\)$/);
    if (match) {
      const num = parseInt(match[1]) + 1;
      return oldName.replace(/\(\d+\)$/, `(${num})`);
    }
    return `${oldName} (copie)`;
  }
});
