import PipelineBoard from "./PipelineBoard";
import styles from "./Pipeline.module.scss";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
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
      <PipelineBoard />
    </div>
  );
}
