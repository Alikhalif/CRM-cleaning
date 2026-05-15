"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon/Icon";
import { NAV_GROUPS } from "@/lib/nav";
import { DOC_TYPE_LABEL, type DocumentType } from "@/lib/leads";
import {
  MOCK_CLIENTS,
  MOCK_DOCUMENTS,
  MOCK_LEADS,
} from "@/lib/leads-mock";
import { setStoredValue, useClientValue, useStoredValue } from "@/lib/client-store";
import styles from "./CommandPalette.module.scss";

// Event name used to open the palette from elsewhere (Topbar search button,
// keyboard shortcut). Decoupled via a DOM CustomEvent so no shared state is
// needed across the React tree.
export const OPEN_PALETTE_EVENT = "cgk:open-palette";

type PaletteResult = {
  id: string;
  group: "page" | "lead" | "client" | "document" | "action";
  label: string;
  sublabel?: string;
  icon?: IconName;
  href?: string;
  onSelect?: () => void;
};

const GROUP_ORDER: PaletteResult["group"][] = [
  "page",
  "action",
  "lead",
  "client",
  "document",
];

const GROUP_LABEL: Record<PaletteResult["group"], string> = {
  page: "Pages",
  action: "Actions rapides",
  lead: "Leads",
  client: "Clients",
  document: "Documents",
};

const DOC_TYPE_TO_PATH: Record<DocumentType, "devis" | "factures"> = {
  devis: "devis",
  acompte: "factures",
  finale: "factures",
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Centralised open/close so the reset logic stays out of effects (React 19's
  // set-state-in-effect rule).
  const openPalette = () => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  };
  const closePalette = () => setOpen(false);
  const togglePalette = () => (open ? closePalette() : openPalette());

  // Mac vs. PC shortcut. Only resolved on the client to keep SSR stable.
  const isMac = useClientValue(
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform),
    false,
  );

  // The theme toggle action needs to read/write the same key the Sidebar uses.
  const theme = useStoredValue("cgk-theme", "light") === "dark" ? "dark" : "light";

  // ── Open/close wiring (keyboard shortcut + cross-tree event) ─────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        togglePalette();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        closePalette();
      }
    };
    const onOpenEvent = () => openPalette();
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
    // togglePalette/openPalette/closePalette close over state but are stable
    // for the lifetime of this render — refresh handlers each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the input each time the palette opens — pure DOM side-effect, no
  // setState, so the lint rule is happy.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // ── Build the index (re-derives when MOCK data changes; cheap with 16 leads) ──
  const allResults: PaletteResult[] = useMemo(() => {
    const results: PaletteResult[] = [];

    // Pages
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        results.push({
          id: `page-${item.href}`,
          group: "page",
          label: item.label,
          sublabel: item.href,
          icon: item.icon,
          href: item.href,
        });
      }
    }
    results.push(
      {
        id: "page-clients",
        group: "page",
        label: "Clients",
        sublabel: "/clients",
        icon: "commerciaux",
        href: "/clients",
      },
      {
        id: "page-devis-new",
        group: "page",
        label: "Nouveau devis",
        sublabel: "/devis/new",
        icon: "leads",
        href: "/devis/new",
      },
    );

    // Quick actions
    results.push(
      {
        id: "action-new-client",
        group: "action",
        label: "Créer un client",
        sublabel: "/clients/new",
        icon: "check",
        href: "/clients/new",
      },
      {
        id: "action-toggle-theme",
        group: "action",
        label: theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre",
        sublabel: theme === "dark" ? "Light" : "Dark",
        icon: theme === "dark" ? "sun" : "moon",
        onSelect: () => {
          const next = theme === "dark" ? "light" : "dark";
          document.documentElement.setAttribute("data-theme", next);
          setStoredValue("cgk-theme", next);
        },
      },
    );

    // Leads
    for (const lead of MOCK_LEADS) {
      results.push({
        id: `lead-${lead.id}`,
        group: "lead",
        label: lead.client,
        sublabel: `${lead.shortId} · ${lead.city} · ${lead.email}`,
        icon: "leads",
        href: `/leads/${lead.id}`,
      });
    }

    // Clients
    for (const client of MOCK_CLIENTS) {
      results.push({
        id: `client-${client.id}`,
        group: "client",
        label: client.name,
        sublabel: `${client.city} · ${client.email}`,
        icon: "commerciaux",
        href: `/clients/${client.id}`,
      });
    }

    // Documents
    for (const doc of MOCK_DOCUMENTS) {
      const lead = MOCK_LEADS.find((l) => l.id === doc.leadId);
      results.push({
        id: `doc-${doc.id}`,
        group: "document",
        label: doc.num,
        sublabel: `${DOC_TYPE_LABEL[doc.type]}${lead ? " · " + lead.client : ""}`,
        icon: "comptabilite",
        href: `/${DOC_TYPE_TO_PATH[doc.type]}/${doc.id}`,
      });
    }

    return results;
  }, [theme]);

  // ── Filter + group ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // No query — show top-of-list across each group (limited).
      const byGroup = new Map<PaletteResult["group"], PaletteResult[]>();
      for (const r of allResults) {
        const arr = byGroup.get(r.group) ?? [];
        if (arr.length < (r.group === "page" || r.group === "action" ? 10 : 4)) arr.push(r);
        byGroup.set(r.group, arr);
      }
      const flat: PaletteResult[] = [];
      for (const g of GROUP_ORDER) flat.push(...(byGroup.get(g) ?? []));
      return flat;
    }
    return allResults
      .filter((r) => {
        const hay = `${r.label} ${r.sublabel ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [allResults, query]);

  // Clamp during render — keeps `rawActiveIndex` as the raw state but the
  // consumed `activeIndex` is always in range, even after a fresh filter
  // shortens the result list.
  const activeIndex = Math.min(rawActiveIndex, Math.max(0, filtered.length - 1));

  // ── Selection ────────────────────────────────────────────────────────
  const select = (r: PaletteResult) => {
    setOpen(false);
    if (r.onSelect) r.onSelect();
    if (r.href) router.push(r.href);
  };

  // ── Keyboard nav inside the palette ──────────────────────────────────
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const r = filtered[activeIndex];
      if (r) select(r);
    }
  };

  // Scroll active item into view as the index changes.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  // ── Render ───────────────────────────────────────────────────────────
  // Render groups in the order GROUP_ORDER but only include groups with results.
  const grouped = new Map<PaletteResult["group"], { result: PaletteResult; index: number }[]>();
  filtered.forEach((r, index) => {
    const bucket = grouped.get(r.group) ?? [];
    bucket.push({ result: r, index });
    grouped.set(r.group, bucket);
  });

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div className={styles.palette}>
        <div className={styles.searchRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher une page, un lead, un client, un document…"
            className={styles.input}
            aria-label="Rechercher"
            aria-controls="palette-results"
            aria-activedescendant={
              filtered[activeIndex] ? `palette-item-${filtered[activeIndex].id}` : undefined
            }
          />
          <kbd className={styles.kbd}>esc</kbd>
        </div>

        <ul ref={listRef} id="palette-results" className={styles.results} role="listbox">
          {filtered.length === 0 && (
            <li className={styles.empty}>Aucun résultat pour « {query} »</li>
          )}
          {GROUP_ORDER.map((g) => {
            const items = grouped.get(g);
            if (!items || items.length === 0) return null;
            return (
              <li key={g} className={styles.group}>
                <p className={styles.groupLabel}>{GROUP_LABEL[g]}</p>
                <ul className={styles.groupList}>
                  {items.map(({ result, index }) => (
                    <li
                      key={result.id}
                      id={`palette-item-${result.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={activeIndex === index}
                      className={`${styles.row} ${activeIndex === index ? styles.rowActive : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(result)}
                    >
                      {result.icon && (
                        <span className={styles.rowIcon} aria-hidden="true">
                          <Icon name={result.icon} size={16} />
                        </span>
                      )}
                      <span className={styles.rowLabel}>{result.label}</span>
                      {result.sublabel && (
                        <span className={styles.rowSub}>{result.sublabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <footer className={styles.footer}>
          <span>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd> naviguer
          </span>
          <span>
            <kbd className={styles.kbd}>↵</kbd> ouvrir
          </span>
          <span className={styles.footerShortcut}>
            <kbd className={styles.kbd}>{isMac ? "⌘" : "Ctrl"}</kbd>
            <kbd className={styles.kbd}>K</kbd> pour rouvrir
          </span>
        </footer>
      </div>
    </div>
  );
}
