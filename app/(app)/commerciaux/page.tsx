import PageShell from "../_shared/PageShell";

export const metadata = { title: "Commerciaux" };

export default function CommerciauxPage() {
  return (
    <PageShell
      title="Commerciaux"
      subtitle="Performance et classement · visible par le Super Admin uniquement."
      placeholder="Leads · devis envoyés · signés · taux de transfo · CA · panier moyen · sparkline"
    />
  );
}
