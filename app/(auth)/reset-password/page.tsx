import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { updatePassword } from "../actions";
import PasswordInput from "../PasswordInput";
import styles from "../auth.module.scss";

export const metadata = { title: "Nouveau mot de passe" };

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

// L'utilisateur arrive ici depuis le lien du mail : /auth/callback a déjà
// échangé le code contre une session de récupération, donc getUser() renvoie
// le compte concerné. Sans session → lien invalide/expiré.
export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className={styles.card}>
      <header className={styles.head}>
        <span className={styles.brand} aria-hidden="true">CGK</span>
        <h1 className={styles.title}>Nouveau mot de passe</h1>
        <p className={styles.subtitle}>
          {user ? `Compte : ${user.email}` : "Définissez un nouveau mot de passe"}
        </p>
      </header>

      {params.error && <p className={styles.error}>{params.error}</p>}

      {!user ? (
        <p className={styles.notice}>
          Ce lien est invalide ou expiré.{" "}
          <Link href="/forgot-password" className={styles.link}>Refaire une demande</Link>.
        </p>
      ) : (
        <form action={updatePassword} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nouveau mot de passe</span>
            <PasswordInput name="password" autoComplete="new-password" minLength={12} placeholder="••••••••••••" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Confirmer le mot de passe</span>
            <PasswordInput name="confirm" autoComplete="new-password" minLength={12} placeholder="••••••••••••" />
          </label>

          <button type="submit" className={styles.btnPrimary}>Mettre à jour</button>
        </form>
      )}

      <p className={styles.footer}>
        <Link href="/login" className={styles.link}>← Retour à la connexion</Link>
      </p>
    </main>
  );
}
