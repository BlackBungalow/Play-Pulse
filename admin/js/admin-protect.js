// js/admin-protect.js
import { app } from "/js/firebase-config.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * ✅ Sécurise les pages du dossier /admin/
 * Redirige si l'utilisateur n'est pas connecté ou non autorisé.
 */

const auth = getAuth(app);

// 🧩 Liste blanche des comptes autorisés
const authorizedEmails = [
  "ns@black-bungalow.com",
  "nfuchs@black-bungalow.com",
  "contact@black-bungalow.com",
  "collaborateur@black-bungalow.com",
  "slimani.hocinechawki@gmail.com"
];

// 🔐 Vérifie l'accès
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("🔒 Veuillez vous connecter pour accéder à l’administration.");
    window.location.href = "../identification.html";
    return;
  }

  if (!authorizedEmails.includes(user.email)) {
    alert("⛔ Accès refusé. Cette section est réservée à l’équipe PlayPulse.");
    window.location.href = "../identification.html";
    return;
  }

  console.log(`✅ Accès autorisé pour ${user.email}`);

  // 🧩 Ajout : stocke l’info admin pour les autres scripts (ex: challenge-manager)
  localStorage.setItem("adminEmail", user.email);
});
