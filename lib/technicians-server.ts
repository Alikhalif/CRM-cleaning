import "server-only";
import { supabaseServer } from "./supabase/server";

// Gestion des intervenants (sous-traitants) — CRUD Paramètres. Les secteurs
// sont stockés en IDs d'activités (comme la table technicians le fait déjà).

export type TechnicianAdmin = {
  id: string;
  name: string;
  email: string | null;
  initials: string;
  color: string;
  sectorIds: string[];
  basePostalCode: string | null;
  serviceDepartments: string[];
  isActive: boolean;
};

type Row = {
  id: string;
  name: string;
  email: string | null;
  initials: string;
  color: string | null;
  sectors: string[] | null;
  base_postal_code: string | null;
  service_departments: string[] | null;
  is_active: boolean;
};

export async function getTechniciansAdmin(): Promise<TechnicianAdmin[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, name, email, initials, color, sectors, base_postal_code, service_departments, is_active")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true })
    .returns<Row[]>();
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    initials: r.initials,
    color: r.color ?? "#5b4bcc",
    sectorIds: r.sectors ?? [],
    basePostalCode: r.base_postal_code,
    serviceDepartments: r.service_departments ?? [],
    isActive: r.is_active,
  }));
}

export async function getSectorOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("id, label")
    .eq("is_active", true)
    .order("label", { ascending: true })
    .returns<{ id: string; label: string }[]>();
  return data ?? [];
}
