// D23 — liens de contrat : 60 minutes, renouvelables, contrôlés, tracés.
//
// Niveau de preuve : la DÉCISION (ouvrir / expiré / révoqué / renouvelable)
// est EXÉCUTÉE ici ; les routes et la migration sont LUES. L'ouverture réelle
// d'un lien et la réception du courriel restent à faire en recette (C16).

import { existsSync, readFileSync } from "node:fs";
import {
  decider, DUREE_LIEN_MINUTES, expirationDepuis, FENETRE_RENOUVELLEMENT_JOURS, jetonBienForme,
  masquerEmail, peutRenouveler, RENOUVELLEMENTS_PAR_24H, TTL_REDIRECTION_SECONDES,
} from "@/lib/documents/contrat-lien-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

console.log("\n1. La décision — EXÉCUTÉE");
const T0 = new Date("2026-11-09T10:00:00Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const lien = { expireAt: expirationDepuis(T0).toISOString(), revoqueAt: null, envoiInitialAt: T0.toISOString() };

vrai("durée : 60 minutes", DUREE_LIEN_MINUTES === 60 && expirationDepuis(T0).getTime() - T0.getTime() === 3_600_000);
vrai("la redirection de stockage vit ≤ 60 min (5 min)", TTL_REDIRECTION_SECONDES <= 3600 && TTL_REDIRECTION_SECONDES === 300);
vrai("à 59 min : le lien s'ouvre", decider(lien, min(59), 0).action === "ouvrir");
vrai("à 61 min : il a expiré", decider(lien, min(61), 0).action === "expire");
const d = decider(lien, min(61), 0);
vrai("… et il est renouvelable", d.action === "expire" && d.renouvelable);
vrai("révoqué : jamais ouvert, même dans l'heure", decider({ ...lien, revoqueAt: min(5).toISOString() }, min(10), 0).action === "revoque");
vrai(`au-delà de ${RENOUVELLEMENTS_PAR_24H} renouvellements en 24 h : refus`, !peutRenouveler(lien, min(61), RENOUVELLEMENTS_PAR_24H).renouvelable);
vrai("juste en dessous : accepté", peutRenouveler(lien, min(61), RENOUVELLEMENTS_PAR_24H - 1).renouvelable);
const vieux = { ...lien, envoiInitialAt: new Date(T0.getTime() - (FENETRE_RENOUVELLEMENT_JOURS + 1) * 86_400_000).toISOString() };
vrai(`envoi initial il y a plus de ${FENETRE_RENOUVELLEMENT_JOURS} jours : refus, nouvel envoi par le back-office`, !peutRenouveler(vieux, min(61), 0).renouvelable);
vrai("un lien révoqué ne se renouvelle pas", !peutRenouveler({ ...lien, revoqueAt: T0.toISOString() }, min(61), 0).renouvelable);
vrai("adresse masquée", masquerEmail("jean.dupont@exemple.fr") === "j***@exemple.fr");
vrai("jeton 256 bits base64url accepté", jetonBienForme("A".repeat(43)));
vrai("jeton trop court refusé avant toute lecture en base", !jetonBienForme("abc"));
vrai("jeton avec caractère interdit refusé", !jetonBienForme("A".repeat(42) + "/"));

console.log("\n2. La migration 20261109000004 — LUE");
const M = lire("supabase/migrations/20261109000004_contrat_liens_acces.sql").toLowerCase();
vrai("préparée, non appliquée", M.includes("préparée, non appliquée"));
vrai("seule l'EMPREINTE du jeton est stockée (64 hex)", M.includes("token_hash") && M.includes("'^[0-9a-f]{64}$'"));
vrai("60 minutes inscrites EN BASE, pas seulement dans le code", M.includes("expire_at <= created_at + interval '60 minutes'"));
vrai("expiration calculée par la base (pas d'horloge applicative)", M.includes("default (now() + interval '60 minutes')"));
vrai("chaîne des renouvellements conservée", M.includes("renouvelle_id"));
vrai("lecture back-office ; aucune politique d'écriture", M.includes("using (is_admin() or is_planificateur())") && !/for (insert|update|delete|all)/.test(M));

console.log("\n3. L'envoi et les routes — LUS");
const S = lire("lib/documents/contrat-lien-server.ts");
vrai("jeton de 32 octets aléatoires (256 bits)", S.includes("crypto.randomBytes(32).toString(\"base64url\")"));
vrai("URL de base résolue AVANT la création du lien", S.indexOf("baseUrlPublique()") < S.indexOf(".insert("));
vrai("lien vérifié par la liste blanche avant envoi", S.includes("verifierLien(url)"));
vrai("AUCUNE pièce jointe dans le courriel", !/attachment/i.test(S));
vrai("le courriel annonce la durée et le renouvellement", S.includes("valable <strong>${DUREE_LIEN_MINUTES} minutes</strong>"));
vrai("échec d'envoi : le lien est révoqué (il n'est jamais parti)", S.includes("Le lien n'est jamais parti"));
vrai("envoi et renouvellement tracés", S.includes("client.contract.link.send") && S.includes("client.contract.link.renew"));
vrai("l'adresse est masquée dans le journal", S.includes("destinataire: masquerEmail(input.destinataire)"));

const C = lire("app/(app)/clients/[id]/contracts-actions.ts");
vrai("sendContract n'émet plus d'URL de stockage 7 jours", !C.includes("7 * 24 * 3600") && C.includes("emettreEtEnvoyerLien("));

const G = lire("app/api/contrats/lien/[token]/route.ts");
vrai("ouverture : jeton mal formé = même réponse qu'un jeton inconnu", G.includes("if (!jetonBienForme(token)) return inconnu();") && G.includes("if (!lien) return inconnu();"));
vrai("ouverture : redirection vers une URL de 5 minutes", G.includes("createSignedUrl(contrat.pdf_path, TTL_REDIRECTION_SECONDES)"));
vrai("ouverture : comptée et tracée", G.includes("ouvertures: lien.ouvertures + 1") && G.includes("client.contract.link.open"));
vrai("ouverture : pas de cache, pas de référent", G.includes('"Cache-Control", "no-store"') && G.includes('"Referrer-Policy", "no-referrer"'));

const R = lire("app/api/contrats/lien/[token]/renouveler/route.ts");
vrai("renouvellement : à l'adresse ENREGISTRÉE, jamais à une adresse reçue", R.includes("destinataire: lien.destinataire") && !R.includes("formData") && !R.includes("req.json"));
vrai("renouvellement : un lien encore valide ne se renouvelle pas", R.includes("Ce lien est encore valide"));
vrai("renouvellement : plafond et fenêtre appliqués", R.includes("peutRenouveler("));
vrai("renouvellement : verrou contre deux demandes simultanées", /\.update\(\{ revoque_at: new Date\(\)\.toISOString\(\) \}\)\s+\.eq\("id", lien\.id\)\s+\.is\("revoque_at", null\)/.test(R));
vrai("renouvellement : l'échec d'envoi rend l'ancien lien renouvelable", R.includes("update({ revoque_at: null })"));
vrai("renouvellement : le back-office est notifié", R.includes('notifyRole("planification"'));

const P = lire("proxy.ts");
vrai("la route est publique par construction (/api/* hors session)", /\/api/.test(P));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
