// confirmation-banner.js
/**
 * 📢 Bandeau de confirmation universel
 * Appelle showConfirmationBanner({ message, confirmText, cancelText, onConfirm })
 */

export function showConfirmationBanner({
  message = "Êtes-vous sûr ?",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  onConfirm = () => {}
}) {
  // Supprime un ancien bandeau s’il existe
  const existing = document.querySelector(".confirmation-banner");
  if (existing) existing.remove();

  // Conteneur principal
  const banner = document.createElement("div");
  banner.className = "confirmation-banner";

  // Contenu du bandeau
  banner.innerHTML = `
    <div class="banner-content">
      <p class="banner-message">${message}</p>
      <div class="banner-buttons">
        <button class="banner-btn confirm">${confirmText}</button>
        <button class="banner-btn cancel">${cancelText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Animation d’apparition
  requestAnimationFrame(() => {
    banner.classList.add("visible");
  });

  // Boutons
  banner.querySelector(".confirm").addEventListener("click", () => {
    banner.classList.remove("visible");
    setTimeout(() => banner.remove(), 250);
    onConfirm();
  });

  banner.querySelector(".cancel").addEventListener("click", () => {
    banner.classList.remove("visible");
    setTimeout(() => banner.remove(), 250);
  });
}

/* ✅ Style global injecté automatiquement */
const style = document.createElement("style");
style.textContent = `
.confirmation-banner {
  position: fixed;
  bottom: -120px;
  left: 0;
  width: 100%;
  background: rgba(33, 37, 41, 0.95);
  color: white;
  text-align: center;
  padding: 1rem 1.2rem;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 9999;
  backdrop-filter: blur(8px);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial;
}
.confirmation-banner.visible {
  bottom: 0;
}
.banner-content {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
}
.banner-message {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
}
.banner-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.banner-btn {
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 110px;
}
.banner-btn.confirm {
  background: #2ecc71;
  color: white;
}
.banner-btn.confirm:hover {
  background: #27ae60;
}
.banner-btn.cancel {
  background: #e74c3c;
  color: white;
}
.banner-btn.cancel:hover {
  background: #c0392b;
}

/* 📱 Adaptation mobile */
@media (max-width: 600px) {
  .confirmation-banner {
    font-size: 0.9rem;
    padding: 0.9rem;
  }
  .banner-btn {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    min-width: 90px;
  }
}
`;
document.head.appendChild(style);
