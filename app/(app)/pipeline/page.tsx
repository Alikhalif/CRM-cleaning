import PipelineBoard from "./PipelineBoard";
import styles from "./Pipeline.module.scss";
import { getAllCommerciaux, getAllLeads } from "@/lib/leads-server";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [leads, commerciaux] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Pipeline commercial</h1>
          <p className={styles.subtitle}>
            6 colonnes · glisser-déposer entre étapes · sous-statuts Mano/Auto et Sans/Avec acompte
          </p>
        </div>
      </header>
      <PipelineBoard initialLeads={leads} commerciaux={commerciaux} />
    </div>
  );
}
