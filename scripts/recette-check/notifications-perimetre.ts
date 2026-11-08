// D31 — les notifications respectent le périmètre de leur destinataire.
//
// Niveau de preuve : la RÈGLE est EXÉCUTÉE sur la matrice cinq pays × rôles ;
// la base (migration …07), le serveur et les écrans sont LUS. La même matrice
// est rejouée EN BASE, sous une vraie session : section 9 de
// `npm run recette:facturation`.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { dansPerimetre, type Destinataire } from "@/lib/notifications/perimetre-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

const PAYS = ["FR", "CH", "LU", "BE", "CA"] as const;
const E = { FR: "ent-fr", CH: "ent-ch", LU: "ent-lu", BE: "ent-be", CA: "ent-ca" } as const;

console.log("\n1. La matrice cinq pays × rôles — EXÉCUTÉE");
const admin: Destinataire = { roles: ["admin"], countries: [], entitesAutorisees: [] };
const commercial: Destinataire = { roles: ["commercial"], countries: ["FR"], entitesAutorisees: [] };
const superviseur: Destinataire = { roles: ["superviseur"], countries: [], entitesAutorisees: [] };
for (const p of PAYS) {
  const planifDuPays: Destinataire = { roles: ["planification"], countries: [p], entitesAutorisees: [] };
  for (const q of PAYS) {
    const ok = dansPerimetre(planifDuPays, { pays: q, entiteId: E[q] });
    vrai(`planification ${p} · notification ${q} → ${p === q ? "REÇUE" : "refusée"}`, ok === (p === q));
  }
  vrai(`Super Admin · notification ${p} → reçue`, dansPerimetre(admin, { pays: p, entiteId: E[p] }));
}
vrai("planification sans aucun pays → ne reçoit RIEN du back-office (A17)", PAYS.every((p) => !dansPerimetre({ roles: ["planification"], countries: [], entitesAutorisees: [] }, { pays: p, entiteId: E[p] })));
vrai("planification multi-pays FR+CH → FR et CH, pas BE", dansPerimetre({ roles: ["planification"], countries: ["FR", "CH"], entitesAutorisees: [] }, { pays: "CH", entiteId: E.CH })
  && !dansPerimetre({ roles: ["planification"], countries: ["FR", "CH"], entitesAutorisees: [] }, { pays: "BE", entiteId: E.BE }));

console.log("\n2. Le périmètre d'ENTITÉS — EXÉCUTÉ");
const restreinte: Destinataire = { roles: ["planification"], countries: ["FR", "BE"], entitesAutorisees: [E.FR] };
vrai("entité autorisée, pays autorisé → reçue", dansPerimetre(restreinte, { pays: "FR", entiteId: E.FR }));
vrai("pays autorisé, AUTRE entité → refusée", !dansPerimetre(restreinte, { pays: "BE", entiteId: E.BE }));
vrai("entité inconnue, périmètre restreint → refusée (fail-closed)", !dansPerimetre(restreinte, { pays: "FR", entiteId: null }));
vrai("aucune entité cochée = toutes (comportement antérieur préservé)", dansPerimetre({ roles: ["planification"], countries: ["FR"], entitesAutorisees: [] }, { pays: "FR", entiteId: null }));
vrai("bonne entité mais pays NON couvert → refusée (les deux doivent tenir)", !dansPerimetre({ roles: ["planification"], countries: ["CH"], entitesAutorisees: [E.FR] }, { pays: "FR", entiteId: E.FR }));

console.log("\n3. Notifications personnelles et autres rôles — EXÉCUTÉ");
vrai("notification PERSONNELLE (sans pays) → reçue par tous", [admin, commercial, superviseur, restreinte].every((d) => dansPerimetre(d, { pays: null, entiteId: null })));
vrai("commercial : ses notifications personnelles ne sont pas filtrées par pays", dansPerimetre(commercial, { pays: "CA", entiteId: E.CA }));
vrai("planification ET commercial : la règle back-office s'applique", !dansPerimetre({ roles: ["commercial", "planification"], countries: ["FR"], entitesAutorisees: [] }, { pays: "BE", entiteId: E.BE }));

console.log("\n4. En base — migration 20261109000007 (lue)");
const M = lire("supabase/migrations/20261109000007_notifications_perimetre.sql").toLowerCase();
vrai("préparée, non appliquée", M.includes("préparée, non appliquée"));
vrai("périmètre d'entités : vide = toutes, par défaut", M.includes("entites_autorisees uuid[] not null default '{}'"));
vrai("la règle SQL : admin tout ; planification pays ET entités ; personnelle libre",
  M.includes("when p_pays is null then true") && M.includes("p_pays = any (u.countries)") && M.includes("cardinality(u.entites_autorisees) = 0"));
vrai("insertion hors périmètre REFUSÉE (trigger)", M.includes("before insert on notifications") && M.includes("hors du périmètre de son destinataire"));
vrai("lecture : RLS filtrée par la même règle", /notifications: user reads own"[\s\S]{0,160}notification_dans_perimetre\(auth\.uid\(\), pays, entite_id\)/.test(M));
vrai("marquage « lu » : même filtre (on ne touche pas ce qu'on ne voit pas)", /user marks own as read"[\s\S]{0,200}notification_dans_perimetre/.test(M));
vrai("portée immuable depuis une session (pas de démasquage)", M.includes("la portée d''une notification ne se modifie pas") && M.includes("auth.uid() is not null"));
vrai("« Actions attendues » : même règle de périmètre", /create policy actions_bo_select[\s\S]{0,260}notification_dans_perimetre\(auth\.uid\(\), pays, entite_id\)/.test(M));
vrai("aucune suppression dans la migration", !/\bdelete\s+from\b/.test(M));

console.log("\n5. Côté serveur (lu)");
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const code = [...fichiers("app"), ...fichiers("lib")];
const restants = code.filter((f) => sansCommentaires(lire(f)).includes('notifyRole("planification"'));
vrai("AUCUN appel à notifyRole(« planification ») ne subsiste dans le code", restants.length === 0);
if (restants.length) console.log("  info  restants :", restants.join(", "));
const S = lire("lib/notifications/perimetre-server.ts");
vrai("le service filtre chaque destinataire par dansPerimetre()", S.includes("if (!dansPerimetre(dest, portee)) continue;"));
vrai("pays inconnu : aucune planificatrice (fail-closed)", S.includes("if (portee.pays === null && !dest.roles.includes(\"admin\")) continue;"));
vrai("la portée est écrite AVEC la notification (pour la base)", S.includes("pays: portee.pays, entiteId: portee.entiteId"));
const N = lire("lib/notifications.ts");
vrai("notify : sans la migration, repli SANS colonnes de portée (aucune notification perdue)", N.includes("await supabase.from(\"notifications\").insert(row as never);"));
vrai("… mais JAMAIS de repli quand la base refuse pour périmètre (P0001)", N.includes('error.code !== "P0001"'));
for (const [f, portee] of [
  ["lib/signature-server.ts", "porteeDuDocument(sr.document_id)"],
  ["lib/devis/status.ts", "porteeDuLead(leadId)"],
  ["app/api/webhooks/brevo/inbound/route.ts", "porteeDuLead(leadId)"],
  ["lib/documents/alerts-server.ts", "porteeDuContratClient(c.id)"],
  ["app/api/contrats/lien/[token]/renouveler/route.ts", "porteeDuContratClient(contrat.id)"],
] as const) {
  vrai(`${f} : notifierBackOffice(${portee})`, lire(f).includes(`notifierBackOffice(await ${portee}`));
}
const ENG = lire("lib/actions-back-office/engine-server.ts");
vrai("planification, intervention, facturation, encaissement : pays ET entité", ENG.includes("notifierBackOffice({ pays: a.pays, entiteId: a.entiteId }"));

console.log("\n6. Écrans et procédure (lus)");
const P = lire("app/(app)/planification/page.tsx");
vrai("Planification : la vue suit AUSSI le périmètre d'entités", P.includes("myEntites.length === 0 || (r.lead.entityId != null && myEntites.includes(r.lead.entityId))"));
const U = lire("app/(app)/settings/users/actions.ts");
vrai("périmètre d'entités : réglé par un administrateur", /export async function setUserEntitesAutorisees[\s\S]{0,200}setUserArray\(userId, "entites_autorisees"/.test(U) && U.includes("callerIsAdmin(supabase)"));
const PR = lire("supabase/procedures/notifications-hors-perimetre.sql").toLowerCase();
vrai("procédure : inventaire en LECTURE SEULE d'abord", PR.includes("begin transaction read only"));
vrai("procédure : n'écrit que la portée, là où elle est vide", PR.includes("set pays = p.pays, entite_id = p.entite_id") && PR.includes("and n.pays is null"));
vrai("procédure : AUCUNE suppression", !/\bdelete\s+from\b/.test(PR) && !/\btruncate\b/.test(PR));
vrai("procédure : se termine par ROLLBACK (COMMIT après relecture seulement)", PR.includes("remplacez la\n-- ligne suivante par commit.\nrollback;"));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
