// Les deux transports d'e-mail, et leurs comportements de repli.
//
// Demande du §3 : « Teste les deux transports et leurs comportements de
// repli. » Le défaut d'origine n'était pas qu'un transport envoyait : c'est
// que le SECOND prenait le relais quand on neutralisait le premier. Un
// contrôle qui n'éprouve qu'un transport ne prouve donc rien.

import { readFileSync } from "node:fs";
import { deciderEnvoi, listeBlanche, surListeBlanche } from "@/lib/envoi/decision";
import { eq, faux, titre, vrai, bilan } from "./commun";

const base = { canal: "email" as const, destinataire: "client@exemple.fr" };

// ═══════════════════════════════════════════════════════════════════════
titre("1. La production envoie — rien ne change pour elle");
// ═══════════════════════════════════════════════════════════════════════

const prod = deciderEnvoi({ ...base, mode: "production" });
vrai("production : autorisé", prod.autorise);
if (prod.autorise) eq("… au motif « production »", prod.motif, "production");
vrai(
  "production : autorisé même sans aucune autorisation explicite",
  deciderEnvoi({ ...base, mode: "production", envoiReelAutorise: undefined }).autorise,
);
vrai(
  "production : le SMS aussi",
  deciderEnvoi({ mode: "production", canal: "sms", destinataire: "+33612345678" }).autorise,
);

// ═══════════════════════════════════════════════════════════════════════
titre("2. Rien ne part en recette ni en développement, par défaut");
// ═══════════════════════════════════════════════════════════════════════

for (const mode of ["recette", "developpement"] as const) {
  const d = deciderEnvoi({ ...base, mode });
  faux(`${mode} : e-mail REFUSÉ par défaut`, d.autorise);
  if (!d.autorise) {
    eq(`${mode} : code nommé`, d.code, "mode_sans_envoi");
    vrai(`${mode} : le message dit quoi faire`, d.message.includes("CGK_ENVOI_REEL"));
    vrai(`${mode} : le message dit que c'est capturé`, d.message.includes("capturé"));
  }
  faux(
    `${mode} : SMS REFUSÉ par défaut`,
    deciderEnvoi({ mode, canal: "sms", destinataire: "+33612345678" }).autorise,
  );
}

// ═══════════════════════════════════════════════════════════════════════
titre("3. L'autorisation explicite, et ses deux conditions");
// ═══════════════════════════════════════════════════════════════════════

vrai(
  "oui + destinataire sur la liste → autorisé",
  deciderEnvoi({
    ...base,
    mode: "recette",
    envoiReelAutorise: "oui",
    destinatairesAutorises: "client@exemple.fr",
  }).autorise,
);
const horsListe = deciderEnvoi({
  ...base,
  mode: "recette",
  envoiReelAutorise: "oui",
  destinatairesAutorises: "quelquun.dautre@exemple.fr",
});
faux("oui + destinataire HORS liste → refusé", horsListe.autorise);
if (!horsListe.autorise) {
  eq("… code nommé", horsListe.code, "destinataire_hors_liste");
  faux(
    "… et le destinataire n'est PAS reproduit dans le message",
    horsListe.message.includes("client@exemple.fr"),
  );
}
const sansListe = deciderEnvoi({ ...base, mode: "recette", envoiReelAutorise: "oui" });
faux("oui SANS liste blanche → refusé", sansListe.autorise);
if (!sansListe.autorise) eq("… code nommé", sansListe.code, "liste_blanche_absente");

// ═══════════════════════════════════════════════════════════════════════
titre("4. La liste blanche ne se laisse pas contourner");
// ═══════════════════════════════════════════════════════════════════════

eq("une liste vide reste vide", listeBlanche(undefined), []);
eq("les espaces sont retirés", listeBlanche(" a@b.fr , c@d.fr "), ["a@b.fr", "c@d.fr"]);

vrai("adresse exacte", surListeBlanche("moi@exemple.fr", ["moi@exemple.fr"]));
vrai("la casse ne contourne pas", surListeBlanche("MOI@Exemple.FR", ["moi@exemple.fr"]));
vrai("les espaces autour ne contournent pas", surListeBlanche("  moi@exemple.fr  ", ["moi@exemple.fr"]));
faux("une autre adresse ne passe pas", surListeBlanche("autre@exemple.fr", ["moi@exemple.fr"]));
vrai("un domaine entier avec @", surListeBlanche("qui@exemple.invalid", ["@exemple.invalid"]));
faux("… mais pas un domaine voisin", surListeBlanche("qui@exemple.invalid.fr", ["@exemple.invalid"]));
faux("une liste vide n'autorise personne", surListeBlanche("moi@exemple.fr", []));
faux("une entrée vide n'autorise personne", surListeBlanche("moi@exemple.fr", ["", "  "]));

// Les numéros : un SMS doit se comparer sur les chiffres, sinon un espace ou
// un préfixe suffit à passer la liste blanche.
vrai("numéro identique", surListeBlanche("+33612345678", ["+33612345678"]));
vrai("espaces dans le numéro", surListeBlanche("+33 6 12 34 56 78", ["+33612345678"]));
vrai("tirets dans le numéro", surListeBlanche("+33-612-345-678", ["+33612345678"]));
faux("un autre numéro ne passe pas", surListeBlanche("+33699999999", ["+33612345678"]));

// ═══════════════════════════════════════════════════════════════════════
titre("5. Les TROIS points d'envoi passent par le goulet");
// ═══════════════════════════════════════════════════════════════════════
//
// Il n'y a que trois accès réseau d'envoi dans ce dépôt. Si un quatrième
// apparaissait sans garde, ces contrôles ne le verraient pas : la dernière
// assertion de ce bloc compte donc les accès, pour qu'un ajout se signale.

const brevo = readFileSync("lib/brevo.ts", "utf8");
vrai("lib/brevo.ts importe la garde", brevo.includes('from "@/lib/envoi/garde-server"'));
vrai("sendBrevoEmail appelle la garde", /sendBrevoEmail[\s\S]{0,600}garderEnvoi\(/.test(brevo));
vrai("sendBrevoSms appelle la garde", /sendBrevoSms[\s\S]{0,600}garderEnvoi\(/.test(brevo));
vrai(
  "la garde est appelée AVANT le fetch vers Brevo",
  brevo.indexOf("garderEnvoi(") < brevo.indexOf("await fetch(BREVO_ENDPOINT"),
);
vrai(
  "… et un refus rend ok:false, sans envoyer",
  brevo.includes("if (!garde.ok) return { ok: false, error: garde.error }"),
);

const email = readFileSync("lib/devis/email.ts", "utf8");
vrai("lib/devis/email.ts importe la garde", email.includes('from "@/lib/envoi/garde-server"'));
vrai(
  "la garde est posée AVANT le choix du canal",
  email.indexOf("garderEnvoi(") < email.indexOf("Canal 1 : Brevo"),
);
vrai(
  "… donc AVANT nodemailer",
  email.indexOf("garderEnvoi(") < email.indexOf("nodemailer.createTransport"),
);
vrai("… et un refus lève", /if \(!garde\.ok\) throw new Error\(garde\.error\)/.test(email));

// Le compte des accès réseau d'envoi. Trois aujourd'hui ; un quatrième doit
// faire échouer ce contrôle plutôt que de passer inaperçu.
const accesReseau =
  (brevo.match(/await fetch\(BREVO_(ENDPOINT|SMS_ENDPOINT)/g) ?? []).length +
  (email.match(/transport\.sendMail\(/g) ?? []).length;
eq("exactement trois accès réseau d'envoi", accesReseau, 3);

// ═══════════════════════════════════════════════════════════════════════
titre("6. Un message capturé ne se fait pas passer pour envoyé");
// ═══════════════════════════════════════════════════════════════════════
//
// Faire croire à l'interface que l'envoi a réussi serait une validation
// fictive : on vérifierait un écran affichant « Envoyé » alors que rien n'est
// parti. C'est exactement ce que la règle 6 du client interdit.

const gardeSrc = readFileSync("lib/envoi/garde-server.ts", "utf8");
vrai("la garde rend ok:false quand elle refuse", gardeSrc.includes("return { ok: false, error:"));
// Un seul chemin autorise, et c'est le retour anticipé sur `decision.autorise`.
// Compter les `{ ok: true }` est plus sûr qu'un motif de voisinage : s'il en
// apparaissait un second, il serait par construction sur un chemin de refus.
// On compte les `return`, pas les occurrences du littéral : la déclaration de
// type et la documentation en contiennent aussi, et un contrôle qui les compte
// mesure la prose plutôt que le comportement.
eq(
  "un SEUL `return { ok: true }` dans toute la garde",
  (gardeSrc.match(/return\s*\{\s*ok:\s*true\s*\}/g) ?? []).length,
  1,
);
vrai(
  "… et c'est le retour anticipé sur l'autorisation",
  /if \(decision\.autorise\) return \{ ok: true \};/.test(gardeSrc),
);
vrai(
  "… donc tout ce qui suit est un chemin de refus",
  gardeSrc.indexOf("if (decision.autorise) return { ok: true };") <
    gardeSrc.indexOf("capturer(t, decision.code)"),
);
vrai("le message capturé est écrit sur le disque", gardeSrc.includes("writeFile"));
vrai("… les pièces jointes aussi", gardeSrc.includes("Buffer.from(p.bytes)"));
vrai("… et le chemin est rendu à l'appelant", gardeSrc.includes("Capture :"));
vrai(
  "une capture impossible ne devient pas une autorisation",
  gardeSrc.includes("La capture a échoué"),
);
vrai("la tentative est journalisée", gardeSrc.includes("console.warn"));
vrai(
  "le transport qui AURAIT servi est consigné",
  gardeSrc.includes("transport_qui_aurait_servi"),
);

for (const f of ["lib/envoi/decision.ts", "lib/envoi/garde-server.ts"]) {
  const src = readFileSync(f, "utf8");
  faux(`${f} — aucune condition constamment fausse`, /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(src));
}

bilan("transports d'e-mail et goulet d'envoi");
