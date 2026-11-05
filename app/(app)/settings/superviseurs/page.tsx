import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getDonneesAdminPerimetres } from "@/lib/supervision-perimetre-server";
import PerimetresSuperviseurs from "./PerimetresSuperviseurs";
import styles from "./Superviseurs.module.scss";

export const metadata = { title: "Périmètres des superviseurs" };

// Attribution des périmètres de supervision — Super Admin uniquement (garde
// dans layout.tsx).
//
// Pourquoi un écran dédié plutôt qu'une colonne de plus dans /settings/users :
// un périmètre, c'est quatre listes et quatre droits. Le tableau des
// utilisateurs compte déjà neuf colonnes ; y ajouter cela le rendrait
// illisible, et illisible veut dire mal configuré.

export default async function PerimetresSuperviseursPage() {
  const donnees = await getDonneesAdminPerimetres();

  return (
    <div className={styles.page}>
      <nav aria-label="Fil d'Ariane" className={styles.ariane}>
        <Link href="/settings">Paramètres</Link>
        <span aria-hidden="true"> / </span>
        <span>Périmètres des superviseurs</span>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.title}>Périmètres des superviseurs</h1>
        <p className={styles.subtitle}>
          Qui supervise quels pays, quelles activités et quels commerciaux — et avec quels droits
          d&apos;intervention. Chaque enregistrement est journalisé.
        </p>
      </header>

      <div className={styles.regle}>
        <Icon name="alert" size={16} />
        <div>
          <strong>Fermé par défaut.</strong> Un superviseur sans périmètre configuré n&apos;accède à
          aucune donnée commerciale. Les trois axes se cumulent : <em>pays</em> ET <em>activités</em>{" "}
          ET <em>commerciaux</em>. Laisser un axe vide ne veut pas dire « tout », cela ne laisse
          passer aucun dossier.
        </div>
      </div>

      {donnees.migrationManquante && (
        <div className={styles.alerteMigration}>
          <Icon name="alert" size={16} />
          <div>
            <strong>Migration non appliquée.</strong> Les colonnes des droits d&apos;intervention
            (<code>can_request_action</code>, <code>can_reassign</code>, <code>can_set_priority</code>,{" "}
            <code>include_unassigned</code>) sont absentes de la base. L&apos;écran s&apos;affiche,
            mais l&apos;enregistrement échouera jusqu&apos;à <code>npx supabase db push</code>{" "}
            (migration <code>20261105000001</code>).
          </div>
        </div>
      )}

      {donnees.superviseurs.length === 0 ? (
        <p className={styles.vide}>
          Aucun compte ne porte le rôle <strong>Superviseur</strong> aujourd&apos;hui. Attribuez-le
          d&apos;abord depuis <Link href="/settings/users">Paramètres · Utilisateurs</Link>, puis
          revenez définir son périmètre.
        </p>
      ) : (
        <PerimetresSuperviseurs donnees={donnees} />
      )}
    </div>
  );
}
