// D32 — génère la migration 20261109000008 : fonctions (fonctions.sql) +
// réécriture de CHAQUE politique qui accorde `is_planificateur()`.
//
// Principe : on ne réinvente pas les politiques. On reprend leur texte
// EXACT, tel que le schéma effectif le donne, et on ne remplace QUE
// `is_planificateur()` par le contrôle de périmètre de la table. Les branches
// `is_admin()` et `owner_id = auth.uid()` restent intactes.
//
// Une table qui accorde `is_planificateur()` et n'est ni ci-dessous ni dans
// l'exclusion explicite fait ÉCHOUER la génération : on ne peut pas oublier
// une table en silence.

import { readFileSync, writeFileSync } from "node:fs";
import { lireSchema } from "./lecteur";

export const CIBLE = "20261109000008_d32_cloisonnement.sql";

/** Table → expression qui REMPLACE `is_planificateur()` dans ses politiques. */
export const CORRESPONDANCE: Record<string, string> = {
  leads: "planif_perimetre(country, entity_id)",
  clients: "planif_client_ligne(source_lead_id, pays, entite_id)",
  documents: "planif_document_ligne(lead_id, client_id, entity_id)",
  document_lines: "planif_document(document_id)",
  document_versions: "planif_document(document_id)",
  dossiers: "planif_lead(lead_id)",
  cert_hotte: "planif_lead_ou_dossier(lead_id, dossier_id)",
  client_documents: "planif_client(client_id)",
  contracts: "planif_document_ligne(lead_id, client_id, entity_id)",
  contract_passages: "planif_contrat(contract_id)",
  devis_optimivv: "planif_lead(lead_id)",
  lead_media: "planif_lead(lead_id)",
  intervenant_consultations: "planif_lead(lead_id)",
  signature_requests: "planif_document_ligne(lead_id, client_id, null)",
  signature_events: "planif_signature(signature_request_id)",
  subcontract_contracts: "planif_st_ligne(lead_id, entity_id)",
  subcontract_amendments: "planif_soustraitance(contract_id)",
  subcontract_events: "planif_soustraitance(contract_id)",
  subcontract_incidents: "planif_soustraitance(contract_id)",
  subcontract_lines: "planif_soustraitance(contract_id)",
  subcontract_missions: "planif_soustraitance(contract_id)",
  subcontract_reports: "planif_soustraitance(contract_id)",
  subcontract_report_photos: "planif_rapport_st(report_id)",
  subcontractor_invoices: "planif_facture_st(dossier_id)",
  actions_back_office: "planif_perimetre(pays, entite_id)",
  // Révélées par la seconde lecture (blocs DO sans boucle) :
  commercial_actions: "planif_lead(lead_id)",
  commercial_tasks: "planif_lead(lead_id)",
  commercial_action_events: "planif_action_commerciale(action_id)",
  commercial_task_events: "planif_tache_commerciale(task_id)",
  contrat_liens_acces: "planif_contrat(contract_id)",
  document_archive: "planif_archive(contract_id, client_id, entity_id)",
  docusign_envelopes: "planif_enveloppe_ligne(contract_id, entity_id)",
  docusign_envelope_events: "planif_enveloppe(envelope_id)",
  dossier_validations: "planif_dossier(dossier_id)",
};

/** Tables qui gardent `is_planificateur()` — et pourquoi. */
export const EXCLUES: Record<string, string> = {
  technicians: "annuaire des sous-traitants : aucun pays ni entité en base (D35, décision ouverte)",
  subcontractor_profiles: "fiche administrative d'un sous-traitant de l'annuaire (D35)",
  subcontractor_documents: "pièces de conformité d'un sous-traitant de l'annuaire (D35)",
  doc_counters: "compteurs de numérotation : aucune donnée métier",
  subcontract_sequences: "compteurs de numérotation : aucune donnée métier",
  document_retention_rules: "règles de rétention : paramètres, aucune donnée métier",
};

export function generer(): { sql: string; reecrites: number; tables: string[] } {
  const s = lireSchema("supabase/migrations", CIBLE);
  const tables = new Set<string>();
  const blocs: string[] = [];
  let reecrites = 0;
  const manquantes = new Set<string>();
  const politiques = [...s.politiques.values()].sort((a, b) => (a.table + a.nom).localeCompare(b.table + b.nom));
  for (const p of politiques) {
    if (!/is_planificateur\(\)/i.test(p.texte)) continue;
    if (EXCLUES[p.table]) continue;
    const expr = CORRESPONDANCE[p.table];
    if (!expr) { manquantes.add(`${p.table} (« ${p.nom} »)`); continue; }
    tables.add(p.table);
    // Arguments QUALIFIÉS par la table de la politique : placé dans une
    // sous-requête (`exists (select 1 from documents d where …)`), un
    // `lead_id` nu se rattacherait à la table INTERNE si elle a une colonne de
    // ce nom — le contrôle porterait alors sur la mauvaise ligne.
    const qualifiee = expr.replace(/\(([^)]*)\)/, (_m, args: string) =>
      `(${args.split(",").map((a) => a.trim()).map((a) => (/^[a-z_][a-z0-9_]*$/.test(a) && a !== "null" ? `${p.table}.${a}` : a)).join(", ")})`);
    const texte = p.texte.replace(/is_planificateur\(\)/gi, qualifiee).trim();
    blocs.push(
      `-- ${p.table} · « ${p.nom} » (${p.fichier})\n`
      + `drop policy if exists "${p.nom}" on ${p.table};\n`
      + `create policy "${p.nom}" on ${p.table}\n  ${texte.replace(/\s+/g, " ")};\n`,
    );
    reecrites++;
  }
  if (manquantes.size > 0) {
    throw new Error(`Tables ouvertes à la planification SANS règle de périmètre :\n  - ${[...manquantes].join("\n  - ")}`);
  }
  const entete = readFileSync("scripts/d32/fonctions.sql", "utf8");
  return { sql: `${entete}\n${blocs.join("\n")}`, reecrites, tables: [...tables].sort() };
}

if (process.argv.includes("--ecrire")) {
  const { sql, reecrites, tables } = generer();
  writeFileSync(`supabase/migrations/${CIBLE}`, sql);
  console.log(`${reecrites} politiques réécrites sur ${tables.length} tables → supabase/migrations/${CIBLE}`);
}
