import Link from "next/link";
import { login } from "../actions";
import GoogleSignInButton from "../GoogleSignInButton";
import styles from "../auth.module.scss";

export const metadata = { title: "Connexion" };

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <main className={styles.card}>
      <header className={styles.head}>
        <span className={styles.brand} aria-hidden="true">CGK</span>
        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.subtitle}>Accédez à votre espace CGK CRM</p>
      </header>

      {params.notice && <p className={styles.notice}>{params.notice}</p>}
      {params.error && <p className={styles.error}>{params.error}</p>}

      <GoogleSignInButton next={next} />

      <div className={styles.divider} role="separator" aria-orientation="horizontal">
        <span>ou</span>
      </div>

      <form action={login} className={styles.form}>
        <input type="hidden" name="next" value={next} />

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
          <span className={styles.fieldLabel}>Mot de passe</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={styles.input}
            placeholder="••••••••"
          />
        </label>

        <button type="submit" className={styles.btnPrimary}>Se connecter</button>
      </form>

      <p className={styles.footer}>
        Pas encore de compte ?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className={styles.link}>
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
