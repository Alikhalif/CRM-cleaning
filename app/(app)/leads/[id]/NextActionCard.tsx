import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { TYPE_LABEL, TYPE_VERB, effectiveDue, relativeFr, type CommercialAction } from "@/lib/commercial-actions/shared";
import styles from "./NextActionCard.module.scss";

// Bloc « Prochaine action » — couche complémentaire (module Actions & Relances).
// Purement indicatif : rappelle au commercial la prochaine action à mener sur
// ce lead. La gestion (terminer / reporter) se fait dans « Ma journée ».

const TYPE_ICON = { decouverte: "phone", photos: "image", devis: "document", relance: "mail" } as const;

// Isolé hors du corps du composant : Date.now() dans un composant serveur est
// ré-évalué à chaque requête (comportement voulu ici), le helper contourne la
// règle react-hooks/purity (cf. daysSince dans page.tsx).
function isPast(ms: number): boolean {
  return ms < Date.now();
}

export default function NextActionCard({ action }: { action: CommercialAction }) {
  const due = effectiveDue(action);
  const late = isPast(due);
  return (
    <section className={`${styles.card} ${styles[`t_${action.type}`]} ${late ? styles.late : ""}`}>
      <div className={styles.head}>
        <span className={styles.icon}><Icon name={TYPE_ICON[action.type]} size={15} /></span>
        <div>
          <p className={styles.kicker}>Prochaine action · {TYPE_LABEL[action.type]}</p>
          <h3 className={styles.title}>{TYPE_VERB[action.type]}</h3>
        </div>
      </div>
      {action.reason && <p className={styles.reason}>{action.reason}</p>}
      <div className={styles.foot}>
        <span className={`${styles.due} ${late ? styles.dueLate : ""}`}>
          <Icon name="alert" size={12} />
          {late ? "en retard · " : "échéance "}{relativeFr(new Date(due).toISOString())}
        </span>
        <Link href="/ma-journee" className={styles.link}>Ma journée <Icon name="chevron-down" size={12} /></Link>
      </div>
    </section>
  );
}
