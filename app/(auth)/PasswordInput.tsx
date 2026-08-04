"use client";

import { useState } from "react";
import styles from "./auth.module.scss";

// Champ mot de passe avec bascule « Afficher / Masquer ». Sert surtout à
// détecter un mot de passe rempli automatiquement (autofill) par le navigateur
// qui remplace la saisie par une ancienne valeur → « Invalid login credentials »
// alors que l'utilisateur croit avoir tapé le bon.
type Props = {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
};

export default function PasswordInput({
  name,
  placeholder = "••••••••",
  autoComplete = "current-password",
  minLength,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        name={name}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className={styles.input}
        placeholder={placeholder}
        style={{ paddingRight: "76px" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "var(--color-brand-500)",
          padding: "4px",
        }}
      >
        {show ? "Masquer" : "Afficher"}
      </button>
    </div>
  );
}
