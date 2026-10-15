import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import { getAllCommerciaux, getAllLeads } from "./leads-server";
import { getCurrentUserProfile } from "./users-server";
import { profileCapabilities, SECTOR_LABEL, visibleSectorsForUser, type Lead, type Sector } from "./leads";
import { effectiveDue, type ActionType, type CommercialAction } from "./commercial-actions/shared";
import { alertFor, nextActionLabel, type Situation, type SuiviRow } from "./suivi-shared";

// Assemblage du « Suivi commercial ». Lecture seule : aucune écriture, aucune
// tâche créée. Les échéances viennent du moteur d'actions commerciales, les
// dossiers de getAllLeads (déjà filtré par la RLS sur owner_id).
//
// ⚠️ SÉCURITÉ — le filtrage par ACTIVITÉ se fait ICI, côté serveur. L'ancienne
// page « Leads & devis » le faisait dans un useMemo du composant client : le
// serveur envoyait au navigateur d'un commercial les dossiers de secteurs
// auxquels il n'est pas affecté, et seul l'affichage les masquait. Les lignes
// hors périmètre ne quittent plus le serveur.

export type SuiviData = {
  rows: SuiviRow[];
  // Horloge du SERVEUR. React 19 interdit Date.now() pendant le rendu (règle
  // de pureté) et un now côté client divergerait du SSR à l'hydratation. La
  // page étant rendue à chaque requête, cet instantané suffit.
  now: number;
  // Secteurs réellement autorisés — alimente le filtre « Activité » pour qu'il
  // ne propose jamais une activité interdite.
  sectors: { slug: Sector; label: string }[];
  isBackOffice: boolean;
  isAdmin: boolean;
  meId: string | null;
  meName: string;
  canUseRingover: boolean;
  // Liste des commerciaux visibles — vide pour un commercial (il n'a que lui).
  commerciaux: { id: string; name: string }[];
};

type ActionRow = {
  id: string;
  lead_id: string;
  owner_id: string | null;
  type: string;
  title: string;
  status: string;
  due_at: string;
  snoozed_until: string | null;
};

// Montant à afficher : celui du dernier devis émis, à défaut l'estimation du
// lead. 0 ou absent → null, pour afficher « — » et jamais « 0 € » (§16).
async function devisAmounts(leadIds: string[]): Promise<{
  amounts: Map<string, number>;
  brouillons: Set<string>;
  envois: Map<string, string>;
  signatures: Map<string, string>;
}> {
  const out = new Map<string, number>();
  const brouillons = new Set<string>();
  const envois = new Map<string, string>();
  const signatures = new Map<string, string>();
  if (leadIds.length === 0) return { amounts: out, brouillons, envois, signatures };
  const sb = await supabaseServer();
  const [docsRes, optRes] = await Promise.all([
    sb.from("documents").select("lead_id, total_ttc, issued_at, signed_at, type, status")
      .in("lead_id", leadIds).eq("type", "devis")
      .returns<{ lead_id: string | null; total_ttc: number | null; issued_at: string; signed_at: string | null; status: string }[]>(),
    sb.from("devis_optimivv").select("lead_id, montant_ht, created_at, sent_at, data")
      .in("lead_id", leadIds)
      .returns<{ lead_id: string | null; montant_ht: number | null; created_at: string; sent_at: string | null; data: { _signature_meta?: { signedAt?: string } } | null }[]>(),
  ]);
  const seen = new Map<string, string>(); // leadId -> date du montant retenu
  const put = (leadId: string | null, amount: number | null, date: string) => {
    if (!leadId || !amount) return;
    const prev = seen.get(leadId);
    if (prev && prev >= date) return;
    seen.set(leadId, date);
    out.set(leadId, Number(amount));
  };
  // Le plus récent gagne : un dossier peut porter plusieurs devis.
  const garder = (m: Map<string, string>, id: string | null, d: string | null) => {
    if (!id || !d) return;
    const prec = m.get(id);
    if (!prec || prec < d) m.set(id, d);
  };
  for (const d of docsRes.data ?? []) {
    put(d.lead_id, d.total_ttc, d.issued_at);
    // Un devis en brouillon = travail commencé, rien n'est parti chez le
    // client. C'est l'étape « Devis en préparation ».
    if (d.lead_id && d.status === "brouillon") brouillons.add(d.lead_id);
    else garder(envois, d.lead_id, d.issued_at);
    garder(signatures, d.lead_id, d.signed_at);
  }
  for (const d of optRes.data ?? []) {
    put(d.lead_id, d.montant_ht, d.created_at);
    garder(envois, d.lead_id, d.sent_at ?? d.created_at);
    garder(signatures, d.lead_id, d.data?._signature_meta?.signedAt ?? null);
  }
  return { amounts: out, brouillons, envois, signatures };
}


// Appel entrant vs formulaire, lu DIRECTEMENT en base.
//
// On ne peut pas le déduire de `lead.source` côté client : le mapper retire ce
// champ du payload d'un commercial (confidentialité de la provenance), et on
// étiquetterait alors tous ses dossiers « formulaire ». On relit donc le seul
// slug, côté serveur, pour en sortir un BINAIRE — sans jamais renvoyer le
// canal lui-même au navigateur.
async function originByLead(leadIds: string[]): Promise<Map<string, "phone" | "form">> {
  const out = new Map<string, "phone" | "form">();
  if (leadIds.length === 0) return out;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("leads")
    .select("id, source:lead_sources(slug)")
    .in("id", leadIds)
    .returns<{ id: string; source: { slug: string } | null }[]>();
  for (const r of data ?? []) {
    out.set(r.id, r.source?.slug === "telephone" ? "phone" : "form");
  }
  return out;
}

// Situation RÉELLE du dossier, lue depuis le lead. Aucun statut dupliqué.
function situationOf(lead: Lead, photoPending: boolean, devisBrouillon: boolean): Situation {
  if (lead.status === "perdu") return "perdu";
  if (lead.status === "signe" || lead.status === "encaisse") return "signe";
  if (lead.status === "ouvert") return "devis_ouvert";
  if (lead.status === "envoye") return "devis_envoye";
  // Statut « lead » : l'avancement se lit dans la découverte.
  if (devisBrouillon) return "devis_preparation";
  if (photoPending) return "attente_client";
  if (lead.discoveryDoneAt) return "decouverte_faite";
  const commencee =
    lead.announcedPrice != null ||
    lead.surfaceM2 != null ||
    !!lead.priceRange ||
    !!lead.delaiSouhaite ||
    !!lead.contexteIntervention ||
    Object.keys(lead.discoveryDetails ?? {}).length > 0;
  return commencee ? "decouverte_encours" : "nouveau";
}

export async function getSuiviData(): Promise<SuiviData> {
  const [leads, me, tousCommerciaux] = await Promise.all([
    getAllLeads(),
    getCurrentUserProfile(),
    getAllCommerciaux(),
  ]);
  const nomParId = new Map(tousCommerciaux.map((c) => [c.id, c.name]));

  const roles = (me?.roles ?? []).map((r) => r.slug);
  const isAdmin = roles.includes("admin");
  const isPlanner = roles.includes("planification");
  const isBackOffice = isAdmin || isPlanner;
  const sectors = visibleSectorsForUser({ isAdmin, isPlanner, activities: me?.activities ?? [] });
  const sectorSet = new Set<string>(sectors);

  // ⚠️ Filtre d'activité SERVEUR — voir l'avertissement en tête de fichier.
  const visibles = leads.filter((l) => sectorSet.has(l.sector));
  const ids = visibles.map((l) => l.id);

  // Actions actives du moteur, restreintes aux dossiers déjà visibles : le
  // service-role ne sert qu'à lire la table d'actions, jamais à élargir le
  // périmètre des dossiers.
  const actionsByLead = new Map<string, CommercialAction>();
  const photoPendingLeads = new Set<string>();
  if (ids.length > 0) {
    const sb = await supabaseServiceRole();
    const { data } = await sb
      .from("commercial_actions")
      .select("id, lead_id, owner_id, type, title, status, due_at, snoozed_until")
      .in("lead_id", ids)
      .neq("status", "terminee")
      .order("due_at", { ascending: true })
      .returns<ActionRow[]>();
    for (const r of data ?? []) {
      if (r.type === "photos") photoPendingLeads.add(r.lead_id);
      // La première rencontrée gagne : la requête est triée par échéance.
      if (actionsByLead.has(r.lead_id)) continue;
      actionsByLead.set(r.lead_id, {
        id: r.id, leadId: r.lead_id, leadRef: null, leadName: null,
        ownerId: r.owner_id, ownerName: null,
        type: r.type as ActionType, title: r.title, reason: null,
        status: r.status as CommercialAction["status"],
        createdAt: r.due_at, dueAt: r.due_at, snoozedUntil: r.snoozed_until,
        reportCount: 0, closedAt: null, closedReason: null, result: null, subtype: null,
      });
    }
  }

  const now = Date.now();
  const [{ amounts, brouillons, envois, signatures }, origines] = await Promise.all([
    devisAmounts(ids),
    originByLead(ids),
  ]);

  const rows: SuiviRow[] = visibles.map((l) => {
    const action = actionsByLead.get(l.id) ?? null;
    const situation = situationOf(l, photoPendingLeads.has(l.id), brouillons.has(l.id));
    const due = action ? new Date(effectiveDue(action)).toISOString() : null;
    const overdue = action ? effectiveDue(action) < now : false;
    const devis = amounts.get(l.id) ?? null;
    const amount = devis ?? (l.amount && l.amount > 0 ? l.amount : null);
    const base = {
      leadId: l.id,
      shortId: l.shortId,
      client: l.client,
      phone: l.phone,
      sector: l.sector,
      sectorLabel: SECTOR_LABEL[l.sector] ?? l.sector,
      amount,
      amountIsEstimate: devis == null && amount != null,
      situation,
      dueAt: due,
      overdue,
      nextAction: nextActionLabel(situation, action),
      actionType: action?.type ?? null,
      ownerId: l.ownerId ?? null,
      ownerName: l.ownerId ? nomParId.get(l.ownerId) ?? null : null,
      lastActionLabel: l.lastActionLabel || "",
      lastActionAt: l.lastActionAt,
      devisSentAt: envois.get(l.id) ?? null,
      signedAt: signatures.get(l.id) ?? null,
      isUrgent: Boolean(l.isUrgent),
      isNrp: Boolean(l.isNrp),
      societe: l.entityName ?? null,
      receivedAt: l.receivedAt,
      // Appel entrant vs formulaire — visible par TOUS, y compris le
      // commercial (demande client du 14/10, répétée trois fois).
      //
      // ⚠️ On n'expose que ce BINAIRE, jamais le canal lui-même : un
      // commercial apprend qu'un lead vient d'un formulaire, pas s'il vient de
      // Google Ads, de Meta ou du site. Le slug `source`, l'URL d'origine, la
      // landing page et les UTM restent retirés de son payload et chiffrés au
      // repos. C'est le minimum nécessaire pour qu'il traite un appel entrant
      // autrement qu'un formulaire.
      origin: origines.get(l.id) ?? "form",
    };
    return { ...base, alert: alertFor(base) };
  });

  // Seulement les commerciaux qui PORTENT un dossier visible : le filtre ne
  // doit pas servir d'annuaire de l'équipe (cf. correctif du 13/10 sur
  // « Tous les commerciaux »).
  const porteurs = new Set(visibles.map((l) => l.ownerId).filter((x): x is string => !!x));
  const commerciaux = isBackOffice
    ? [...porteurs].map((id) => ({ id, name: nomParId.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return {
    rows,
    now,
    sectors: sectors.map((s) => ({ slug: s, label: SECTOR_LABEL[s] ?? s })),
    isBackOffice,
    isAdmin,
    meId: me?.id ?? null,
    meName: me?.displayName ?? "",
    canUseRingover: profileCapabilities(me?.commercialProfiles ?? [], isAdmin, isPlanner).canUseRingover,
    commerciaux,
  };
}
