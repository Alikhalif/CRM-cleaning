// D32 — lecteur du schéma EFFECTIF, rejoué depuis les migrations, dans l'ordre.
//
// Pourquoi un lecteur et pas des recherches : trois erreurs de détection
// (D20, l'index de facture finale, les politiques de `documents`) venaient de
// motifs d'une ligne appliqués à du SQL multiligne ou dynamique. Celui-ci
// travaille sur des INSTRUCTIONS complètes (découpées aux `;` hors chaînes et
// hors corps `$$`), et rejoue création, suppression et remplacement.
//
// Il ne lit que des fichiers. Ni réseau, ni base.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Politique = { table: string; nom: string; commande: string; roles: string; texte: string; fichier: string };
export type Vue = { nom: string; securityInvoker: boolean; fichier: string; texte: string };
export type Fonction = { nom: string; signature: string; securityDefiner: boolean; executablePar: Set<string>; fichier: string; texte: string };
export type Schema = {
  fichiers: string[];
  rls: Set<string>;
  politiques: Map<string, Politique>;     // clé table|nom
  colonnes: Map<string, Set<string>>;     // table → colonnes
  vues: Map<string, Vue>;
  fonctions: Map<string, Fonction>;       // clé nom(signature)
};

/** Découpe en instructions, sans couper dans une chaîne ni dans un corps $tag$…$tag$. */
export function instructions(sql: string): string[] {
  const out: string[] = [];
  let i = 0, debut = 0, dollar: string | null = null, quote = false;
  while (i < sql.length) {
    const c = sql[i];
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length; dollar = null; continue; }
      i++; continue;
    }
    if (quote) { if (c === "'") { if (sql[i + 1] === "'") { i += 2; continue; } quote = false; } i++; continue; }
    if (c === "-" && sql[i + 1] === "-") { const n = sql.indexOf("\n", i); i = n < 0 ? sql.length : n; continue; }
    if (c === "'") { quote = true; i++; continue; }
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { dollar = m[0]; i += m[0].length; continue; }
    }
    if (c === ";") { out.push(sql.slice(debut, i).trim()); debut = i + 1; }
    i++;
  }
  const reste = sql.slice(debut).trim();
  if (reste) out.push(reste);
  return out.filter(Boolean);
}

const sansCommentaires = (s: string) => s.replace(/--[^\n]*/g, "");
const ID = String.raw`(?:public\.)?"?([a-z_][a-z0-9_]*)"?`;
const NOM = String.raw`("[^"]+"|[a-z_][a-z0-9_]*)`;

export function lireSchema(dossier = "supabase/migrations", avant?: string): Schema {
  // `avant` : rejouer le schéma tel qu'il était AVANT une migration donnée.
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql") && (!avant || f < avant)).sort();
  const s: Schema = { fichiers, rls: new Set(), politiques: new Map(), colonnes: new Map(), vues: new Map(), fonctions: new Map() };
  const col = (t: string) => { if (!s.colonnes.has(t)) s.colonnes.set(t, new Set()); return s.colonnes.get(t)!; };

  for (const f of fichiers) {
    for (const brut of instructions(readFileSync(join(dossier, f), "utf8"))) {
      const ins = sansCommentaires(brut).trim();
      const bas = ins.toLowerCase();
      let m: RegExpExecArray | null;

      if ((m = new RegExp(String.raw`^create\s+table\s+(?:if\s+not\s+exists\s+)?${ID}\s*\(([\s\S]*)\)\s*$`, "i").exec(ins))) {
        const t = m[1].toLowerCase();
        for (const ligne of m[2].split(/,(?![^(]*\))/)) {
          const c = /^\s*"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i.exec(ligne);
          if (c && !/^(constraint|primary|unique|foreign|check)$/i.test(c[1])) col(t).add(c[1].toLowerCase());
        }
        continue;
      }
      if ((m = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${ID}\s+([\s\S]*)$`, "i").exec(ins))) {
        const t = m[1].toLowerCase();
        if (/enable\s+row\s+level\s+security/i.test(m[2])) s.rls.add(t);
        for (const a of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) col(t).add(a[1].toLowerCase());
        continue;
      }
      if ((m = new RegExp(String.raw`^create\s+policy\s+${NOM}\s+on\s+${ID}([\s\S]*)$`, "i").exec(ins))) {
        const nom = m[1].replace(/"/g, ""), t = m[2].toLowerCase(), reste = m[3];
        const cmd = (/\bfor\s+(all|select|insert|update|delete)\b/i.exec(reste)?.[1] ?? "all").toLowerCase();
        const roles = (/\bto\s+([a-z_, ]+?)(?=\s+using|\s+with|\s*$)/i.exec(reste)?.[1] ?? "public").trim().toLowerCase();
        s.politiques.set(`${t}|${nom}`, { table: t, nom, commande: cmd, roles, texte: reste.trim(), fichier: f });
        continue;
      }
      if ((m = new RegExp(String.raw`^drop\s+policy\s+(?:if\s+exists\s+)?${NOM}\s+on\s+${ID}`, "i").exec(ins))) {
        s.politiques.delete(`${m[2].toLowerCase()}|${m[1].replace(/"/g, "")}`);
        continue;
      }
      if ((m = /^create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?([\s\S]*)$/i.exec(ins))) {
        s.vues.set(m[1].toLowerCase(), { nom: m[1].toLowerCase(), securityInvoker: /security_invoker\s*=\s*(true|on)/i.test(m[2]), fichier: f, texte: m[2] });
        continue;
      }
      if ((m = /^drop\s+view\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/i.exec(ins))) { s.vues.delete(m[1].toLowerCase()); continue; }
      if ((m = /^create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)([\s\S]*)$/i.exec(ins))) {
        const nom = m[1].toLowerCase();
        const sig = m[2].replace(/\s+default\s+[^,]+/gi, "").split(",").map((a) => a.trim().split(/\s+/).slice(-1)[0] ?? "").filter(Boolean).join(",").toLowerCase();
        const cle = `${nom}(${sig})`;
        const avant = s.fonctions.get(cle);
        s.fonctions.set(cle, {
          nom, signature: sig, fichier: f, texte: m[3],
          securityDefiner: /security\s+definer/i.test(m[3]),
          // Par défaut PostgreSQL accorde EXECUTE à PUBLIC.
          executablePar: avant?.executablePar ?? new Set(["public"]),
        });
        continue;
      }
      if ((m = /^alter\s+function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)\s+([\s\S]*)$/i.exec(ins))) {
        const nom = m[1].toLowerCase();
        for (const [cle, fn] of s.fonctions) if (fn.nom === nom && /security\s+definer/i.test(m[3])) { fn.securityDefiner = true; void cle; }
        continue;
      }
      if ((m = /^(revoke|grant)\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)\s+(?:from|to)\s+([a-z_, ]+)/i.exec(ins))) {
        const nom = m[2].toLowerCase();
        const roles = m[4].split(",").map((r) => r.trim().toLowerCase());
        for (const fn of s.fonctions.values()) {
          if (fn.nom !== nom) continue;
          for (const r of roles) {
            if (m[1].toLowerCase() === "grant") fn.executablePar.add(r);
            else fn.executablePar.delete(r);
          }
        }
        continue;
      }
      // Blocs DO — AVEC ou SANS boucle. La première version n'examinait que
      // les blocs à boucle : les politiques d'ÉCRITURE de `contracts`,
      // `client_documents`… — créées dans un `do $rls$ … if not exists … create
      // policy …` sans boucle — lui échappaient, et la réécriture D32 les
      // aurait laissées ouvertes. Trouvé en relisant l'inventaire de
      // `contracts` (lecture seule) contre ce qu'on savait de ses écritures.
      if (bas.startsWith("do")) {
        const boucle = /foreach\s+(\w+)\s+in\s+array\s+array\[([^\]]+)\]\s+loop([\s\S]*?)end\s+loop/i.exec(ins);
        if (boucle) {
          const tables = [...boucle[2].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
          // RLS activée EN BOUCLE (20260908000002) : forme que la première
          // version de ce lecteur ignorait — elle déclarait à tort neuf tables
          // de présence « sans RLS ». Rattrapé par une vérification croisée.
          if (/format\(\s*'alter\s+table\s+%i\s+enable\s+row\s+level\s+security'/i.test(boucle[3])) {
            for (const t of tables) s.rls.add(t);
          }
          for (const t of tables) {
            for (const c of boucle[3].matchAll(new RegExp(String.raw`format\(\s*'create\s+policy\s+%i\s+on\s+%i([^']*)'\s*,\s*${boucle[1]}\s*\|\|\s*'([a-z0-9_]+)'`, "gi"))) {
              const cmd = (/\bfor\s+(all|select|insert|update|delete)\b/i.exec(c[1])?.[1] ?? "all").toLowerCase();
              s.politiques.set(`${t}|${t}${c[2]}`, { table: t, nom: `${t}${c[2]}`, commande: cmd, roles: "authenticated", texte: c[1], fichier: f });
            }
          }
        }
        // Politiques littérales dans un bloc DO (if not exists … create policy …).
        for (const p of ins.matchAll(new RegExp(String.raw`create\s+policy\s+${NOM}\s+on\s+${ID}([\s\S]*?);`, "gi"))) {
          const nom = p[1].replace(/"/g, ""), t = p[2].toLowerCase();
          const cmd = (/\bfor\s+(all|select|insert|update|delete)\b/i.exec(p[3])?.[1] ?? "all").toLowerCase();
          s.politiques.set(`${t}|${nom}`, { table: t, nom, commande: cmd, roles: "authenticated", texte: p[3].trim(), fichier: f });
        }
        for (const p of ins.matchAll(new RegExp(String.raw`drop\s+policy\s+(?:if\s+exists\s+)?${NOM}\s+on\s+${ID}`, "gi"))) {
          s.politiques.delete(`${p[2].toLowerCase()}|${p[1].replace(/"/g, "")}`);
        }
        for (const p of ins.matchAll(new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?${ID}\s+enable\s+row\s+level\s+security`, "gi"))) s.rls.add(p[1].toLowerCase());
      }
    }
  }
  return s;
}

export const LIENS = ["country", "pays", "entity_id", "entite_id", "lead_id", "source_lead_id", "dossier_id", "client_id",
  "document_id", "contract_id", "technician_id", "mission_id", "devis_id", "related_devis_id"] as const;
