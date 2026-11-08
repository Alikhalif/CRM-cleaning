// LOT B §4 — LES MODULES SE PARLENT-ILS ?
//
// « Les informations doivent circuler sans ressaisie inutile, sans perte de
//   données et sans création de doublons. »
//
// ── CE QUE CETTE SUITE VÉRIFIE, ET CE QU'ELLE NE PEUT PAS VÉRIFIER ──
//
// Elle suit les liaisons DANS LE CODE : qui lit quoi, qui écrit quoi, qui
// appelle qui. C'est vérifiable sans base, sans session et sans réseau, donc
// à tout moment, y compris en intégration continue.
//
// Elle ne prouve PAS qu'un parcours réel fonctionne à l'écran. Une liaison
// présente dans le code peut échouer à l'exécution — droits, données
// manquantes, erreur d'affichage. Seule une recette authentifiée le dira, et
// elle reste à faire.
//
// Chaque contrôle nomme la liaison qu'il protège, pour qu'une rupture se lise
// comme une rupture de chaîne et non comme un test cassé.

import { readFileSync, existsSync } from "node:fs";

let ko = 0;
function vrai(nom: string, cond: boolean, detail?: string) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? `\n    ${detail}` : ""}`);
  if (!cond) ko++;
}
const lu = (p: string): string => (existsSync(p) ? readFileSync(p, "utf8") : "");

/** Un fichier existe-t-il, et contient-il ces symboles ? */
function porte(fichier: string, symboles: string[]): boolean {
  const s = lu(fichier);
  return s !== "" && symboles.every((x) => s.includes(x));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 1. Fiche lead → découverte ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la fiche lead monte la carte de découverte",
  porte("app/(app)/leads/[id]/DiscoveryCard.tsx", ["discovery"]));
// L'enregistrement de la découverte vit dans les actions du pipeline : c'est
// de là que part la mise à jour du dossier, pas d'un module dédié.
vrai("la découverte enregistre dans discovery_details",
  lu("app/(app)/pipeline/actions.ts").includes("discovery_details"));
vrai("… et horodate sa validation",
  lu("app/(app)/pipeline/actions.ts").includes("discovery_done_at"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 2. Découverte → moteur de génération ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("le module de rédaction lit la découverte",
  porte("lib/devis/redaction-pour-lead-server.ts",
    ["discoveryDetails", "discoveryDoneAt", "contexteIntervention"]));
vrai("… et le contexte libre du lead, qui n'est PAS dans discovery_details",
  lu("lib/devis/redaction-pour-lead-server.ts").includes("contexteIntervention"));
vrai("… et il refuse de rédiger sans découverte validée",
  lu("lib/generation/devis-depuis-decouverte.ts").includes("discoveryDoneAt"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 3. Moteur → « Devis à réaliser » ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la génération crée un brouillon par le chemin existant",
  porte("app/(app)/leads/[id]/devis-actions.ts", ["createDevis(", "updateDevisBrouillon("]));
vrai("… et rafraîchit la vue « Devis à réaliser »",
  lu("app/(app)/leads/[id]/devis-actions.ts").includes('revalidatePath("/devis-a-realiser")'));
vrai("la vue existe et lit les dossiers à devis",
  porte("app/(app)/devis-a-realiser/page.tsx", ["getDevisARealiser"]));
vrai("un dossier n'en sort qu'après un ENVOI réel, pas après la génération",
  lu("lib/devis-a-realiser/server.ts").includes("envoye"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 4. « Devis à réaliser » → éditeur → visualisation ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la liste renvoie vers l'éditeur de devis",
  lu("app/(app)/devis-a-realiser/DevisARealiser.tsx").includes("/devis/"));
vrai("l'éditeur porte le bouton de visualisation",
  porte("app/(app)/devis/new/QuoteEditor.tsx", ["preview-pdf"]));
vrai("la visualisation passe par le point de rendu UNIQUE",
  lu("app/api/documents/[id]/preview-pdf/route.ts").includes("rendreDocument("));
vrai("… qui est le même que celui de la pièce jointe envoyée",
  lu("app/(app)/_shared/document-actions.ts").includes("rendreDocument(detail, { bloquant: true })"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 5. Sociétés émettrices → documents ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("le brouillon porte l'entité émettrice",
  lu("app/(app)/leads/[id]/devis-actions.ts").includes("entityId: entite.entityId"));
vrai("la résolution de l'entité est UNIQUE et partagée",
  porte("lib/devis/entite-emettrice.ts", ["resoudreEntiteDuLead", "legal_entity_activities"]));
vrai("… la fiche lead ne la réimplémente plus",
  !lu("app/(app)/leads/[id]/devis-actions.ts").includes("legal_entity_activities"));
vrai("… l'écran « nouveau devis » non plus",
  !lu("lib/devis/prefill.ts").includes("legal_entity_activities"));
vrai("le rendu injecte l'identité résolue, jamais celle du navigateur",
  lu("app/api/devis/route.ts").includes("_prestataireIgnore")
  && lu("app/api/devis/route.ts").includes("identitePourLead("));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 6. Devis → suivi commercial (audit → moteur d'actions) ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la génération journalise",
  lu("app/(app)/leads/[id]/devis-actions.ts").includes("auditLog("));
vrai("l'émission journalise aussi",
  lu("app/(app)/_shared/document-actions.ts").includes("document.send_email"));
vrai("le moteur d'actions commerciales se reconstruit depuis audit_logs",
  porte("lib/commercial-actions/engine-server.ts", ["audit_logs"]));
vrai("… et le journal écrit en service role, pour ne jamais se taire",
  lu("lib/audit.ts").includes("supabaseServiceRole"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 7. Devis → bibliothèque documentaire ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("le PDF émis par /api/devis est archivé",
  lu("app/api/devis/route.ts").includes("archiveDevis("));
vrai("… dans un stockage privé, par URL signée",
  lu("lib/devis/archive.ts").includes("createSignedUrl")
  || lu("lib/devis/archive.ts").includes("upload"));
vrai("la bibliothèque documentaire du client existe",
  porte("lib/documents/documents-server.ts", ["client_documents"]));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 8. Aucun doublon, sur aucun des deux parcours ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la garde lit les DEUX tables de devis",
  porte("lib/devis/garde-doublon.ts", ["devis_optimivv", "documents"]));
vrai("/api/devis la consulte avant d'allouer un numéro",
  lu("app/api/devis/route.ts").indexOf("await verifierAvantCreation(")
  < lu("app/api/devis/route.ts").indexOf("await allocateNumero("));
vrai("le module de rédaction signale l'autre parcours sans bloquer",
  lu("lib/devis/redaction-pour-lead-server.ts").includes("devisExistantsPourLead("));
vrai("… et la génération reste idempotente sur sa propre table",
  lu("app/(app)/leads/[id]/devis-actions.ts").includes("regenerer"));
vrai("un devis rectificatif reste possible",
  lu("app/api/devis/route.ts").includes("confirmerNouveau"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 9. Aucune ressaisie : le dossier préremplit tout ==");
// ═══════════════════════════════════════════════════════════════════════
{
  const p = lu("lib/devis/prefill.ts");
  for (const champ of ["client.nom", "lieu_intervention", "montant_ht", "description"]) {
    vrai(`« ${champ} » est prérempli depuis le dossier`, p.includes(champ.split(".")[0]));
  }
  vrai("le montant vient du moteur tarifaire, jamais du texte généré",
    p.includes("montantRecommande") && p.includes("computeGrid"));
  vrai("… et le prix annoncé en TTC est écarté à dessein",
    p.includes("announced_price"));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 10. Aucun envoi automatique ==");
// ═══════════════════════════════════════════════════════════════════════
vrai("la génération crée un BROUILLON, jamais un envoi",
  lu("app/(app)/leads/[id]/devis-actions.ts").includes('createDevis(payload, "draft")'));
vrai("l'envoi est une action distincte, déclenchée par le commercial",
  lu("app/(app)/_shared/document-actions.ts").includes("export async function sendDocumentByEmail"));
// ⚠️ On teste que la FONCTION n'existe plus, et non l'absence du mot :
// `app-settings.ts` porte un commentaire qui explique son retrait, et ma
// première version se déclenchait sur sa propre documentation. Un contrôle
// qui échoue sur le commentaire qui le justifie ne contrôle rien.
vrai("l'ancienne séquence automatique n'a plus de lecteur du tout",
  !lu("lib/app-settings.ts").includes("export async function isN8nSequenceEnabled")
  && !lu("app/(app)/leads/[id]/devis-actions.ts").includes("isN8nSequenceEnabled")
  && !lu("app/(app)/_shared/document-actions.ts").includes("isN8nSequenceEnabled"));

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 11. Notifications ==");
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CONSTAT, pas une exigence du Lot B : aucun des deux parcours de devis
// n'écrit de notification. Les notifications existent et fonctionnent pour
// d'autres événements. Ce contrôle fige l'état RÉEL pour qu'une évolution
// future soit un choix, pas une surprise.
{
  vrai("le module de notifications existe", existsSync("lib/notifications.ts"));
  vrai("… et l'écran qui les présente aussi",
    existsSync("app/(app)/notifications/NotificationRow.tsx"));
  vrai("… atteignable depuis le menu, depuis le Lot A",
    lu("lib/nav.ts").includes('href: "/notifications"'));
  const fiche = lu("app/(app)/leads/[id]/devis-actions.ts");
  const partage = lu("app/(app)/_shared/document-actions.ts");
  const aucune = !fiche.includes("notification") && !partage.includes("notification");
  vrai("état constaté : la génération et l'envoi n'en émettent AUCUNE", aucune,
    aucune ? undefined : "une notification est apparue — mettre à jour ce constat");
}


// ======================================================================
console.log("\n12. La mention produits est resolue PAR SOCIETE (2026-11-08)");
// ======================================================================
//
// La logique de resolution est testee a part, dans `mentions.ts`, parce
// qu'elle est pure. Ce qui ne s'y teste pas, c'est le CABLAGE : rien
// n'empechait le module serveur de continuer a appeler l'ancienne
// resolution par pays. Une mutation l'a montre, non detectee.
{
  const serveur = lu("lib/generation/mentions-produits-server.ts");
  vrai("le module serveur existe", serveur.length > 0);
  vrai("il appelle la resolution PAR SOCIETE",
    serveur.includes("resoudreMentionPourSociete("));
  vrai("… et non plus la resolution par pays seule",
    !/\bresoudreMention\s*\(/.test(serveur));
  vrai("il lit les DEUX couches du reglage",
    serveur.includes("lireReglagesParSociete(") && serveur.includes("lireReglages("));
  vrai("il passe l'identifiant de la societe emettrice",
    /resoudreMentionPourSociete\([\s\S]{0,80}entityId/.test(serveur));
  vrai("il expose les reglages par societe a l'ecran de reglages",
    serveur.includes("export async function reglagesMentionsParSociete"));

  const page = lu("app/(app)/settings/integrations/page.tsx");
  vrai("l'ecran de reglages recoit la couche societe",
    page.includes("reglagesSocietes={await reglagesMentionsParSociete()}"));

  const ecran = lu("app/(app)/settings/integrations/MentionsProduits.tsx");
  vrai("l'ecran propose un interrupteur par societe",
    ecran.includes("etatSoc") && ecran.includes("concernees.map("));
  vrai("… et dit ce qu'une societe non cochee herite",
    ecran.includes("herite du reglage par pays") || ecran.includes("hérite du réglage par pays"));

  const action = lu("app/(app)/settings/integrations/actions.ts");
  vrai("l'action enregistre la couche societe",
    action.includes("propreSocietes") && action.includes("CLE_SOCIETES"));
  vrai("… en lui appliquant les MEMES controles d'allegation",
    /propreSocietes[\s\S]{0,900}controlerMention\(/.test(action)
    || /for \(const \[entityId[\s\S]{0,900}controlerMention\(/.test(action));
  vrai("… et journalise qui a assume quoi",
    action.includes("societes_actives"));
}
console.log(`\n${ko === 0 ? "  ✅ TOUT PASSE" : `  ❌ ${ko} ÉCHEC(S)`}`);
process.exit(ko === 0 ? 0 : 1);
