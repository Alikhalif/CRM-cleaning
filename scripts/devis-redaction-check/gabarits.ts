// LOT B — gabarits, identité de la société émettrice, garde à trois crans.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// 1. SANS RÉGLAGE, RIEN NE BOUGE. C'est la garantie de non-régression du
//    lot : la résolution par défaut reproduit le rendu du 2026-11-07.
// 2. La garde ne bloque QUE sur le cran 1. Six sociétés sur sept seraient
//    refusées aujourd'hui par un refus binaire ; le mesurer a changé la
//    conception, et ces contrôles empêchent de revenir en arrière par
//    inadvertance.
// 3. Le cran 1 n'est levable par AUCUN réglage.
// 4. L'identité ne vient jamais du navigateur.
// 5. Le gabarit neutre ne porte plus l'identité d'OPTIMIVV — vérifié par
//    empreinte, contre le manifeste produit par le script de neutralisation.
// 6. Un seul point de rendu : l'aperçu et la pièce jointe ne peuvent pas
//    diverger.
//
// PORTÉE : logique PURE + lecture de fichiers du dépôt. Aucun réseau, aucune
// base, aucun secret.

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  GABARITS,
  SECTEURS_LOGISTIQUE,
  gabaritConvientAuSecteur,
  gabaritParDefaut,
  resoudreGabarit,
} from "@/lib/devis/gabarits";
import {
  controlerIdentitePourDevis,
  messageDAvertissement,
  messageDeRefus,
  paysDeLEntite,
  type EntitePourDevis,
} from "@/lib/devis/garde-identite";
import {
  descriptionDepuisDocument,
  lieuIntervention,
  mentionTva,
  dateFr,
} from "@/lib/devis/adaptateur-documents";
import type { Sector } from "@/lib/leads";

let ko = 0;
function vrai(nom: string, cond: boolean, detail?: string) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? `\n    ${detail}` : ""}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  vrai(nom, ok, ok ? undefined : `attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
}
const lu = (p: string): string => readFileSync(p, "utf8");

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== Sans réglage, le rendu ne bouge pas ==");
// ═══════════════════════════════════════════════════════════════════════
//
// La table de vérité reproduit `DocumentPdf` : un devis hors secteur
// logistique part sur le design propreté, tout le reste sur le générique.
const ATTENDU: [Sector, "devis" | "facture", string][] = [
  ["nettoyage", "devis", "cgk_nettoyage"],
  ["nettoyage_difficile", "devis", "cgk_nettoyage"],
  ["urgence", "devis", "cgk_nettoyage"],
  ["enr", "devis", "cgk_nettoyage"],
  ["renovation", "devis", "cgk_nettoyage"],
  ["demenagement", "devis", "cgk_standard"],
  ["debarras", "devis", "cgk_standard"],
  ["diogene", "devis", "cgk_standard"],
  ["transport", "devis", "cgk_standard"],
  // Une facture ne passe JAMAIS par le design propreté — c'est le
  // comportement en place, et le changer modifierait des factures émises.
  ["nettoyage", "facture", "cgk_standard"],
  ["demenagement", "facture", "cgk_standard"],
];
for (const [s, t, attendu] of ATTENDU) {
  eq(`${t} ${s} → ${attendu}`, gabaritParDefaut(s, t), attendu as never);
}
eq("résolution sans réglage = défaut",
  resoudreGabarit({ entityId: "E1", secteur: "nettoyage", type: "devis", reglages: {} }).gabarit,
  "cgk_nettoyage");
eq("… et l'origine le dit",
  resoudreGabarit({ entityId: "E1", secteur: "nettoyage", type: "devis", reglages: null }).origine,
  "défaut");

// Le garde-fou qui empêche les deux listes de secteurs de diverger.
{
  const src = lu("lib/pdf/DocumentPdf.tsx");
  const m = /const LOGISTIQUE = new Set<Sector>\(\[([^\]]*)\]\)/.exec(src);
  vrai("DocumentPdf expose toujours sa liste LOGISTIQUE", m !== null);
  if (m) {
    const dansLeRendu = m[1]
      .split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean).sort();
    eq("… et elle est identique à SECTEURS_LOGISTIQUE",
      dansLeRendu, [...SECTEURS_LOGISTIQUE].sort());
  }
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== Le réglage va du plus précis au plus général ==");
// ═══════════════════════════════════════════════════════════════════════
const R = {
  "E1|nettoyage": "optimivv_nettoyage",
  "*|nettoyage": "cgk_standard",
  "E1|*": "optimivv_demenagement",
  "*|*": "cgk_nettoyage",
};
eq("société + activité l'emporte",
  resoudreGabarit({ entityId: "E1", secteur: "nettoyage", type: "devis", reglages: R }).gabarit,
  "optimivv_nettoyage");
eq("à défaut, l'activité",
  resoudreGabarit({ entityId: "E2", secteur: "nettoyage", type: "devis", reglages: R }).gabarit,
  "cgk_standard");
eq("à défaut, la société",
  resoudreGabarit({ entityId: "E1", secteur: "debarras", type: "devis", reglages: R }).gabarit,
  "optimivv_demenagement");
eq("à défaut, le global",
  resoudreGabarit({ entityId: "E2", secteur: "debarras", type: "devis", reglages: R }).gabarit,
  "cgk_nettoyage");
eq("sans société, la clé société est ignorée",
  resoudreGabarit({ entityId: null, secteur: "debarras", type: "devis", reglages: R }).gabarit,
  "cgk_nettoyage");

console.log("\n== Un réglage illisible n'empêche pas d'émettre ==");
{
  const r = resoudreGabarit({
    entityId: "E1", secteur: "nettoyage", type: "devis",
    reglages: { "E1|nettoyage": "gabarit_qui_nexiste_pas" },
  });
  eq("la valeur inconnue est ignorée", r.gabarit, "cgk_nettoyage");
  eq("… la résolution retombe sur le défaut", r.origine, "défaut");
  vrai("… et la valeur fautive est SIGNALÉE, pas tue",
    (r.valeurIgnoree ?? "").includes("gabarit_qui_nexiste_pas"));
}
{
  // Une clé précise illisible ne doit pas masquer une clé plus générale valide.
  const r = resoudreGabarit({
    entityId: "E1", secteur: "nettoyage", type: "devis",
    reglages: { "E1|nettoyage": "n_importe_quoi", "*|*": "cgk_standard" },
  });
  eq("la clé générale valide prend le relais", r.gabarit, "cgk_standard");
  vrai("… et la clé fautive reste signalée", Boolean(r.valeurIgnoree));
}

console.log("\n== Le registre des gabarits est cohérent ==");
for (const [id, g] of Object.entries(GABARITS)) {
  eq(`${id} : l'identifiant interne correspond à la clé`, g.id, id as never);
  vrai(`${id} : porte une note pour l'administrateur`, g.note.length > 30);
}
vrai("cgk_standard convient à tout secteur",
  gabaritConvientAuSecteur("cgk_standard", "demenagement")
  && gabaritConvientAuSecteur("cgk_standard", "nettoyage"));
vrai("le design nettoyage ne prétend pas convenir au déménagement",
  !gabaritConvientAuSecteur("optimivv_nettoyage", "demenagement"));
eq("deux gabarits portent une identité entièrement dynamique",
  Object.values(GABARITS).filter((g) => g.identite === "complete").length, 3);
eq("le design fourni passe par la voie 0",
  GABARITS.optimivv_nettoyage.identite, "voie0");

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== La garde d'identité : trois crans, pas un refus binaire ==");
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Toutes les sociétés ci-dessous sont FICTIVES. Aucune donnée réelle.
const COMPLETE: EntitePourDevis = {
  id: "F1",
  legal_name: "Exemple Propreté SAS",
  legal_form: "SAS",
  siren: "552100554", // clé de Luhn juste
  siret: null,
  vat_number: "FR12552100554",
  address: "12 rue de la Démonstration, 75011 Paris",
  country: "FR",
  contact_email: "contact@exemple.test",
  contact_phone: "01 23 45 67 89",
  is_vat_exempt: false,
};

{
  const v = controlerIdentitePourDevis(COMPLETE);
  vrai("une fiche complète passe", v.emissionAutorisee);
  eq("… sans aucun grief", v.griefs.length, 0);
  eq("… et sans message de refus", messageDeRefus(v), "");
  eq("… ni d'avertissement", messageDAvertissement(v), "");
}

console.log("\n-- Cran 1 : ce sans quoi le document n'existe pas --");
for (const [champ, patch] of [
  ["dénomination", { legal_name: null }],
  ["dénomination de remplissage", { legal_name: "à renseigner" }],
  ["adresse", { address: null }],
  ["pays", { country: null }],
  ["pays non servi", { country: "US" }],
] as [string, Partial<EntitePourDevis>][]) {
  const v = controlerIdentitePourDevis({ ...COMPLETE, ...patch });
  vrai(`sans ${champ} : l'émission est REFUSÉE`, !v.emissionAutorisee);
  vrai(`… et le refus nomme le champ`, messageDeRefus(v).length > 40);
}
{
  const v = controlerIdentitePourDevis({ ...COMPLETE, legal_name: null }, { stricte: false });
  vrai("le cran 1 bloque même en mode NON strict", !v.emissionAutorisee);
  eq("… et il est classé cran 1", v.bloquants[0].cran, 1);
}

console.log("\n-- Cran 2 : signalé, et non bloquant par défaut --");
{
  // Le cas réel mesuré le 2026-11-06 : une clé de Luhn fausse.
  const v = controlerIdentitePourDevis({
    ...COMPLETE, siren: null, siret: "89421753000021", vat_number: null,
  });
  vrai("un identifiant à clé fausse N'EMPÊCHE PAS d'émettre", v.emissionAutorisee);
  vrai("… mais il est signalé", v.signales.length > 0);
  vrai("… en nommant la raison, pas seulement le champ",
    v.signales.some((g) => g.libelle.includes("(")));
  vrai("… et l'avertissement est rédigé", messageDAvertissement(v).includes("à corriger"));
}
{
  const v = controlerIdentitePourDevis(
    { ...COMPLETE, siren: null, siret: "89421753000021", vat_number: null },
    { stricte: true },
  );
  vrai("en mode strict, le même cas est REFUSÉ", !v.emissionAutorisee);
  eq("… et c'est bien un cran 2 qui bloque", v.bloquants[0].cran, 2);
  eq("… l'avertissement laisse la place au refus", messageDAvertissement(v), "");
}
{
  const v = controlerIdentitePourDevis({ ...COMPLETE, vat_number: null, siren: "552100554" });
  vrai("un numéro de TVA absent est signalé", v.signales.some((g) => g.champ.includes("TVA")));
  vrai("… sans bloquer", v.emissionAutorisee);
}
{
  const v = controlerIdentitePourDevis({
    ...COMPLETE, vat_number: null, siren: "552100554", is_vat_exempt: true,
  });
  vrai("une société en franchise en base n'est PAS reprochée de TVA",
    !v.signales.some((g) => g.champ.includes("TVA")));
}
{
  const v = controlerIdentitePourDevis({ ...COMPLETE, contact_email: "pas-une-adresse" });
  vrai("un courriel faux est signalé", v.signales.some((g) => g.champ.includes("courriel")));
  vrai("… en disant pourquoi", v.signales.some((g) => g.libelle.includes("(")));
}
{
  const v = controlerIdentitePourDevis({ ...COMPLETE, contact_phone: "   " });
  vrai("un téléphone absent est signalé",
    v.signales.some((g) => g.champ.includes("téléphone")));
}

console.log("\n-- Cran 3 : écrit, jamais bloquant --");
{
  const v = controlerIdentitePourDevis(COMPLETE, { gabaritPays: "CH" });
  eq("l'incohérence pays / gabarit est journalisée", v.journalises.length, 1);
  vrai("… sans bloquer", v.emissionAutorisee);
  vrai("… et elle nomme les deux pays",
    v.journalises[0].libelle.includes("France") && v.journalises[0].libelle.includes("Suisse"));
}
{
  const v = controlerIdentitePourDevis(COMPLETE, { gabaritPays: "CH", mentionAbsente: true });
  eq("la mention absente est journalisée aussi", v.journalises.length, 2);
  vrai("… toujours sans bloquer", v.emissionAutorisee);
}
{
  const v = controlerIdentitePourDevis(COMPLETE, {
    stricte: true, gabaritPays: "CH", mentionAbsente: true,
  });
  vrai("le mode strict ne rend PAS le cran 3 bloquant", v.emissionAutorisee);
}

console.log("\n-- Les cinq pays, et seulement eux --");
for (const p of ["FR", "CH", "LU", "BE", "CA"]) {
  eq(`${p} est reconnu`, paysDeLEntite({ ...COMPLETE, country: p }), p as never);
}
eq("la casse est tolérée", paysDeLEntite({ ...COMPLETE, country: "fr" }), "FR");
eq("un pays hors périmètre n'est pas deviné",
  paysDeLEntite({ ...COMPLETE, country: "US" }), null);
eq("un pays absent n'est pas remplacé par la France",
  paysDeLEntite({ ...COMPLETE, country: null }), null);
{
  // Hors de France, le numéro de TVA peut TENIR LIEU d'identifiant légal :
  // c'est la règle de `controlerIdentifiantLegal`, et la garde ne la double pas.
  const ch = controlerIdentitePourDevis({
    ...COMPLETE, country: "CH", siren: null, siret: null, vat_number: "CHE-123.456.789",
  });
  vrai("une société suisse identifiée par sa TVA passe le cran 2",
    !ch.griefs.some((g) => g.champ.startsWith("identifiant")));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== L'adaptateur vers les gabarits ==");
// ═══════════════════════════════════════════════════════════════════════
const LIGNES = [
  { id: "l1", label: "Nettoyage approfondi", quantity: 1, unit: "forfait",
    unitPriceHt: 1200, vatRate: 20, totalHt: 1200 },
  { id: "l2", label: "Vitrerie", quantity: 8, unit: "u",
    unitPriceHt: 25, vatRate: 20, totalHt: 200 },
];
{
  const d = descriptionDepuisDocument({ lines: LIGNES, notes: "" } as never);
  vrai("sans notes, la description vient des lignes", d.includes("Nettoyage approfondi"));
  vrai("… avec la quantité quand elle n'est pas 1", d.includes("8 u"));
  vrai("… et AUCUN prix : le gabarit a sa propre case de montant",
    !/\d+\s*(?:€|euros)/.test(d) && !d.includes("1200") && !d.includes("25"));
}
{
  const d = descriptionDepuisDocument({
    lines: LIGNES, notes: "PRESTATION\n\nTexte du moteur de rédaction.",
  } as never);
  vrai("avec notes, c'est le texte du moteur qui prime", d.startsWith("PRESTATION"));
  vrai("… et les lignes ne sont pas répétées", !d.includes("Vitrerie"));
}
{
  eq("franchise en base → l'article 293 B",
    mentionTva({ franchiseEnBase: true }).includes("293 B"), true);
  eq("société assujettie → aucune mention inventée",
    mentionTva({ franchiseEnBase: false }), "");
  eq("une mention saisie sur la fiche l'emporte",
    mentionTva({ franchiseEnBase: true, mentionsLegales: "Mention propre." }),
    "Mention propre.");
}
{
  const base = {
    sector: "nettoyage" as Sector, address: "3 rue A", postalCode: "75011", city: "Paris",
    moveFromCity: "", moveToCity: "",
  };
  eq("hors déménagement, le lieu est l'adresse",
    lieuIntervention(base as never), "3 rue A, 75011 Paris");
  eq("un déménagement affiche son TRAJET",
    lieuIntervention({ ...base, sector: "demenagement", moveFromCity: "Paris", moveToCity: "Lyon" } as never),
    "Paris » Lyon");
  eq("un trajet incomplet n'est pas fabriqué",
    lieuIntervention({ ...base, sector: "demenagement", moveFromCity: "Paris" } as never),
    "3 rue A, 75011 Paris");
}
eq("la date s'écrit à la française", dateFr("2026-11-07T10:00:00.000Z"), "07/11/2026");
eq("une date illisible ne produit pas « Invalid Date »", dateFr("n'importe quoi"), "");

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== Le gabarit neutre, vérifié par empreinte ==");
// ═══════════════════════════════════════════════════════════════════════
{
  const chemin = "public/devis-assets/nettoyage-template-neutre.json";
  vrai("le manifeste de neutralisation existe", existsSync(chemin));
  if (existsSync(chemin)) {
    const m = JSON.parse(lu(chemin)) as {
      source_md5: string; neutre_md5: string; source: string; neutre: string;
      sondes_interdites_absentes: boolean; elements_retires: unknown[];
      images_restantes: number;
    };
    const md5 = (p: string) => createHash("md5").update(readFileSync(p)).digest("hex");
    vrai("le gabarit d'origine est intact", md5(m.source) === m.source_md5);
    vrai("le gabarit neutre correspond au manifeste", md5(m.neutre) === m.neutre_md5);
    vrai("l'identité d'OPTIMIVV a bien été retirée", m.sondes_interdites_absentes === true);
    // 20 : l'identité (nom de marque, slogan, deux emblèmes, la carte
    // prestataire, la ligne de pied) ET les valeurs — numéro et date
    // d'exemple, validité, acompte, mention de TVA.
    vrai("vingt éléments retirés du gabarit neutre", m.elements_retires.length === 20,
      `obtenu ${m.elements_retires.length}`);
    for (const zone of ["validite de l'offre", "mention de TVA", "acompte a la commande"]) {
      vrai(`… dont « ${zone} », qui est un engagement, pas une décoration`,
        m.elements_retires.some((e) => (e as { zone: string }).zone === zone));
    }
    eq("il ne reste qu'une image : la photo", m.images_restantes, 1);
    vrai("les deux fichiers sont bien distincts", m.source_md5 !== m.neutre_md5);
  }
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== Garde-fous de code : ce qui ne doit jamais revenir ==");
// ═══════════════════════════════════════════════════════════════════════
{
  const src = lu("app/api/devis/route.ts");
  vrai("/api/devis retire l'identité envoyée par le navigateur",
    src.includes("prestataire: _prestataireIgnore") && src.includes("donneesSures"));
  vrai("… et le générateur ne reçoit plus le corps brut",
    !/buildDevis\(\{ \.\.\.input, docType \}/.test(src));
  // On compare les APPELS, pas les imports : les imports sont rangés en tête
  // de fichier et leur ordre ne dit rien de l'ordre d'exécution. Mon premier
  // contrôle comparait les imports et échouait pour cette raison.
  vrai("… la garde anti-doublon du Lot A est toujours avant l'allocation",
    src.indexOf("await verifierAvantCreation(") > 0
    && src.indexOf("await verifierAvantCreation(") < src.indexOf("await allocateNumero("));
}
{
  const src = lu("lib/devis/render-nettoyage.ts");
  vrai("le gabarit neutre n'est employé QUE si l'identité est dynamique",
    src.includes("identiteDynamique ? TEMPLATE_NEUTRE : TEMPLATE"));
  vrai("le chemin d'origine conserve son correctif de contact",
    src.includes("PRESTATAIRE_NETTOYAGE.tel"));
  vrai("aucun repli sur OPTIMIVV dans le bloc d'identité dynamique",
    !/P\.raison_sociale \|\| "OPTIMIVV/.test(src));
  vrai("sur la voie 0, les valeurs contractuelles sont toujours écrites",
    src.includes("identiteDynamique || jours !== CUIT.validite.jours")
    && src.includes("identiteDynamique || pct !== CUIT.acompte.pct")
    && src.includes("identiteDynamique || mention !== CUIT.tva.texte"));
  vrai("sur le gabarit d'origine, on ne recouvre que ce qui diffère",
    src.includes("if (!identiteDynamique) cover(...CUIT.validite.boite)"));
}
{
  const src = lu("lib/devis/render.ts");
  vrai("le libellé de l'identifiant légal n'est plus écrit en dur",
    src.includes("P.identifiant_label || \"SIRET\""));
  vrai("l'emblème n'est posé que s'il est demandé", src.includes("if (logoDemande)"));
}
{
  const apercu = lu("app/api/documents/[id]/preview-pdf/route.ts");
  const actions = lu("app/(app)/_shared/document-actions.ts");
  vrai("l'aperçu passe par le point de rendu unique", apercu.includes("rendreDocument("));
  vrai("l'envoi par courriel aussi", actions.includes("rendreDocument(detail, { bloquant: true })"));
  vrai("… donc plus aucun appel direct à react-pdf dans ces deux fichiers",
    !apercu.includes("renderToBuffer") && !actions.includes("renderToBuffer"));
  vrai("« marquer envoyé » est soumis à la garde", actions.includes("plan.refus"));
  vrai("l'aperçu, lui, ne bloque PAS un document existant",
    !apercu.includes("bloquant: true"));
}
{
  const cfg = lu("next.config.ts");
  vrai("les gabarits sont embarqués pour la route des documents",
    /"\/api\/documents\/\*\*":\s*\[[^\]]*devis-assets/.test(cfg));
  vrai("… et pour les pages qui émettent par action serveur",
    cfg.includes('"/comptabilite/**"') && cfg.includes('"/devis/**"'));
}

console.log(`\n${ko === 0 ? "  ✅ TOUT PASSE" : `  ❌ ${ko} ÉCHEC(S)`}`);
process.exit(ko === 0 ? 0 : 1);
