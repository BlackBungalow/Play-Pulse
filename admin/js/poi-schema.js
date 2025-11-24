// /admin/js/poi-schema.js

// 🎯 Structure par défaut d’un POI
export const DEFAULT_POI = {
  question: "",
  lat: null,
  lng: null,
  score: 10,
  ordre: 0, // uniquement si parcours linéaire

  // 🎞️ Type de média : image, vidéo, ou vide
  typeMedia: "",   // "image" | "video" | ""

  // 🎨 Contenus média
  image: "",       // URL image si typeMedia === "image"
  video: "",       // URL YouTube si typeMedia === "video"

  // ✅ Type de réponse : texte libre ou QCM
  typeReponse: "texte",  // "texte" ou "qcm"

  // 📝 Si réponse texte
  reponse: "",

  // 🧠 Si QCM
  choix1: "",
  choix2: "",
  choix3: "",
  choix4: "",
  qcmCorrectIndex: 0,  // 0 à 3

  // ⏱️ Type de POI : fixe ou éphémère
  typePOI: "fixe",  // "fixe" ou "ephemere"
  dateDebut: null,
  dateFin: null
};

// ✅ Sanitize (nettoie ou complète les données récupérées de Firestore)
export function sanitizePOI(raw = {}) {
  return {
    ...DEFAULT_POI,
    ...raw,
    lat: parseFloat(raw.lat ?? 0),
    lng: parseFloat(raw.lng ?? 0),
    score: parseInt(raw.score ?? 10),
    ordre: parseInt(raw.ordre ?? 0),
    qcmCorrectIndex: parseInt(raw.qcmCorrectIndex ?? 0)
  };
}
