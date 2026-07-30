"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon/Icon";
import { OPEN_PALETTE_EVENT } from "../CommandPalette/CommandPalette";
import { useClientValue } from "@/lib/client-store";
import { profileCapabilities } from "@/lib/leads";
import { toggleWebphone } from "@/lib/ringover-webphone";
import { logout } from "@/app/(auth)/actions";
import type { CurrentUserProfile } from "@/lib/users-server";
import styles from "./Topbar.module.scss";

type Props = { user: CurrentUserProfile | null; unreadCount: number };

// ── Period + activity chips are display-only for now — global filters
// would need a context provider threading them into every page's data
// fetch, which isn't built. Bell is a placeholder until we have a
// notifications system. Search + Vue + user menu are real.

export default function Topbar({ user, unreadCount }: Props) {
  const shortcutLabel = useClientValue(
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    "⌘K",
  );

  const [openMenu, setOpenMenu] = useState<"user" | "vue" | null>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const vueRef = useRef<HTMLDivElement>(null);

  // One click-outside / Escape handler covers both dropdowns. We close
  // whichever is open if the pointer lands outside the matching anchor.
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (e: PointerEvent) => {
      const node = e.target as Node;
      if (openMenu === "user" && !userRef.current?.contains(node)) setOpenMenu(null);
      if (openMenu === "vue" && !vueRef.current?.contains(node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const openPalette = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
    }
  };

  // Vue label — prefer the first role's label (CDC §3 says effective
  // permissions are the union of held roles, so this is just a hint at the
  // "primary" identity). Falls back to "Utilisateur" if no roles are mapped.
  const primaryRoleLabel =
    user?.roles[0]?.label ?? (user ? "Utilisateur" : "Invité");

  // Le bouton webphone n'apparaît que pour les profils qui téléphonent.
  const isAdmin = (user?.roles ?? []).some((r) => r.slug === "admin");
  const { canUseRingover } = profileCapabilities(user?.commercialProfiles ?? [], isAdmin);

  return (
    <header className={styles.topbar} role="banner" data-no-print="true">
      <button
        type="button"
        className={styles.search}
        aria-label="Rechercher"
        onClick={openPalette}
      >
        <Icon name="search" size={16} />
        <span className={styles.searchPlaceholder}>
          Rechercher un lead, un client, une page…
        </span>
        <kbd className={styles.kbd}>{shortcutLabel}</kbd>
      </button>

      <div className={styles.filters}>
        <button
          type="button"
          className={styles.filterChip}
          aria-haspopup="listbox"
          title="Filtre global (à venir)"
          disabled
        >
          <span className={styles.filterLabel}>Période</span>
          <span className={styles.filterValue}>30 derniers jours</span>
          <Icon name="chevron-down" size={14} />
        </button>
        <button
          type="button"
          className={styles.filterChip}
          aria-haspopup="listbox"
          title="Filtre global (à venir)"
          disabled
        >
          <span className={styles.filterLabel}>Activité</span>
          <span className={styles.filterValue}>Toutes</span>
          <Icon name="chevron-down" size={14} />
        </button>
      </div>

      <div className={styles.right}>
        {canUseRingover && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleWebphone}
            aria-label="Afficher / masquer le téléphone Ringover"
            title="Afficher / masquer le téléphone Ringover"
          >
            <Icon name="phone" size={18} />
          </button>
        )}
        <Link
          href="/notifications"
          className={styles.iconBtn}
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} non lues)`
              : "Notifications"
          }
          title={unreadCount > 0 ? `${unreadCount} non lues` : "Notifications"}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* ── Vue selector ─────────────────────────────────────────── */}
        <div ref={vueRef} className={styles.menuAnchor}>
          <button
            type="button"
            className={styles.viewSwitcher}
            aria-haspopup="menu"
            aria-expanded={openMenu === "vue"}
            onClick={() => setOpenMenu((m) => (m === "vue" ? null : "vue"))}
          >
            <span className={styles.viewLabel}>Vue ·</span>
            <span className={styles.viewRole}>{primaryRoleLabel}</span>
            <Icon name="chevron-down" size={14} />
          </button>
          {openMenu === "vue" && (
            <div className={styles.dropdown} role="menu">
              <div className={styles.dropdownLabel}>Mes rôles</div>
              {user && user.roles.length > 0 ? (
                user.roles.map((r) => (
                  <div key={r.slug} className={styles.dropdownItem}>
                    <Icon name="check" size={14} /> {r.label}
                  </div>
                ))
              ) : (
                <div className={styles.dropdownEmpty}>
                  Aucun rôle attribué. Demandez à un admin de vous en assigner un dans Paramètres.
                </div>
              )}
              <div className={styles.dropdownHint}>
                L&apos;aperçu en lecture seule des autres rôles arrivera plus tard
                (CDC §3.6).
              </div>
            </div>
          )}
        </div>

        {/* ── User menu ────────────────────────────────────────────── */}
        <div ref={userRef} className={styles.menuAnchor}>
          <button
            type="button"
            className={styles.userMenu}
            aria-haspopup="menu"
            aria-expanded={openMenu === "user"}
            aria-label="Menu utilisateur"
            onClick={() => setOpenMenu((m) => (m === "user" ? null : "user"))}
          >
            <span
              className={styles.avatar}
              style={user?.color ? { background: user.color } : undefined}
              aria-hidden="true"
            >
              {user?.initials ?? "?"}
            </span>
          </button>
          {openMenu === "user" && (
            <div className={`${styles.dropdown} ${styles.dropdownRight}`} role="menu">
              {user ? (
                <>
                  <div className={styles.userHeader}>
                    <span
                      className={styles.userHeaderAvatar}
                      style={user.color ? { background: user.color } : undefined}
                      aria-hidden="true"
                    >
                      {user.initials}
                    </span>
                    <div className={styles.userHeaderText}>
                      <div className={styles.userHeaderName}>{user.displayName}</div>
                      <div className={styles.userHeaderEmail}>{user.email}</div>
                    </div>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link
                    href="/settings"
                    role="menuitem"
                    className={styles.dropdownItem}
                    onClick={() => setOpenMenu(null)}
                  >
                    <Icon name="settings" size={14} /> Paramètres
                  </Link>
                  <div className={styles.dropdownDivider} />
                  <form action={logout}>
                    <button
                      type="submit"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                    >
                      <Icon name="logout" size={14} /> Se déconnecter
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" role="menuitem" className={styles.dropdownItem}>
                  Se connecter
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
