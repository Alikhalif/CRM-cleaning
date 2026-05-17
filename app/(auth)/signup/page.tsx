import Link from "next/link";
import { signup } from "../actions";
import styles from "../auth.module.scss";

export const metadata = { title: "Créer un compte" };

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <main className={styles.card}>
      <header className={styles.head}>
        <span className={styles.brand} aria-hidden="true">CGK</span>
        <h1 className={styles.title}>Créer un compte</h1>
        <p className={styles.subtitle}>
          Le premier utilisateur reçoit le rôle Admin automatiquement.
        </p>
      </header>

      {params.error && <p className={styles.error}>{params.error}</p>}

      <form action={signup} className={styles.form}>
        <input type="hidden" name="next" value={next} />

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Prénom</span>
            <input
              type="text"
              name="first_name"
              required
              autoComplete="given-name"
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nom</span>
            <input
              type="text"
              name="last_name"
              required
              autoComplete="family-name"
              className={styles.input}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={styles.input}
            placeholder="vous@cgk-services.fr"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Mot de passe (8 caractères min.)</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={styles.input}
            placeholder="••••••••"
          />
        </label>

        <button type="submit" className={styles.btnPrimary}>Créer le compte</button>
      </form>

      <p className={styles.footer}>
        Déjà un compte ?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.link}>
          Se connecter
        </Link>
      </p>
    </main>
  );
}
