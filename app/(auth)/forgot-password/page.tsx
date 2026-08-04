import Link from "next/link";
import { requestPasswordReset } from "../actions";
import styles from "../auth.module.scss";

export const metadata = { title: "Mot de passe oublié" };

type PageProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className={styles.card}>
      <header className={styles.head}>
        <span className={styles.brand} aria-hidden="true">CGK</span>
        <h1 className={styles.title}>Mot de passe oublié</h1>
        <p className={styles.subtitle}>Recevez un lien de réinitialisation par email</p>
      </header>

      {params.notice && <p className={styles.notice}>{params.notice}</p>}
      {params.error && <p className={styles.error}>{params.error}</p>}

      <form action={requestPasswordReset} className={styles.form}>
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

        <button type="submit" className={styles.btnPrimary}>Envoyer le lien</button>
      </form>

      <p className={styles.footer}>
        <Link href="/login" className={styles.link}>← Retour à la connexion</Link>
      </p>
    </main>
  );
}
