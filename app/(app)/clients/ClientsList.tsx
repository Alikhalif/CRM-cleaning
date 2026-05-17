"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  CLIENT_ORIGIN_LABEL,
  CLIENT_TYPE_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  formatEUR,
  type Client,
  type ClientOrigin,
  type ClientType,
  type Sector,
} from "@/lib/leads";
import styles from "./Clients.module.scss";

type Row = {
  client: Client;
  caEncaisse: number;
  lastActivityAt: string;
};

type Props = { rows: Row[] };

export default function ClientsList({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ClientType | "all">("all");
  const [origin, setOrigin] = useState<ClientOrigin | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(({ client: c }) => {
        if (type !== "all" && c.type !== type) return false;
        if (origin !== "all" && c.origin !== origin) return false;
        if (q) {
          const hay = `${c.name} ${c.contactName ?? ""} ${c.email} ${c.phone} ${c.city}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt));
  }, [rows, search, type, origin]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Filtres clients">
        <div className={styles.searchBox}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, contact, ville…"
            className={styles.searchInput}
            aria-label="Rechercher"
          />
        </div>

        <select
          value={type}
          onChange={(e) => setType(e.target.value as ClientType | "all")}
          className={styles.select}
          aria-label="Filtrer par type"
        >
          <option value="all">Tous les types</option>
          <option value="pro">Professionnels</option>
          <option value="particulier">Particuliers</option>
        </select>

        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value as ClientOrigin | "all")}
          className={styles.select}
          aria-label="Filtrer par origine"
        >
          <option value="all">Toutes les origines</option>
          <option value="lead">Issus d&apos;un lead</option>
          <option value="direct">Clients directs</option>
        </select>

        <Link href="/clients/new" className={styles.newBtn}>
          <Icon name="check" size={14} /> Nouveau client
        </Link>
      </div>

      <p className={styles.count}>
        {filtered.length} client{filtered.length > 1 ? "s" : ""}
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Origine</th>
              <th className={styles.colWide}>Email</th>
              <th>Téléphone</th>
              <th>Ville</th>
              <th>Secteurs</th>
              <th className={styles.tNum}>CA encaissé</th>
              <th>Dernière activité</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ client, caEncaisse, lastActivityAt }) => (
              <tr key={client.id}>
                <td>
                  <Link href={`/clients/${client.id}`} className={styles.nameLink}>
                    {client.name}
                  </Link>
                  {client.contactName && client.type === "pro" && (
                    <div className={styles.muted}>{client.contactName}</div>
                  )}
                </td>
                <td>
                  <span
                    className={styles.typePill}
                    data-type={client.type}
                  >
                    {CLIENT_TYPE_LABEL[client.type]}
                  </span>
                </td>
                <td>
                  <span
                    className={styles.originPill}
                    data-origin={client.origin}
                  >
                    {CLIENT_ORIGIN_LABEL[client.origin]}
                  </span>
                </td>
                <td className={styles.colWide}>{client.email}</td>
                <td className={styles.mono}>{client.phone}</td>
                <td>{client.city}</td>
                <td>
                  <div className={styles.sectors}>
                    {client.sectors.map((s) => (
                      <SectorChip key={s} sector={s} />
                    ))}
                  </div>
                </td>
                <td className={styles.tNum}>
                  {caEncaisse > 0 ? formatEUR(caEncaisse) : <span className={styles.muted}>—</span>}
                </td>
                <td>
                  <RelativeTime iso={lastActivityAt} className={styles.muted} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  Aucun client ne correspond aux filtres actuels.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectorChip({ sector }: { sector: Sector }) {
  return (
    <span
      className={styles.sectorChip}
      style={{ ["--sc" as string]: `var(${SECTOR_VAR[sector]})` }}
    >
      {SECTOR_LABEL[sector]}
    </span>
  );
}
