import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { supabaseServer } from "@/lib/supabase/server";
import styles from "./ActionsAttendues.module.scss";

// Actions attendues du back-office (2026-11-09).
//
// Lues par la SESSION : la RLS décide de ce que chacun voit — le Super Admin
// tout, un planificateur les actions de SES pays (CDC §11). Elles restent
// affichées tant que l'action n'est pas FAITE : il n'existe ici, ni en base,
// aucun bouton « marquer comme lu ».
//
// `select("*")` : sans la migration 20261109000006, la table n'existe pas et
// le panneau ne s'affiche simplement pas — la page Planification reste intacte.

type Action = {
  id: string;
  type: string;
  titre: string;
  href: string | null;
  ouverte_at: string;
  escaladee_at: string | null;
};

function anciennete(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 48) return `depuis ${h} h`;
  return `depuis ${Math.floor(h / 24)} j`;
}

export default async function ActionsAttendues() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("actions_back_office")
    .select("*")
    .is("fermee_at", null)
    .order("escaladee_at", { ascending: true, nullsFirst: false })
    .order("ouverte_at", { ascending: true })
    .limit(50);
  if (error) return null;
  const actions = (data ?? []) as Action[];
  if (actions.length === 0) return null;
  const escaladees = actions.filter((a) => a.escaladee_at).length;

  return (
    <section className={styles.panneau} aria-labelledby="actions-attendues-titre">
      <h2 id="actions-attendues-titre" className={styles.titre}>
        <Icon name="checklist" size={16} /> Actions attendues
        <span className={styles.compte}>{actions.length}</span>
        {escaladees > 0 && <span className={styles.escalade}>{escaladees} en retard</span>}
      </h2>
      <p className={styles.aide}>
        Chaque action reste ici jusqu&apos;à ce qu&apos;elle soit <strong>effectuée</strong> —
        lire la notification ne la retire pas.
      </p>
      <ul className={styles.liste}>
        {actions.map((a) => (
          <li key={a.id} className={styles.item} data-escaladee={a.escaladee_at ? "oui" : undefined}>
            <Link href={a.href ?? "/planification"} className={styles.lien}>
              <span className={styles.libelle}>{a.titre}</span>
              <span className={styles.meta}>
                {anciennete(a.ouverte_at)}
                {a.escaladee_at && " · remontée au Super Admin"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
