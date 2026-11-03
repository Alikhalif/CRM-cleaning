import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { demarrerAutorisation } from "@/lib/docusign/oauth-server";
import { auditLog } from "@/lib/audit";

// Démarrage du raccordement DocuSign d'une entité juridique.
//
// Route et non action serveur : le flux se termine par une REDIRECTION vers
// DocuSign, et une redirection hors domaine se fait proprement en route.
//
// ⚠️ `/api/*` est public au niveau du proxy : le contrôle de rôle est fait
// ICI. Réservé au Super Admin — raccorder un compte DocuSign engage la
// société, ce n'est pas un geste de travail quotidien.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: roles } = await supabase
    .from("user_roles").select("roles(slug)").eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  if (!(roles ?? []).some((r) => r.roles?.slug === "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const entityId = new URL(request.url).searchParams.get("entity") ?? "";
  if (!UUID_RE.test(entityId)) {
    return NextResponse.json({ error: "entity_invalide" }, { status: 400 });
  }

  const r = await demarrerAutorisation({ entityId, userId: user.id });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });

  await auditLog({
    action: "docusign.authorize.start",
    entityType: "user",
    entityId: user.id,
    after: { entity_id: entityId },
  });

  // 303 : le navigateur refait un GET sur DocuSign, jamais un POST.
  return NextResponse.redirect(r.url, 303);
}
