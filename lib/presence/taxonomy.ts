// Traduction du journal `audit_logs` existant en libellés lisibles + catégories
// + compteurs « travail effectué ». Client-safe (aucun I/O) → utilisable dans
// les écrans Super Admin. On NE crée PAS de nouveaux événements : on interprète
// les actions déjà tracées par le CRM (cf. lib/audit.ts et les server actions).

export type ActionCategory =
  | "connexion"
  | "lead"
  | "devis"
  | "facture"
  | "dossier"
  | "client"
  | "media"
  | "relance"
  | "appel"
  | "config"
  | "autre";

export type ActionMeta = {
  label: string; // libellé court (timeline)
  verb: string; // phrase « a … » (timeline lisible)
  cat: ActionCategory;
  counters?: string[]; // compteurs « travail effectué » alimentés
  treat?: boolean; // compte comme « prise en charge réelle » d'un lead
};

// Compteurs exposés dans « Travail effectué ».
export const COUNTER_LABELS: Record<string, string> = {
  leads_consultes: "Leads consultés",
  leads_traites: "Leads traités",
  relances: "Relances",
  devis_crees: "Devis créés",
  devis_envoyes: "Devis envoyés",
  factures: "Factures",
  rdv: "Rendez-vous",
  dossiers_finalises: "Dossiers finalisés",
  notes: "Notes ajoutées",
  statuts: "Changements de statut",
  appels: "Appels",
};

export const ACTIONS: Record<string, ActionMeta> = {
  // ── Connexion ──
  "auth.login": { label: "Connexion", verb: "s'est connecté", cat: "connexion" },
  "auth.logout": { label: "Déconnexion", verb: "s'est déconnecté", cat: "connexion" },
  "auth.login.failed": { label: "Échec connexion", verb: "a échoué à se connecter", cat: "connexion" },
  "auth.login.locked": { label: "Compte verrouillé", verb: "a été verrouillé (tentatives)", cat: "connexion" },

  // ── Lead (lecture ajoutée par le module) ──
  "lead.open": { label: "Ouverture du lead", verb: "a ouvert le lead", cat: "lead", counters: ["leads_consultes"] },
  "client.open": { label: "Consultation fiche client", verb: "a consulté la fiche client", cat: "client" },

  // ── Lead (mutations = prise en charge réelle) ──
  "lead.status.change": { label: "Changement de statut", verb: "a changé le statut", cat: "lead", counters: ["statuts"], treat: true },
  "lead.notes.update": { label: "Note ajoutée", verb: "a ajouté une note", cat: "lead", counters: ["notes"], treat: true },
  "lead.contact.update": { label: "Fiche lead modifiée", verb: "a modifié la fiche lead", cat: "lead", treat: true },
  "lead.reassign": { label: "Lead réaffecté", verb: "a réaffecté le lead", cat: "lead" },
  "lead.bulk_assign": { label: "Affectation en lot", verb: "a affecté des leads", cat: "lead" },
  "lead.lost": { label: "Lead perdu", verb: "a marqué le lead perdu", cat: "lead", treat: true },
  "lead.nrp.set": { label: "NRP", verb: "a marqué NRP", cat: "lead", treat: true },
  "lead.followup.set": { label: "Relance planifiée", verb: "a planifié une relance", cat: "lead", treat: true },
  "lead.relance.email": { label: "Relance e-mail", verb: "a envoyé une relance", cat: "relance", counters: ["relances"], treat: true },
  "lead.sms.sent": { label: "SMS envoyé", verb: "a envoyé un SMS", cat: "relance", counters: ["relances"], treat: true },
  "lead.sequence.launch": { label: "Séquence lancée", verb: "a lancé une séquence", cat: "relance", counters: ["relances"], treat: true },
  "lead.sequence.stop": { label: "Séquence arrêtée", verb: "a arrêté une séquence", cat: "relance" },
  "lead.call.outbound": { label: "Appel sortant", verb: "a passé un appel", cat: "appel", counters: ["appels"], treat: true },
  "lead.discovery.save": { label: "Découverte enregistrée", verb: "a rempli la découverte", cat: "lead", treat: true },
  "lead.discovery.record": { label: "Découverte", verb: "a mis à jour la découverte", cat: "lead", treat: true },
  "lead.photos.request": { label: "Demande de photos", verb: "a demandé des photos", cat: "lead", treat: true },
  "lead.create": { label: "Lead créé", verb: "a créé un lead", cat: "lead" },
  "lead.media.upload": { label: "Document ajouté", verb: "a ajouté un document", cat: "media", treat: true },
  "lead.media.delete": { label: "Document supprimé", verb: "a supprimé un document", cat: "media" },
  "lead.consultation.sent": { label: "Consultation envoyée", verb: "a envoyé une consultation", cat: "relance", treat: true },

  // ── Devis / factures (documents) ──
  "document.create": { label: "Devis créé", verb: "a créé un devis", cat: "devis", counters: ["devis_crees"], treat: true },
  "document.mark_sent": { label: "Devis envoyé", verb: "a envoyé le devis", cat: "devis", counters: ["devis_envoyes"], treat: true },
  "document.send_email": { label: "Devis envoyé (e-mail)", verb: "a envoyé le devis par e-mail", cat: "devis", counters: ["devis_envoyes"], treat: true },
  "document.signature.sent": { label: "Signature envoyée", verb: "a envoyé pour signature", cat: "devis", counters: ["devis_envoyes"], treat: true },
  "document.signature.cancelled": { label: "Signature annulée", verb: "a annulé la signature", cat: "devis" },
  "document.signed": { label: "Devis signé", verb: "a signé le devis", cat: "devis", treat: true },
  "document.mark_refused": { label: "Devis refusé", verb: "a marqué le devis refusé", cat: "devis" },
  "document.mark_paid": { label: "Facture payée", verb: "a marqué la facture payée", cat: "facture" },
  "document.acompte.auto_create": { label: "Facture d'acompte", verb: "a généré une facture d'acompte", cat: "facture", counters: ["factures"] },
  "document.duplicate": { label: "Devis dupliqué", verb: "a dupliqué le devis", cat: "devis" },

  // ── Dossiers / planification ──
  "dossier.planify": { label: "Rendez-vous planifié", verb: "a planifié un rendez-vous", cat: "dossier", counters: ["rdv"], treat: true },
  "dossier.edit": { label: "Dossier modifié", verb: "a modifié le dossier", cat: "dossier", treat: true },
  "dossier.start_realisation": { label: "Intervention démarrée", verb: "a démarré l'intervention", cat: "dossier", treat: true },
  "dossier.finalize": { label: "Dossier finalisé", verb: "a finalisé le dossier", cat: "dossier", counters: ["dossiers_finalises"], treat: true },
  "dossier.sold": { label: "Dossier soldé", verb: "a soldé le dossier", cat: "dossier", counters: ["dossiers_finalises"], treat: true },
  "dossier.finale.create": { label: "Facture finale", verb: "a émis la facture finale", cat: "facture", counters: ["factures"], treat: true },
  "dossier.acompte_paid": { label: "Acompte encaissé", verb: "a encaissé l'acompte", cat: "facture", treat: true },
  "dossier.confirmation_email": { label: "E-mail de confirmation", verb: "a envoyé une confirmation", cat: "dossier" },
  "dossier.intervenant.email": { label: "E-mail intervenant", verb: "a écrit à l'intervenant", cat: "dossier" },

  // ── Clients ──
  "client.create": { label: "Client créé", verb: "a créé un client", cat: "client" },
  "client.create_from_lead": { label: "Client (depuis lead)", verb: "a converti un lead en client", cat: "client" },
  "client.update": { label: "Fiche client modifiée", verb: "a modifié la fiche client", cat: "client" },

  // ── Config (admin) ──
  "consultation.relance": { label: "Relance consultation", verb: "a relancé une consultation", cat: "relance", counters: ["relances"] },
  "consultation.attribute": { label: "Attribution", verb: "a attribué une consultation", cat: "dossier" },
};

// Actions qui valent « prise en charge réelle » d'un lead (≠ simple affectation).
export const TREAT_ACTIONS: string[] = Object.keys(ACTIONS).filter((k) => ACTIONS[k].treat);
// Un lead est considéré « pris en charge » par une action de traitement OU une
// ouverture/consultation humaine (cf. spec : « consultation / ouverture du lead »).
export const QUALIFYING_LEAD_ACTIONS: string[] = [...TREAT_ACTIONS, "lead.open"];

const FALLBACK: ActionMeta = { label: "Action", verb: "a effectué une action", cat: "autre" };

export function actionMeta(action: string): ActionMeta {
  if (ACTIONS[action]) return ACTIONS[action];
  // Événements dynamiques (ex. lead.n8n.*, user.*) → catégorie par préfixe.
  const prefix = action.split(".")[0];
  const cat: ActionCategory =
    prefix === "lead" ? "lead"
    : prefix === "document" ? "devis"
    : prefix === "dossier" ? "dossier"
    : prefix === "client" ? "client"
    : prefix === "auth" ? "connexion"
    : prefix === "user" || prefix === "template" || prefix === "technician" || prefix === "routing_rule" || prefix === "landing_page" || prefix === "entity" ? "config"
    : "autre";
  return { ...FALLBACK, cat };
}

// Seuils de présence par défaut (repli si presence_config absent). Modifiables
// par le Super Admin (table presence_config).
export const DEFAULT_THRESHOLDS = {
  heartbeat_seconds: 45,
  active_window_seconds: 60,
  inactive_after_minutes: 5,
  offline_after_minutes: 15,
};
export type PresenceThresholds = typeof DEFAULT_THRESHOLDS;

export type PresenceStatus = "active" | "inactive" | "offline";
export const STATUS_LABEL: Record<PresenceStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  offline: "Hors ligne",
};

export type AlertSeverity = "watch" | "warn" | "high" | "critical";
export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  watch: "À surveiller",
  warn: "Retard",
  high: "Important",
  critical: "Critique",
};
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  watch: 1, warn: 2, high: 3, critical: 4,
};
