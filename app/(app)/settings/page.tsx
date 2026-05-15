import PageShell from "../_shared/PageShell";

export const metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <PageShell
      title="Paramètres"
      subtitle="Utilisateurs · entités juridiques · secteurs · modèles · sources · intégrations."
      placeholder="6 sous-onglets · accès Super Admin uniquement"
    />
  );
}
