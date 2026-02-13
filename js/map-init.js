// map-init.js
import mapboxgl from 'https://cdn.skypack.dev/mapbox-gl';
import { updatePlayerPosition } from './poi-manager.js'; // ✅ Mise à jour proximité POI

const _0x1a2b = ["cGsuZXlKMUlqb2libWxqYjNocGJXOXVJaXdpWVNJNkltTnRaM1J2TkhWcWR6QTFaMkV", "5Ym5Gck16VnhabXhvWWpJaWZRLnlRc1J1ZXRTZWo5b0o5VngyMHJVeUE="];
mapboxgl.accessToken = atob(_0x1a2b.join(''));

export function initializeMap() {
  try {
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [4.8357, 45.7640], // Temporaire (sera recentré automatiquement)
      zoom: 13
    });

    map.addControl(new mapboxgl.NavigationControl());

    // Créer un marqueur personnalisé pour le joueur
    const playerMarkerEl = document.createElement('div');
    playerMarkerEl.className = 'player-marker';
    playerMarkerEl.style.backgroundImage = 'url("./assets/player-icon.png")';
    playerMarkerEl.style.width = '32px';
    playerMarkerEl.style.height = '32px';
    playerMarkerEl.style.backgroundSize = 'contain';
    playerMarkerEl.style.backgroundRepeat = 'no-repeat';
    playerMarkerEl.style.transformOrigin = 'center center'; // ✅ Pour rotation fluide

    const playerMarker = new mapboxgl.Marker(playerMarkerEl)
      .setLngLat([0, 0])
      .addTo(map);

    let hasCentered = false;

    // 📍 Géolocalisation en temps réel
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;

          // Mise à jour du marqueur joueur
          playerMarker.setLngLat([lng, lat]);

          // ✅ Centrer une seule fois
          if (!hasCentered) {
            map.setCenter([lng, lat]);
            hasCentered = true;
          }

          // Partage global
          window.playerPosition = { lat, lng };

          // 🔁 Mise à jour des POI à proximité
          updatePlayerPosition({ lat, lng });
        },
        (err) => {
          console.error('Erreur de géolocalisation', err);
        },
        { enableHighAccuracy: true }
      );
    } else {
      console.warn("🛰️ Géolocalisation non supportée sur ce navigateur.");
    }

    // 🧭 Boussole : rotation du marqueur
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientationabsolute", (event) => {
        const angle = event.alpha; // Degrés (0° nord)
        if (!isNaN(angle)) {
          playerMarkerEl.style.transform = `rotate(${angle}deg)`;
        }
      }, true);
    } else {
      console.warn("🧭 L'orientation de l'appareil n'est pas supportée.");
    }

    // 💾 Stocker la carte
    window.cityMap = map;

  } catch (error) {
    console.error("Erreur lors de l'initialisation de la carte :", error);
  }
}
