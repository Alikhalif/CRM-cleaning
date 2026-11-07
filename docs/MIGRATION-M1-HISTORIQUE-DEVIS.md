# M1 — Historique des versions d'un devis

**Statut : PROPOSITION. Rien n'est appliqué.**
**Date : 2026-11-06. Demande du client : « je veux recevoir le SQL exact avant
toute exécution ».**

> Ce fichier est dans `docs/`, **pas** dans `supabase/migrations/`, et c'est
> délibéré : un fichier posé dans le dossier des migrations serait appliqué au
> prochain `supabase db push` par quiconque lancerait la commande sans lire ce
> document. Le SQL ne deviendra une migration qu'après votre accord, et c'est
> à ce moment-là qu'il recevra un horodatage de nom de fichier.

---

## 1. Le manque que cette migration comble

La rédaction assistée du devis (§17) conserve un historique, mais **dans
l'éditeur, pas en base**. C'est écrit en tête de
[RedactionAssistee.tsx](../app/(app)/devis/new/RedactionAssistee.tsx) :

> ⚠️ LIMITE ASSUMÉE : cet historique vit dans l'éditeur, pas en base. Fermer
> l'onglet avant d'enregistrer perd les versions intermédiaires.

Concrètement, aujourd'hui :

- le bouton « Annuler » rétablit la version précédente **tant que l'onglet est
  ouvert** ;
- une fois « Enregistrer » cliqué, la version d'avant est perdue ;
- personne ne peut dire qui a réécrit quoi sur un devis, ni quand, ni
  comparer le texte envoyé au client avec celui que le moteur avait produit.

Ce dernier point est le plus coûteux. Quand un client contestera une
formulation, il faudra pouvoir montrer **le texte exact** qui lui a été
envoyé, et distinguer ce que le moteur a rédigé de ce qu'un commercial a
ajouté à la main.

## 2. Ce que la migration crée

**Une seule table.** Aucune colonne ajoutée, aucune colonne modifiée, aucune
donnée existante touchée.

```
document_versions
  id            uuid        PK
  document_id   uuid        → documents(id) on delete cascade
  version       integer     1, 2, 3… par document
  designation   text        titre de la première ligne de prestation
  notes         text        les trois blocs (PRESTATION / DÉTAIL / RÉSERVES)
  origine       text        'moteur' | 'manuel' | 'assiste' | 'emission'
  regles        text[]      règles de rédaction appliquées, le cas échéant
  cree_le       timestamptz default now()
  cree_par      uuid        → users(id)
  note          text        commentaire libre, facultatif
```

`origine` est le champ qui porte la valeur de preuve :

| valeur      | signification                                                   |
| ----------- | --------------------------------------------------------------- |
| `moteur`    | texte produit par le moteur de rédaction, sans retouche          |
| `assiste`   | une fonction de rédaction assistée a été appliquée (C4, C5…)     |
| `manuel`    | le commercial a écrit ou réécrit le texte à la main              |
| `emission`  | version figée au moment de l'envoi au client — celle qui engage |

La version `emission` est celle qu'on produira en cas de litige. Les autres
servent à comprendre comment on y est arrivé.

## 3. Le SQL exact

```sql
-- ════════════════════════════════════════════════════════════════════
--  M1 — Historique des versions d'un devis
--
--  Le §17 du référentiel de rédaction exige « un historique des versions ».
--  Il existe aujourd'hui dans l'éditeur seulement : fermer l'onglet avant
--  d'enregistrer perd les versions intermédiaires, et une fois enregistré,
--  le texte précédent est écrasé.
--
--  ADDITIVE ET SEULEMENT ADDITIVE : une table nouvelle, aucune colonne
--  ajoutée ni modifiée ailleurs, aucune donnée existante touchée, aucun
--  index supprimé, aucune politique existante altérée.
-- ════════════════════════════════════════════════════════════════════

create table if not exists document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,

  -- Numéro de version PAR DOCUMENT, à partir de 1. Attribué côté serveur
  -- sous verrou (voir §5), jamais par le client : deux onglets ouverts sur
  -- le même devis ne doivent pas écrire la version 3 deux fois.
  version     integer not null check (version >= 1),

  -- Le contenu, tel qu'il était. Deux champs seulement, parce que ce sont
  -- les deux que l'éditeur manipule : le libellé qui porte le titre, et les
  -- notes qui portent les trois blocs.
  --
  -- ⚠️ AUCUN MONTANT ici, et c'est volontaire. Les lignes du devis ont leur
  -- propre table (`document_lines`) et leur propre histoire ; recopier un
  -- total dans un historique de texte créerait une seconde vérité sur le
  -- prix, qui finirait par contredire la première.
  designation text,
  notes       text,

  -- D'où vient cette version. C'est le champ qui porte la valeur de preuve :
  -- distinguer ce que le moteur a rédigé de ce qu'un humain a réécrit.
  origine     text not null
              check (origine in ('moteur', 'assiste', 'manuel', 'emission')),

  -- Règles de rédaction appliquées, quand `origine = 'assiste'`.
  -- Vide pour les autres origines.
  regles      text[] not null default '{}',

  note        text,
  cree_le     timestamptz not null default now(),
  cree_par    uuid references users(id),

  -- Une seule ligne par (document, version). C'est la contrainte qui rend
  -- l'attribution du numéro sûre : une course perdue lève une violation
  -- d'unicité (23505) au lieu d'écrire une version en double.
  unique (document_id, version)
);

-- Lecture de l'historique d'un devis : du plus récent au plus ancien, c'est
-- le seul ordre dans lequel on consulte un historique.
create index if not exists document_versions_doc_idx
  on document_versions (document_id, version desc);

-- Retrouver la version d'émission d'un devis sans parcourir tout l'historique.
create index if not exists document_versions_emission_idx
  on document_versions (document_id)
  where origine = 'emission';

-- ── APPEND-ONLY, AU NIVEAU DE LA BASE ──────────────────────────────
--
-- Un historique modifiable n'est pas un historique. La règle est posée en
-- base, et non dans le code applicatif, parce que c'est la seule façon
-- qu'elle survive à un futur `supabase db push` écrit par quelqu'un d'autre.
--
-- `audit_logs` suit la même discipline dans ce dépôt.
create or replace function document_versions_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'document_versions est append-only : une version ne se modifie ni ne se supprime (document_id=%, version=%)',
    old.document_id, old.version;
end;
$$;

drop trigger if exists document_versions_no_update on document_versions;
create trigger document_versions_no_update
  before update or delete on document_versions
  for each row execute function document_versions_append_only();

-- ── RLS ────────────────────────────────────────────────────────────
--
-- Calquée EXACTEMENT sur la politique de `documents`
-- (20260515000005_init_rls.sql) : admin, planificateur, ou propriétaire du
-- lead rattaché. Pas une politique « inspirée de » — la même, parce qu'un
-- historique plus permissif que le document qu'il décrit serait une fuite :
-- le texte d'un devis d'un autre commercial est exactement ce que la
-- tenancy `mine` protège.
alter table document_versions enable row level security;

create policy "document_versions visible comme le devis"
  on document_versions for select
  to authenticated
  using (
    exists (
      select 1 from documents d
      where d.id = document_versions.document_id
        and d.deleted_at is null
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT seulement. Pas de `for all` : le trigger refuserait de toute façon
-- un UPDATE, mais une politique qui l'autorise donnerait à lire le contraire
-- de ce qui se passe.
create policy "document_versions écrivable comme le devis"
  on document_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from documents d
      where d.id = document_versions.document_id
        and d.deleted_at is null
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  );

comment on table document_versions is
  'Historique append-only du TEXTE d''un devis (§17). Aucun montant : les '
  'lignes et les totaux ont leur propre histoire. `origine` distingue ce que '
  'le moteur a rédigé de ce qu''un humain a réécrit.';
```

## 4. Impacts sur les données existantes

**Aucun.** Mesuré, pas supposé :

| point                             | effet                                        |
| --------------------------------- | -------------------------------------------- |
| colonnes ajoutées ailleurs        | aucune                                       |
| colonnes modifiées ou supprimées  | aucune                                       |
| données réécrites                 | aucune                                       |
| politiques RLS existantes touchées| aucune                                       |
| index existants touchés           | aucun                                        |
| enum modifié                      | aucun (`origine` est un `text` + `check`)    |
| verrou sur `documents`            | un `ACCESS SHARE` le temps du `references`   |

`origine` est volontairement un `text` avec contrainte `check` et **pas** un
enum Postgres : ajouter une valeur à un enum est une migration de plus, alors
qu'élargir un `check` est un `alter table` immédiat. Le dépôt utilise des
enums pour les états métier stables (`document_status`, `legal_form`) ; une
provenance technique n'a pas cette stabilité.

**Les devis déjà émis n'auront pas d'historique.** C'est le choix honnête :
fabriquer une version `emission` rétroactive à partir du `notes` actuel
affirmerait que ce texte est celui qui a été envoyé, ce que personne ne peut
vérifier. L'historique commence le jour de la migration, et l'interface devra
le dire — « aucune version enregistrée avant le 6 novembre 2026 » — plutôt
que d'afficher une version inventée.

## 5. Ce que le code devra faire (et qui n'est pas dans cette migration)

L'attribution du numéro de version se fait **côté serveur, sous verrou**, de
la même façon que la numérotation sans trou des documents
([lib/devis/numero.ts](../lib/devis/numero.ts)) :

```sql
-- À écrire au moment de l'implémentation, pas maintenant.
select coalesce(max(version), 0) + 1
  from document_versions
 where document_id = $1
   for update;
```

La contrainte `unique (document_id, version)` est le filet : si deux onglets
écrivent la version 3 en même temps, l'un des deux reçoit un `23505` et
réessaie. C'est le même mécanisme que `webhook_events` dans ce dépôt.

Points à décider **avant** l'implémentation, pas dans la migration :

1. **Quand enregistre-t-on une version ?** À chaque « Enregistrer » ? Cela
   peut faire dix versions pour une relecture. À chaque fonction de rédaction
   assistée appliquée ? À l'émission seulement ? Ma recommandation : à
   l'émission (obligatoire, c'est la preuve) et à chaque application d'une
   fonction assistée (c'est ce qui explique le texte). Pas à chaque frappe.
2. **Combien de temps les garde-t-on ?** Les versions `emission` relèvent de
   la conservation des pièces comptables (≥ 10 ans pour un document signé,
   cf. CDC). Les versions intermédiaires n'ont aucune valeur après quelques
   mois. Une purge des `moteur`/`assiste`/`manuel` au-delà de 12 mois est
   envisageable ; les `emission`, jamais.
3. **Qui peut lire l'historique ?** La RLS proposée dit : les mêmes que le
   devis. À confirmer — on pourrait vouloir que seul l'admin voie qui a
   réécrit quoi.

## 6. Risques

| risque | gravité | ce qui le contient |
| --- | --- | --- |
| Croissance de la table. Un devis très retouché peut porter 20 versions de ~4 ko. | faible | ~80 ko par devis au pire. À 80 devis/mois, ~75 Mo/an. Une purge des versions intermédiaires suffirait largement. |
| Le trigger append-only bloque une correction légitime (faute de frappe dans une note). | faible | C'est voulu. Une correction s'ajoute en nouvelle version ; réécrire l'historique le vide de sens. Si un effacement devient nécessaire (RGPD), il se fait par une migration explicite et tracée, pas par un UPDATE. |
| La RLS de l'historique divergerait de celle de `documents` si cette dernière évolue. | **moyenne** | C'est le vrai risque. La politique est dupliquée, pas dérivée. À l'implémentation, ajouter une suite de contrôles qui vérifie que les deux politiques accordent les mêmes accès — le dépôt a déjà des contrôles RLS de ce type. |
| Le numéro de version attribué en double. | faible | `unique (document_id, version)` + attribution sous verrou. Mécanisme déjà éprouvé pour la numérotation sans trou. |
| On croit avoir l'historique d'un devis ancien alors qu'il n'y en a pas. | **moyenne** | L'interface doit dire explicitement « historique commencé le … ». Un historique vide affiché sans mention se lit comme « personne n'a rien modifié », ce qui est faux. |

## 7. Plan de retour arrière

La migration étant purement additive, le retour arrière est complet et sans
perte sur les données existantes :

```sql
-- Retour arrière M1. Supprime l'historique ET son contenu : à n'exécuter
-- que si l'on accepte de perdre les versions enregistrées depuis la
-- migration. Les devis eux-mêmes ne sont pas touchés.
drop trigger if exists document_versions_no_update on document_versions;
drop function if exists document_versions_append_only();
drop policy if exists "document_versions visible comme le devis" on document_versions;
drop policy if exists "document_versions écrivable comme le devis" on document_versions;
drop index if exists document_versions_emission_idx;
drop index if exists document_versions_doc_idx;
drop table if exists document_versions;
```

Si l'on veut annuler la migration **en conservant** ce qui a été enregistré,
renommer plutôt que supprimer :

```sql
alter table document_versions rename to document_versions_abandonne;
```

## 8. Ce que je n'ai pas fait, et pourquoi

- **Rien n'est appliqué.** `supabase db push` n'a pas été lancé. Je n'ai pas
  d'accès SSH ni Docker au VPS, et une migration ne s'applique qu'avec votre
  validation explicite.
- **Le fichier n'est pas dans `supabase/migrations/`.** Il y serait appliqué
  au prochain `db push` sans que personne l'ait voulu.
- **Aucune donnée de production n'a été modifiée.** La seule lecture faite
  pour rédiger ce document est la structure des tables, à travers
  `lib/supabase/database.types.ts` et les migrations du dépôt.
- **L'interface n'est pas écrite.** Afficher un historique demande de
  trancher les trois points du §5 ; les coder avant serait coder une décision
  qui n'est pas la mienne.

## 9. Ce qu'il faut de vous pour avancer

1. L'accord sur la table et la RLS telles qu'elles sont écrites ci-dessus.
2. La réponse aux trois questions du §5 : quand enregistrer, combien de temps
   garder, qui peut lire.
3. L'autorisation d'appliquer, qui sera demandée **séparément** — et qui
   n'est pas un déploiement : `supabase db push` touche la base, le
   déploiement du code est une autre opération, avec sa propre autorisation.
