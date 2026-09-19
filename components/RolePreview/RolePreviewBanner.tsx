"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { useStoredValue, setStoredValue } from "@/lib/client-store";
import { PREVIEW_ROLE_KEY, previewRoleLabel } from "@/lib/role-preview";
import styles from "./RolePreview.module.scss";

// Bandeau persistant affiché pendant un aperçu de rôle (A15). Rendu HORS de la
// zone `inert` pour rester cliquable. Le bouton « Quitter l'aperçu » efface le
// drapeau et ramène l'admin à son tableau de bord.
export default function RolePreviewBanner() {
  const router = useRouter();
  const previewRole = useStoredValue(PREVIEW_ROLE_KEY, "");
  if (!previewRole) return null;

  const exit = () => {
    setStoredValue(PREVIEW_ROLE_KEY, "");
    router.push("/dashboard");
  };

  return (
    <div className={styles.banner} role="status" data-no-print="true">
      <Icon name="alert" size={15} />
      <span className={styles.text}>
        <strong>Aperçu — lecture seule.</strong> Vous consultez l&apos;espace{" "}
        <strong>{previewRoleLabel(previewRole)}</strong>. Aucune modification n&apos;est possible ici.
      </span>
      <button type="button" className={styles.exitBtn} onClick={exit}>
        Quitter l&apos;aperçu
      </button>
    </div>
  );
}
