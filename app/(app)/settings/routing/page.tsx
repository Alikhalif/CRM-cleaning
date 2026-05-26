import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getAllCommerciaux } from "@/lib/leads-server";
import RoutingList from "./RoutingList";
import type { ExistingRule } from "./RoutingRuleModal";
import styles from "./Routing.module.scss";

export const metadata = { title: "Règles de routing" };

// Admin-only. Lists routing_rules ordered by priority asc — same order as
// the engine evaluates them so the visual order = the execution order.

export default async function RoutingPage() {
  const supabase = await supabaseServer();
  const [{ data: rules }, user, commerciaux] = await Promise.all([
    supabase
      .from("routing_rules")
      .select("id, name, priority, conditions, action, is_active")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<ExistingRule[]>(),
    getCurrentUserProfile(),
    getAllCommerciaux(),
  ]);
  const isAdmin = (user?.roles ?? []).some((r) => r.slug === "admin");

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
        <span aria-hidden="true">/</span>
        <span>Règles de routing</span>
      </nav>

      <header className={styles.pageHeader}>
        <h1 className={styles.title}>Règles de routing des leads</h1>
        <p className={styles.subtitle}>
          Automatisation de l&apos;attribution des leads selon des critères (superficie, secteur, source,
          montant, client premium). Évaluées dans l&apos;ordre de priorité, la première qui matche gagne.
        </p>
      </header>

      {!isAdmin ? (
        <div className={styles.forbidden}>
          <p>
            <strong>Accès restreint</strong> — la gestion des règles est réservée aux comptes
            <strong> Admin</strong>.
          </p>
        </div>
      ) : (
        <RoutingList rules={rules ?? []} commerciaux={commerciaux} />
      )}
    </div>
  );
}
