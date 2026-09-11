import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import styles from "./PhotoWaitingBanner.module.scss";

// Indicateur « Clients en attente de photos » (module Actions & Relances).
// Additif : n'apparaît que s'il y a au moins un dossier en attente. Cliquable →
// ouvre la liste filtrée (Ma journée · onglet Photos).
export default function PhotoWaitingBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link href="/ma-journee?tab=photos" className={styles.banner}>
      <span className={styles.icon}><Icon name="image" size={18} /></span>
      <span className={styles.value}>{count}</span>
      <span className={styles.label}>
        client{count > 1 ? "s" : ""} en attente de photos
        <span className={styles.sub}>Relancer pour débloquer le devis</span>
      </span>
      <span className={styles.cta}>Voir les dossiers <Icon name="chevron-down" size={13} /></span>
    </Link>
  );
}
