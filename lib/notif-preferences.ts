// Préférences de notification côté client (localStorage). Module pur, sans I/O
// ni "server-only" — partagé entre le composant temps réel (qui joue le son) et
// le bouton de réglage. Voir lib/client-store.ts pour le pub/sub localStorage.

// Son des nouveaux leads / notifications : "on" (défaut) | "off".
export const NOTIF_SOUND_KEY = "cgk-notif-sound";
