import styles from "./page-shell.module.scss";

type Props = {
  title: string;
  subtitle?: string;
  placeholder?: string;
};

export default function PageShell({ title, subtitle, placeholder }: Props) {
  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={styles.placeholder}>
        {placeholder ?? "Module à implémenter."}
      </div>
    </>
  );
}
