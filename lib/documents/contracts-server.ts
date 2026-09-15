import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { getClientById } from "@/lib/clients-server";
import { ContractPdf } from "@/lib/pdf/ContractPdf";
import { PRESTATAIRE_CERT } from "@/lib/cert-hotte/types";
import { CLIENT_DOCS_BUCKET } from "./documents-server";
import type {
  Contract, ContractClause, ContractStatus, ContractTemplate, FieldValue, TemplateSection,
} from "./contracts-types";

// Couche données Contrats (Lot 2). Lecture des templates dynamiques + des
// contrats d'un client ; rendu + archivage du PDF (bucket privé partagé
// client-documents, préfixe contracts/). Réutilise l'émetteur OPTIMIVV.

const SIGNED_TTL = 3600;

// ── Templates ───────────────────────────────────────────────────────────────
type TplRow = { key: string; name: string; kind: string; category: string | null; schema: unknown; clauses: unknown };

function parseTemplate(r: TplRow): ContractTemplate {
  const schema = (r.schema ?? {}) as { sections?: TemplateSection[] };
  const clauses = (Array.isArray(r.clauses) ? r.clauses : []) as ContractClause[];
  return { key: r.key, name: r.name, kind: r.kind, category: r.category, sections: schema.sections ?? [], clauses };
}

export async function getContractTemplates(): Promise<ContractTemplate[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("contract_templates")
    .select("key, name, kind, category, schema, clauses")
    .eq("is_active", true)
    .order("name")
    .returns<TplRow[]>();
  return (data ?? []).map(parseTemplate);
}

export async function getContractTemplateByKey(key: string): Promise<ContractTemplate | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("contract_templates")
    .select("key, name, kind, category, schema, clauses")
    .eq("key", key)
    .maybeSingle<TplRow>();
  return data ? parseTemplate(data) : null;
}

// Valeurs de pré-remplissage résolues depuis la fiche client (§7).
export async function getContractPrefill(clientId: string): Promise<Record<string, string>> {
  const client = await getClientById(clientId);
  if (!client) return {};
  return {
    "client.name": client.name ?? "",
    "client.contact": client.contactName ?? "",
    "client.siret": client.siret ?? "",
    "client.phone": client.phone ?? "",
    "client.email": client.email ?? "",
    "client.address": client.address ?? "",
    "client.cpville": `${client.postalCode ?? ""} ${client.city ?? ""}`.trim(),
  };
}

// ── Contrats d'un client ────────────────────────────────────────────────────
type ContractRow = {
  id: string; ref: string | null; client_id: string; template_key: string | null; category: string | null;
  title: string; status: string; start_date: string | null; end_date: string | null; signed_date: string | null;
  frequency: string | null; passages_per_year: number | null; passages_done: number; amount: number | null;
  billing_mode: string | null; data: Record<string, FieldValue>; pdf_path: string | null; sent_at: string | null;
  created_by: string | null; created_at: string;
};

export async function getClientContracts(clientId: string): Promise<Contract[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("contracts")
    .select("id, ref, client_id, template_key, category, title, status, start_date, end_date, signed_date, frequency, passages_per_year, passages_done, amount, billing_mode, data, pdf_path, sent_at, created_by, created_at")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<ContractRow[]>();
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // URLs signées + noms créateurs.
  const paths = rows.map((r) => r.pdf_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  await Promise.all([
    paths.length
      ? sb.storage.from(CLIENT_DOCS_BUCKET).createSignedUrls(paths, SIGNED_TTL).then(({ data: d }) => {
          for (const x of d ?? []) if (x.signedUrl && x.path) signed.set(x.path, x.signedUrl);
        })
      : Promise.resolve(),
    userIds.length
      ? sb.from("users").select("id, first_name, last_name, email").in("id", userIds).then(({ data: d }) => {
          for (const u of (d ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]) {
            nameById.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Utilisateur");
          }
        })
      : Promise.resolve(),
  ]);

  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    clientId: r.client_id,
    templateKey: r.template_key,
    category: r.category,
    title: r.title,
    status: r.status as ContractStatus,
    startDate: r.start_date,
    endDate: r.end_date,
    signedDate: r.signed_date,
    frequency: r.frequency,
    passagesPerYear: r.passages_per_year,
    passagesDone: r.passages_done,
    amount: r.amount != null ? Number(r.amount) : null,
    billingMode: r.billing_mode,
    data: r.data ?? {},
    pdfUrl: r.pdf_path ? signed.get(r.pdf_path) ?? null : null,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    createdByName: r.created_by ? nameById.get(r.created_by) ?? null : null,
  }));
}

// ── Rendu + archivage du PDF ────────────────────────────────────────────────
const todayFr = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Génère le PDF depuis le template + valeurs, l'archive dans le bucket privé,
// et renvoie le chemin de stockage. Service-role (upload).
export async function renderAndUploadContractPdf(params: {
  clientId: string; ref: string; title: string; template: ContractTemplate; values: Record<string, FieldValue>;
}): Promise<string> {
  const buffer = await renderToBuffer(
    ContractPdf({
      emitter: PRESTATAIRE_CERT,
      ref: params.ref,
      title: params.title,
      dateFr: todayFr(),
      sections: params.template.sections,
      values: params.values,
      clauses: params.template.clauses,
    }),
  );
  const path = `contracts/${params.clientId}/${params.ref}.pdf`;
  const sb = await supabaseServiceRole();
  const up = await sb.storage.from(CLIENT_DOCS_BUCKET).upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error("Archivage du contrat échoué : " + up.error.message);
  return path;
}

// Alloue le prochain numéro de contrat (CTR-AAAA-0001) via la RPC gapless.
export async function allocateContractRef(): Promise<string> {
  const sb = await supabaseServiceRole();
  const year = new Date().getFullYear();
  const { data, error } = await sb.rpc("next_contract_num", { p_year: year });
  if (error || data == null) throw new Error("Numérotation contrat échouée : " + (error?.message ?? "vide"));
  return `CTR-${year}-${String(data).padStart(4, "0")}`;
}
