"""Controle chaque chaine `.select()` PostgREST contre le schema reel.

    python scripts/check-selects/check-selects.py .

Sortie 0 si tout va bien, 1 si une colonne nommee n'existe pas.

── POURQUOI CE CONTROLE EXISTE ──────────────────────────────────────

Un nom de colonne faux dans `.select("...")` n'est qu'une chaine de
caracteres pour TypeScript. `tsc` ne la lit pas, ESLint ne la lit pas,
`npm run build` ne la lit pas : aucun ne regarde l'interieur d'un
litteral. Le seul a s'en apercevoir est PostgREST, a l'execution, par un
HTTP 400.

Le 2026-11-05, `lib/sous-traitance/contrats-server.ts` demandait
`activity:activities(slug, name)` alors que la colonne s'appelle `label`.
Consequence : les ONZE fiches dossier de `/planification/<id>` affichaient
« 404 This page could not be found » pendant que le serveur journalisait
« GET /planification/<id> 200 ». Le build passait. Le lint passait. La
fonctionnalite avait ete declaree livree.

Ce script est donc le seul filet possible pour cette classe de bug. Il lit
le schema dans `lib/supabase/database.types.ts` (regenere par
`npx supabase gen types typescript --linked`), parcourt les sources et
signale toute colonne absente.

ATTENTION : il ne vaut que si le fichier de types est a jour. Apres une
migration, regenerer les types AVANT de lancer ce controle.

Les `.select()` construits par interpolation (`${...}`) ou par une fonction
ne sont pas verifiables statiquement : ils sont listes a part, pour revue
manuelle, jamais declares conformes en silence.
"""
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
TYPES = os.path.join(ROOT, "lib", "supabase", "database.types.ts")

# ---------------------------------------------------------------- schema

def read_block(src, start):
    """Return (body, end_index) for the {...} block starting at src[start] == '{'."""
    depth = 0
    i = start
    while i < len(src):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return src[start + 1 : i], i + 1
        i += 1
    raise ValueError("unbalanced braces")


def parse_schema(path):
    whole = open(path, encoding="utf-8").read()
    # IMPORTANT: database.types.ts declares several schemas, and
    # `graphql_public` comes FIRST with empty `Tables: { [_ in never]: never }`.
    # Searching the whole file finds that empty one and yields 0 tables -- a
    # validator that checks nothing. Scope to the `public` schema.
    pm = re.search(r"\n  public: \{", whole)
    if not pm:
        raise ValueError("schema `public` introuvable dans database.types.ts")
    src, _ = read_block(whole, whole.index("{", pm.start()))
    schema = {}
    for section in ("Tables", "Views"):
        m = re.search(r"\n    %s: \{" % section, src)
        if not m:
            continue
        body, _ = read_block(src, src.index("{", m.start()))
        # each entry:   <name>: { ... }
        for em in re.finditer(r"\n      ([A-Za-z_][A-Za-z0-9_]*): \{", body):
            name = em.group(1)
            entry, _ = read_block(body, body.index("{", em.start()))
            rm = re.search(r"\n        Row: \{", entry)
            if not rm:
                continue
            row, _ = read_block(entry, entry.index("{", rm.start()))
            cols = set(
                re.findall(r"\n          ([A-Za-z_][A-Za-z0-9_]*)\??:", row)
            )
            if cols:
                schema.setdefault(name, set()).update(cols)
    return schema


# ---------------------------------------------------- select-string parsing

def split_top(s):
    """Split on commas that are not inside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return [x.strip() for x in out if x.strip()]


# Things that are not plain columns and must not be flagged.
SKIP = {"*", "count"}


def check_select(sel, table, schema, problems, unknown_tables, where):
    """Walk a PostgREST select spec; append findings to the given lists."""
    for item in split_top(sel):
        it = item.strip()
        if not it or it in SKIP:
            continue
        # spread embed: ...table(cols)
        if it.startswith("..."):
            it = it[3:].strip()
        # alias:rest  (alias never contains a paren)
        alias_split = None
        d = 0
        for i, ch in enumerate(it):
            if ch == "(":
                d += 1
            elif ch == ")":
                d -= 1
            elif ch == ":" and d == 0 and it[i : i + 2] != "::":
                alias_split = i
                break
        if alias_split is not None:
            it = it[alias_split + 1 :].strip()
        if not it or it in SKIP:
            continue
        if "(" in it:
            # embedded resource: table[!hint](subselect)
            head = it[: it.index("(")].strip()
            sub, _ = it[it.index("(") :], None
            sub = sub[1 : sub.rindex(")")]
            tbl = head.split("!")[0].strip()
            # aggregates look like col.sum() -- not an embed
            if tbl.endswith(".sum") or tbl.endswith(".avg") or tbl.endswith(".count") \
               or tbl.endswith(".max") or tbl.endswith(".min"):
                col = tbl.rsplit(".", 1)[0]
                if table in schema and col not in schema[table] and col not in SKIP:
                    problems.append((where, table, col))
                continue
            if tbl not in schema:
                unknown_tables.append((where, tbl))
                continue
            check_select(sub, tbl, schema, problems, unknown_tables, where)
            continue
        # plain column: strip cast, json path, aggregate, ordering
        col = it.split("::")[0].split("->")[0].split(".")[0].strip()
        if not col or col in SKIP:
            continue
        if table in schema and col not in schema[table]:
            problems.append((where, table, col))


# ------------------------------------------------------------ source scan

STR_START = {'"': '"', "'": "'", "`": "`"}


def read_string_arg(src, i):
    """src[i] is just after '('. Return (string, end) or (None, end)."""
    while i < len(src) and src[i] in " \n\r\t":
        i += 1
    if i >= len(src) or src[i] not in STR_START:
        return None, i
    q = STR_START[src[i]]
    i += 1
    out = ""
    while i < len(src):
        if src[i] == "\\":
            out += src[i : i + 2]
            i += 2
            continue
        if src[i] == q:
            return out, i + 1
        out += src[i]
        i += 1
    return None, i


def scan_file(path, schema, problems, unknown_tables, indirect):
    src = open(path, encoding="utf-8", errors="replace").read()
    rel = os.path.relpath(path, ROOT).replace("\\", "/")
    # map: position -> table, from every .from("x")
    froms = [(m.start(), m.group(1)) for m in re.finditer(r"\.from\(\s*[\"'`]([A-Za-z_][A-Za-z0-9_]*)[\"'`]", src)]
    # string consts in the file, for .select(CONST)
    consts = {}
    for m in re.finditer(r"const\s+([A-Z_][A-Z0-9_]*)\s*(?::\s*string\s*)?=\s*", src):
        j = m.end()
        if j < len(src) and src[j] in STR_START:
            val, _ = read_string_arg(src, j)
            if val is not None:
                consts[m.group(1)] = val

    for m in re.finditer(r"\.select\(", src):
        pos = m.start()
        # Ignorer les `.select()` ecrits DANS un commentaire : ce fichier en
        # contient (ils documentent precisement le bug du 2026-11-05) et ils
        # polluaient la liste des cas non verifiables.
        bol = src.rfind("\n", 0, pos) + 1
        amont = src[bol:pos].lstrip()
        if amont.startswith("//") or amont.startswith("*") or amont.startswith("/*"):
            continue
        tbl = None
        for fp, ft in froms:
            if fp < pos:
                tbl = ft
            else:
                break
        line = src.count("\n", 0, pos) + 1
        where = "%s:%d" % (rel, line)
        arg, _ = read_string_arg(src, m.end())
        if arg is None:
            # maybe .select(CONST)
            tail = src[m.end() : m.end() + 60]
            cm = re.match(r"\s*([A-Z_][A-Z0-9_]*)", tail)
            if cm and cm.group(1) in consts:
                arg = consts[cm.group(1)]
            else:
                if tbl:
                    indirect.append((where, tbl))
                continue
        if tbl is None:
            indirect.append((where, "?"))
            continue
        # drop template placeholders -- cannot be checked
        if "${" in arg:
            indirect.append((where, tbl))
            continue
        check_select(arg, tbl, schema, problems, unknown_tables, where)


def autotest(schema):
    """Le controle doit prouver qu'il sait echouer.

    Premiere version de ce script : le parseur de schema tombait sur le bloc
    `graphql_public` (vide) avant `public`, chargeait 0 table, et annoncait
    « Aucune colonne inexistante » sur un fichier qui contenait le bug. Un
    controle vide est pire que pas de controle : il rassure a tort.
    """
    if len(schema) < 20:
        print("AUTO-TEST ECHOUE : %d tables chargees, c'est anormalement peu." % len(schema))
        print("  Le schema n'a pas ete lu correctement : ce controle ne verifie rien.")
        return False
    if "activities" not in schema or "label" not in schema.get("activities", ()):
        print("AUTO-TEST ECHOUE : `activities.label` introuvable dans le schema lu.")
        return False
    # Le bug reel du 2026-11-05 doit etre detecte.
    p, u = [], []
    check_select("slug, name", "activities", schema, p, u, "autotest")
    if not p:
        print("AUTO-TEST ECHOUE : `activities(slug, name)` n'est pas signale.")
        return False
    # Et une colonne valide ne doit pas l'etre.
    p2 = []
    check_select("slug, label", "activities", schema, p2, [], "autotest")
    if p2:
        print("AUTO-TEST ECHOUE : `activities(slug, label)` est signale a tort : %s" % p2)
        return False
    print("Auto-test : ok (sait detecter activities.name, laisse passer activities.label)")
    return True


def main():
    schema = parse_schema(TYPES)
    print("Schema charge : %d tables/vues" % len(schema))
    if not autotest(schema):
        return 2
    print()

    problems, unknown_tables, indirect = [], [], []
    skip_dirs = {"node_modules", ".next", ".git", "lagny-sur-marne", "scratchpad"}
    nfiles = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if fn.endswith((".ts", ".tsx")) and fn != "database.types.ts":
                nfiles += 1
                scan_file(os.path.join(dirpath, fn), schema, problems, unknown_tables, indirect)

    print("Fichiers scannes : %d" % nfiles)
    print()
    if problems:
        print("COLONNES INEXISTANTES (%d) :" % len(problems))
        for where, tbl, col in problems:
            print("  %-60s %s.%s" % (where, tbl, col))
    else:
        print("Aucune colonne inexistante.")
    print()
    if unknown_tables:
        print("Tables inconnues du schema (%d) :" % len(unknown_tables))
        for where, tbl in sorted(set(unknown_tables)):
            print("  %-60s %s" % (where, tbl))
        print()
    print("Selects non verifiables (interpolation / const externe) : %d" % len(indirect))
    for where, tbl in indirect[:25]:
        print("  %-60s table=%s" % (where, tbl))
    if len(indirect) > 25:
        print("  ... et %d autres" % (len(indirect) - 25))

    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
