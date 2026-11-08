import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { genererDevisBuffer } from "@/lib/devis/render";
import { buildDevis, type DevisInput, type DocType } from "@/lib/devis/types";
import { allocateNumero, peekNumero } from "@/lib/devis/numero";
import { hasScope } from "@/lib/access-server";
import { verifierAvantCreation } from "@/lib/devis/garde-doublon";
import { archiveDevis } from "@/lib/devis/archive";
import { identitePourLead, versPrestataire } from "@/lib/devis/entite-emettrice";
import { controlerIdentitePourDevis, type VerdictIdentite } from "@/lib/devis/garde-identite";
import { lireReglageGabarits } from "@/lib/devis/reglage-gabarits-server";
import { resoudreGabarit } from "@/lib/devis/gabarits";
import { APP_SETTING_KEYS, getBooleanSetting } from "@/lib/app-settings";

/**
 * Identité de la société émettrice, et modèle graphique, pour un dossier.
 *
 * ⚠️ TOUT VIENT DE LA BASE. Le corps de la requête n'est jamais consulté :
 * c'est ce qui garantit qu'aucune identité juridique ne peut être mélangée
 * entre deux sociétés, ni inventée par un appelant.
 *
 * Sans dossier (`affaire` absente), rien n'est injecté : le générateur garde
 * ses valeurs par défaut, et le rendu est celui d'avant.
 */
async function identiteDuDossier(affaire: string | null | undefined): Promise<{
  champs: Partial<DevisInput>;
  verdict: VerdictIdentite | null;
}> {
  if (!affaire) return { champs: {}, verdict: null };
  const identite = await identitePourLead(affaire);
  if (!identite) return { champs: {}, verdict: null };

  const [reglages, stricte] = await Promise.all([
    lireReglageGabarits(),
    getBooleanSetting(APP_SETTING_KEYS.devisGardeIdentiteStricte),
  ]);
  const gabarit = identite.secteur
    ? resoudreGabarit({
      entityId: identite.entityId,
      secteur: identite.secteur,
      type: "devis",
      reglages,
    }).gabarit
    : null;

  const { prestataire, marque } = versPrestataire(identite);
  return {
    champs: {
      prestataire,
      marque,
      identiteDynamique: true,
      // Aucune société ne porte d'emblème exploitable : `legal_entities.logo_url`
      // existe en base mais aucun écran ne l'alimente, et c'est une URL de
      // stockage, pas un chemin disque. On n'imprime donc AUCUN emblème plutôt
      // que celui d'une autre société.
      logoPath: null,
      // Le modèle graphique suit le mapping, et non plus le secteur en dur.
      ...(gabarit === "optimivv_nettoyage"
        ? { template: "nettoyage" as const }
        : gabarit === "optimivv_demenagement"
          ? { template: "demenagement" as const }
          : {}),
    },
    verdict: controlerIdentitePourDevis(identite.entite, { stricte }),
  };
}

// pdfkit + fontkit + fs (polices/images) → runtime Node obligatoire (pas Edge).
export const runtime = "nodejs";

type Body = {
  data?: DevisInput;
  mode?: "preview" | "final";
  affaire?: string | null;
  /**
   * Le commercial a vu le devis existant et en veut un second (Lot A).
   *
   * Sans ce drapeau, la garde refuse une création sur un dossier qui porte
   * déjà un devis. Avec, elle s'efface : un devis rectificatif reste
   * possible, c'est une exigence explicite du client.
   */
  confirmerNouveau?: boolean;
  docType?: DocType;
};

// POST /api/devis — génère le PDF A4 du devis.
//  • mode "preview" : numéro FICTIF, aucune consommation de séquence ni archive
//    (l'aperçu est rafraîchi à chaque frappe, il ne doit pas brûler de numéros).
//  • mode "final"   : alloue un numéro gapless, archive le PDF exact, renvoie en
//    pièce jointe. Endpoint protégé : un générateur ouvert permettrait à
//    n'importe qui d'émettre un document au nom de l'entreprise.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const input = body.data;
  if (!input || typeof input !== "object" || !input.client) {
    return NextResponse.json({ ok: false, error: "missing_data" }, { status: 400 });
  }

  // ⚠️ L'IDENTITÉ DU PRESTATAIRE NE VIENT JAMAIS DU NAVIGATEUR — Lot B.
  //
  // `DevisInput` porte `prestataire`, `marque`, `identiteDynamique` et
  // `logoPath`. Ces champs arrivaient tels quels du corps de la requête et
  // s'imprimaient sur un document NUMÉROTÉ puis ARCHIVÉ : n'importe quel
  // appel authentifié pouvait émettre un devis au nom d'une société
  // inventée, avec un SIRET choisi.
  //
  // On les retire. L'identité est une donnée de la base, pas une saisie du
  // client. Le rendu ne change pas pour autant : l'écran « nouveau devis »
  // n'en envoyait aucun, et le générateur retombe donc sur ses valeurs par
  // défaut, exactement comme avant.
  const {
    prestataire: _prestataireIgnore,
    marque: _marqueIgnore,
    identiteDynamique: _identiteIgnore,
    logoPath: _logoIgnore,
    ...donneesSures
  } = input;
  void _prestataireIgnore;
  void _marqueIgnore;
  void _identiteIgnore;
  void _logoIgnore;

  const mode = body.mode === "final" ? "final" : "preview";
  const docType: DocType =
    body.docType === "facture" || input.docType === "facture" ? "facture" : "devis";

  // D28 · D30 (2026-11-09) — une FACTURE OPTIMIVV ne s'émet qu'au back-office.
  // Jusqu'ici, toute session — commercial compris — obtenait un numéro FAC
  // définitif et un PDF de facture par simple appel. Le devis, lui, reste au
  // commercial : rien ne change pour son parcours.
  if (docType === "facture" && !(await hasScope("backOffice"))) {
    return NextResponse.json(
      { ok: false, error: "facture_reservee_back_office" },
      { status: 403 },
    );
  }

  if (mode === "preview") {
    // L'aperçu affiche le PROCHAIN numéro de la série, lu sans l'incrémenter :
    // le commercial voit le numéro que portera le document, et la séquence
    // n'est pas brûlée par les régénérations à chaque frappe. Si la lecture
    // échoue, on retombe sur l'ancien libellé plutôt que de casser l'aperçu.
    // D28 : l'aperçu d'une FACTURE ne porte JAMAIS un numéro qui ressemble à un
    // numéro émis — téléchargé, il passerait pour une facture définitive. Le
    // libellé « APERÇU » est le repli historique de ce champ : la mise en page
    // (gelée) n'en est pas affectée. Le devis garde son aperçu numéroté.
    const numeroApercu = docType === "facture"
      ? "APERÇU"
      : input.numero || (await peekNumero(docType)) || "APERÇU";
    // L'aperçu montre l'identité RÉELLE : sans cela, le commercial validerait
    // un document qui ne ressemble pas à celui qui partira. La garde n'est pas
    // appliquée ici — un aperçu ne s'émet pas.
    const { champs } = await identiteDuDossier(body.affaire);
    const devis = buildDevis({ ...donneesSures, ...champs, docType }, numeroApercu);
    const pdf = await genererDevisBuffer(devis);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="apercu-${docType}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // mode final
  if (!input.client.nom) {
    return NextResponse.json(
      { ok: false, error: "client_nom_required" },
      { status: 400 },
    );
  }

  // ⚠️ GARDE CONTRE LE DOUBLON, AVANT D'ALLOUER LE NUMÉRO (Lot A).
  //
  // Cette route n'avait AUCUN contrôle : chaque appel allouait un numéro et
  // archivait un PDF. Un double-clic produisait deux devis numérotés sur la
  // même affaire, et consommait deux numéros d'une séquence sans trou —
  // qui, elle, ne se récupère pas.
  //
  // L'ordre est important : on vérifie AVANT `allocateNumero`, sinon le
  // numéro serait consommé par un appel qu'on refuse ensuite.
  if (body.affaire) {
    const verdict = await verifierAvantCreation(body.affaire, body.confirmerNouveau === true);
    if (!verdict.autorise) {
      return NextResponse.json(
        { ok: false, error: "devis_existant", message: verdict.motif, existants: verdict.existants },
        { status: 409 },
      );
    }
  }

  // ⚠️ GARDE D'IDENTITÉ, AVANT L'ALLOCATION DU NUMÉRO.
  //
  // Même raison que la garde anti-doublon : un numéro consommé sur une
  // émission refusée laisserait un trou dans une séquence qui n'en admet pas.
  const { champs, verdict } = await identiteDuDossier(body.affaire);
  if (verdict && !verdict.emissionAutorisee) {
    return NextResponse.json(
      {
        ok: false,
        error: "identite_incomplete",
        message:
          "Émission refusée : la société émettrice ne porte pas les mentions "
          + "obligatoires du devis — "
          + verdict.bloquants.map((b) => b.libelle).join(" · ")
          + ". À compléter dans Réglages › Sociétés émettrices.",
        griefs: verdict.bloquants,
      },
      { status: 409 },
    );
  }

  const numero = await allocateNumero(docType);
  const devis = buildDevis({ ...donneesSures, ...champs, docType }, numero);
  const pdf = await genererDevisBuffer(devis);
  await archiveDevis({
    devis,
    pdf,
    leadId: body.affaire ?? null,
    createdBy: user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${docType}-${numero}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Devis-Numero": numero,
    },
  });
}
