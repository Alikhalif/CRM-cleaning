"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon/Icon";
import { OPEN_PALETTE_EVENT } from "../CommandPalette/CommandPalette";
import { TOGGLE_MOBILE_NAV } from "../MobileTabBar/MobileTabBar";
import { useClientValue, useStoredValue, setStoredValue } from "@/lib/client-store";
import {
  ACTIVE_ROLE_KEY,
  PREVIEW_ROLE_KEY,
  PREVIEWABLE_ROLES,
  previewRoleLabel,
  roleHome,
} from "@/lib/role-preview";
import { profileCapabilities, SECTOR_LABEL, SECTORS, visibleSectorsForUser, type Sector } from "@/lib/leads";
import { DASHBOARD_PERIODS, parsePeriod } from "@/lib/dashboard";
import { toggleWebphone } from "@/lib/ringover-webphone";
import { logout } from "@/app/(auth)/actions";
import type { CurrentUserProfile } from "@/lib/users-server";
import styles from "./Topbar.module.scss";

type Props = { user: CurrentUserProfile | null; unreadCount: number };

// ── Filtres globaux Période + Activité : pilotent le Dashboard via l'URL
// (?period=… & sector=…). La source de vérité est l'URL — le Dashboard lit
// ces mêmes paramètres. Search + Vue + user menu sont réels.

export default function Topbar({ user, unreadCount }: Props) {
  const shortcutLabel = useClientValue(
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    "⌘K",
  );

  // Filtres globaux ← / → URL.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get("period"));
  const sectorRaw = searchParams.get("sector") ?? "all";
  const sector = sectorRaw === "all" || sectorRaw in SECTOR_LABEL ? sectorRaw : "all";
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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

  // Le bouton webphone apparaît pour les profils qui téléphonent + la planificatrice.
  const isAdmin = (user?.roles ?? []).some((r) => r.slug === "admin");
  const isPlanificateur = (user?.roles ?? []).some((r) => r.slug === "planification");

  // ── Sélecteur « Vue » (A15) ────────────────────────────────────────────
  // activeRole = rôle actif choisi parmi les rôles détenus (étiquette + accueil,
  // n'altère PAS les permissions) ; previewRole = aperçu lecture seule (admin).
  // Valeurs "" au 1er rendu (SSR) → l'étiquette part de primaryRoleLabel, pas
  // de décalage d'hydratation.
  const previewRole = useStoredValue(PREVIEW_ROLE_KEY, "");
  const activeRole = useStoredValue(ACTIVE_ROLE_KEY, "");
  const heldSlugs = (user?.roles ?? []).map((r) => r.slug);
  // Un admin peut prévisualiser les espaces « métier » qu'il ne détient pas.
  const previewable = isAdmin
    ? PREVIEWABLE_ROLES.filter((r) => !heldSlugs.includes(r.slug))
    : [];
  const activeHeldLabel =
    user?.roles.find((r) => r.slug === activeRole)?.label ?? primaryRoleLabel;
  const vueLabel = previewRole ? `Aperçu · ${previewRoleLabel(previewRole)}` : activeHeldLabel;

  const selectHeldRole = (slug: string) => {
    setStoredValue(ACTIVE_ROLE_KEY, slug);
    setStoredValue(PREVIEW_ROLE_KEY, "");
    setOpenMenu(null);
    router.push(roleHome(slug));
  };
  const selectPreviewRole = (slug: string) => {
    setStoredValue(PREVIEW_ROLE_KEY, slug);
    setOpenMenu(null);
    router.push(roleHome(slug));
  };
  // Restriction commerciale par activité : secteurs que le user a le droit de voir.
  const visibleSectors = visibleSectorsForUser({ isAdmin, isPlanner: isPlanificateur, activities: user?.activities ?? [] });
  const activityRestricted = visibleSectors.length < SECTORS.length;
  const { canUseRingover } = profileCapabilities(user?.commercialProfiles ?? [], isAdmin, isPlanificateur);

  return (
    <header className={styles.topbar} role="banner" data-no-print="true">
      {/* Bouton menu — mobile uniquement (≤768px, cf. SCSS) : ouvre le tiroir. */}
      <button
        type="button"
        className={styles.burger}
        aria-label="Ouvrir le menu"
        onClick={() => window.dispatchEvent(new Event(TOGGLE_MOBILE_NAV))}
      >
        <Icon name="panel-left" size={20} />
      </button>
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
        <label className={styles.filterChip} title="Période analysée (Dashboard)">
          <span className={styles.filterLabel}>Période</span>
          <span className={styles.filterValue}>
            {DASHBOARD_PERIODS.find((p) => p.value === period)?.label ?? "30 derniers jours"}
          </span>
          <Icon name="chevron-down" size={14} />
          <select
            className={styles.filterSelectOverlay}
            value={period}
            onChange={(e) => setParam("period", e.target.value)}
            aria-label="Filtre global — période"
          >
            {DASHBOARD_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        {!activityRestricted && (
          <label className={styles.filterChip} title="Activité analysée (Dashboard)">
            <span className={styles.filterLabel}>Activité</span>
            <span className={styles.filterValue}>
              {sector === "all" ? "Toutes" : SECTOR_LABEL[sector as Sector]}
            </span>
            <Icon name="chevron-down" size={14} />
            <select
              className={styles.filterSelectOverlay}
              value={sector}
              onChange={(e) => setParam("sector", e.target.value)}
              aria-label="Filtre global — activité"
            >
              <option value="all">Toutes</option>
              {visibleSectors.map((s) => (
                <option key={s} value={s}>{SECTOR_LABEL[s]}</option>
              ))}
            </select>
          </label>
        )}
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
        <div ref={vueRef} className={`${styles.menuAnchor} ${styles.vueAnchor}`}>
          <button
            type="button"
            className={styles.viewSwitcher}
            aria-haspopup="menu"
            aria-expanded={openMenu === "vue"}
            onClick={() => setOpenMenu((m) => (m === "vue" ? null : "vue"))}
          >
            <span className={styles.viewLabel}>Vue ·</span>
            <span className={styles.viewRole}>{vueLabel}</span>
            <Icon name="chevron-down" size={14} />
          </button>
          {openMenu === "vue" && (
            <div className={styles.dropdown} role="menu">
              <div className={styles.dropdownLabel}>Mes rôles</div>
              {user && user.roles.length > 0 ? (
                user.roles.map((r) => {
                  const isActive = !previewRole && r.slug === (activeRole || user.roles[0].slug);
                  return (
                    <button
                      key={r.slug}
                      type="button"
                      role="menuitem"
                      className={styles.dropdownItem}
                      onClick={() => selectHeldRole(r.slug)}
                    >
                      <Icon name="check" size={14} />
                      <span>{r.label}</span>
                      {isActive && <span className={styles.roleTag}>actif</span>}
                    </button>
                  );
                })
              ) : (
                <div className={styles.dropdownEmpty}>
                  Aucun rôle attribué. Demandez à un admin de vous en assigner un dans Paramètres.
                </div>
              )}

              {previewable.length > 0 && (
                <>
                  <div className={styles.dropdownDivider} />
                  <div className={styles.dropdownLabel}>Aperçu (lecture seule)</div>
                  {previewable.map((r) => (
                    <button
                      key={r.slug}
                      type="button"
                      role="menuitem"
                      className={styles.dropdownItem}
                      onClick={() => selectPreviewRole(r.slug)}
                    >
                      <Icon name="external-link" size={14} />
                      <span>{r.label}</span>
                      {previewRole === r.slug && <span className={styles.roleTag}>en cours</span>}
                    </button>
                  ))}
                </>
              )}
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
