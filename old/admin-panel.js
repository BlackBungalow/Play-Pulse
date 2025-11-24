// admin.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const poiCollection = collection(db, 'pois');

// Références des éléments DOM
const form = document.getElementById('poiForm');
const tableBody = document.querySelector('#poiTable tbody');
const typeInput = document.getElementById('type');
const datesSection = document.getElementById('datesSection');

// 🧠 Afficher ou cacher les dates selon le type
typeInput.addEventListener('change', () => {
  if (typeInput.value === 'éphémère') {
    datesSection.style.display = 'block';
  } else {
    datesSection.style.display = 'none';
  }
});

// 🔁 Chargement des POIs au lancement
window.addEventListener('DOMContentLoaded', loadPOIs);

// 📥 Soumission du formulaire
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const poiData = {
    nom: document.getElementById('nom').value.trim(),
    type: typeInput.value,
    lat: parseFloat(document.getElementById('lat').value),
    lng: parseFloat(document.getElementById('lng').value),
    question: document.getElementById('question').value.trim(),
    reponse: document.getElementById('reponse').value.trim(),
    score: parseInt(document.getElementById('score').value || "0", 10)
  };

  if (poiData.type === 'éphémère') {
    poiData.dateDebut = document.getElementById('dateDebut').value;
    poiData.dateFin = document.getElementById('dateFin').value;
  }

  const poiId = document.getElementById('poiId').value;

  try {
    if (poiId) {
      // 🔁 Mise à jour
      const poiRef = doc(db, 'pois', poiId);
      await updateDoc(poiRef, poiData);
    } else {
      // ➕ Création
      await addDoc(poiCollection, poiData);
    }

    form.reset();
    datesSection.style.display = 'none';
    loadPOIs();
  } catch (error) {
    console.error("Erreur enregistrement POI :", error);
  }
});

// 🔄 Charge tous les POIs et les affiche dans le tableau
async function loadPOIs() {
  tableBody.innerHTML = "";

  try {
    const snapshot = await getDocs(poiCollection);
    snapshot.forEach(docSnap => {
      const poi = docSnap.data();
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${poi.nom}</td>
        <td>${poi.type}</td>
        <td>${poi.lat?.toFixed(4)}, ${poi.lng?.toFixed(4)}</td>
        <td>${poi.score || 0}</td>
        <td>${poi.question || ''}</td>
        <td>${poi.type === 'éphémère' ? `
          Du ${formatDate(poi.dateDebut)}<br/>
          Au ${formatDate(poi.dateFin)}` : '-'}</td>
        <td>
          <button onclick="editPOI('${docSnap.id}')">✏️</button>
          <button onclick="deletePOI('${docSnap.id}')">🗑️</button>
        </td>
      `;

      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Erreur de chargement des POIs :", error);
  }
}

// ✏️ Pré-remplir le formulaire pour modification
window.editPOI = async function(id) {
  const poiRef = doc(db, 'pois', id);
  const poiSnap = await getDocs(poiCollection);
  const found = (await getDocs(poiCollection)).docs.find(d => d.id === id);

  if (found) {
    const poi = found.data();
    document.getElementById('poiId').value = id;
    document.getElementById('nom').value = poi.nom || '';
    document.getElementById('type').value = poi.type;
    document.getElementById('lat').value = poi.lat;
    document.getElementById('lng').value = poi.lng;
    document.getElementById('question').value = poi.question || '';
    document.getElementById('reponse').value = poi.reponse || '';
    document.getElementById('score').value = poi.score || 0;

    if (poi.type === 'éphémère') {
      document.getElementById('dateDebut').value = poi.dateDebut || '';
      document.getElementById('dateFin').value = poi.dateFin || '';
      datesSection.style.display = 'block';
    } else {
      datesSection.style.display = 'none';
    }
  }
};

// 🗑️ Supprimer un POI
window.deletePOI = async function(id) {
  if (confirm("Supprimer ce POI ?")) {
    try {
      await deleteDoc(doc(db, 'pois', id));
      loadPOIs();
    } catch (error) {
      console.error("Erreur de suppression :", error);
    }
  }
};

// 🧰 Formatage des dates
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('fr-FR');
}
