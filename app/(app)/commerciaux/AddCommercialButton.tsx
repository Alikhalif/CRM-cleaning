"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  COMMERCIAL_PROFILES,
  COMMERCIAL_PROFILE_LABEL,
  COUNTRIES,
  COUNTRY_LABEL,
} from "@/lib/leads";
import { createUserWithPassword } from "@/app/(app)/settings/users/actions";
import styles from "./Commerciaux.module.scss";

type EntityOption = { id: string; name: string };
type Props = { entities: EntityOption[] };

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: "0.75rem",
  cursor: "pointer",
  border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
  background: active ? "var(--color-brand-500)" : "transparent",
  color: active ? "#fff" : "var(--text-muted)",
});

// Dedicated "add a commercial" interface (admin-only page). Creates the account
// with a password + confirmed email so the commercial can log in immediately,
// without depending on the invite email. The on_auth_user_created trigger
// mirrors public.users and grants the commercial role.

const inp: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "0.9375rem",
};
const lbl: React.CSSProperties = { fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: 4 };

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export default function AddCommercialButton({ entities }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [entityId, setEntityId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const reset = () => {
    setEmail(""); setFirst(""); setLast(""); setPassword("");
    setProfiles([]); setCountries([]); setEntityId("");
    setError(null); setOkMsg(null);
  };
  const close = () => { if (!busy) { setOpen(false); reset(); } };

  const toggle = (list: string[], set: (v: string[]) => void, val: string) =>
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const submit = () => {
    const em = email.trim();
    if (!em || !em.includes("@")) { setError("Email invalide."); return; }
    if (password.length < 12) { setError("Mot de passe : 12 caractères minimum."); return; }
    setError(null); setOkMsg(null); setBusy(true);
    startTransition(async () => {
      const r = await createUserWithPassword(em, first, last, password, {
        profiles,
        countries,
        entityId,
      });
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      setOkMsg(`Compte créé pour ${em}. Il peut se connecter avec ce mot de passe.`);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /> Ajouter un commercial
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 22, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="commerciaux" size={18} /> Ajouter un commercial
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: -6 }}>
              Le compte est activé immédiatement. Communique-lui l&apos;email et le mot de passe — il se connecte sur la page de connexion.
            </p>

            {okMsg ? (
              <>
                <p style={{ color: "var(--tone-success, #14c890)", fontSize: "0.9375rem" }} role="status">
                  <Icon name="check" size={15} /> {okMsg}
                </p>
                <div style={{ background: "var(--bg-surface-2)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: "0.875rem", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
                  <div>Email : {email.trim()}</div>
                  <div>Mot de passe : {password}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => { reset(); }} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
                    Ajouter un autre
                  </button>
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                    Terminé
                  </button>
                </div>
              </>
            ) : (
              <>
                <label>
                  <span style={lbl}>Email</span>
                  <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="commercial@exemple.fr" autoComplete="off" />
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{ flex: 1 }}>
                    <span style={lbl}>Prénom</span>
                    <input style={inp} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Prénom" />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={lbl}>Nom</span>
                    <input style={inp} value={last} onChange={(e) => setLast(e.target.value)} placeholder="Nom" />
                  </label>
                </div>
                <label>
                  <span style={lbl}>Mot de passe (12 caractères min.)</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="new-password" />
                    <button type="button" onClick={() => setPassword(genPassword())} style={{ flexShrink: 0, padding: "0 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.8125rem" }}>
                      Générer
                    </button>
                  </div>
                </label>

                <div>
                  <span style={lbl}>Profils commerciaux (pools de routage)</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {COMMERCIAL_PROFILES.map((p) => (
                      <button key={p} type="button" onClick={() => toggle(profiles, setProfiles, p)} style={chipStyle(profiles.includes(p))}>
                        {COMMERCIAL_PROFILE_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 180px" }}>
                    <span style={lbl}>Pays couverts</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {COUNTRIES.map((c) => (
                        <button key={c} type="button" onClick={() => toggle(countries, setCountries, c)} title={COUNTRY_LABEL[c]} style={chipStyle(countries.includes(c))}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label style={{ flex: "1 1 160px" }}>
                    <span style={lbl}>Société</span>
                    <select style={inp} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
                      <option value="">—</option>
                      {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
                    </select>
                  </label>
                </div>

                {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={close} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
                    Annuler
                  </button>
                  <button type="button" onClick={submit} disabled={busy || !email.trim() || password.length < 12} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: !email.trim() || password.length < 12 ? 0.6 : 1 }}>
                    {busy ? "Création…" : "Créer le compte"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
