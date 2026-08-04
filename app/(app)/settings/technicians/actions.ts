"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

export type TechnicianInput = {
  name: string;
  email: string; // "" autorisé
  initials: string;
  color: string;
  sectorIds: string[];
  basePostalCode: string;
  serviceDepartments: string[];
  isActive: boolean;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
  return s.toUpperCase() || "??";
}

function validate(input: TechnicianInput): string | null {
  if (!input.name.trim()) return "Nom requis.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Email invalide.";
  return null;
}

function toRow(input: TechnicianInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim() || null,
    initials: (input.initials.trim() || initialsFrom(input.name)).slice(0, 3).toUpperCase(),
    color: input.color || "#5b4bcc",
    sectors: input.sectorIds,
    base_postal_code: input.basePostalCode.trim() || null,
    service_departments: input.serviceDepartments.map((d) => d.trim()).filter(Boolean),
    is_active: input.isActive,
  };
}

export async function createTechnician(input: TechnicianInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("technicians")
    .insert(toRow(input) as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: `Échec création : ${error?.message ?? "réservé admin/planif."}` };
  revalidatePath("/settings/technicians");
  await auditLog({ action: "technician.create", entityType: "user", entityId: data.id, after: { name: input.name } });
  return { ok: true, id: data.id };
}

export async function updateTechnician(id: string, input: TechnicianInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("technicians").update(toRow(input) as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  revalidatePath("/settings/technicians");
  await auditLog({ action: "technician.update", entityType: "user", entityId: id, after: { name: input.name } });
  return { ok: true };
}

export async function toggleTechnicianActive(id: string, isActive: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("technicians").update({ is_active: isActive } as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  revalidatePath("/settings/technicians");
  return { ok: true };
}
