import { getAllGrids } from "@/lib/pricing/grid-server";
import GridsDashboard from "./GridsDashboard";
import styles from "./Grilles.module.scss";

export const metadata = { title: "Grilles tarifaires" };

// Centre de pilotage tarifaire — Super Admin uniquement (garde dans layout.tsx
// + RLS sur pricing_grids). Une carte par activité, chacune avec sa grille
// indépendante.
export default async function GrillesTarifairesPage() {
  const grids = await getAllGrids();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Grilles tarifaires</h1>
        <p className={styles.subtitle}>
          Vous êtes seul à décider des tarifs. Une grille en <strong>brouillon</strong> n&apos;est
          jamais utilisée par un commercial, quels que soient ses autres réglages.
        </p>
      </header>
      <GridsDashboard grids={grids} />
    </div>
  );
}
