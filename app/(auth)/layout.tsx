import styles from "./auth.module.scss";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
