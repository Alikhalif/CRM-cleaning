-- Paramètres tarifaires par activité (demande client 2026-10-14) : socle de la
-- « fourchette recommandée » affichée dans la découverte commerciale.
--
-- ⚠️ AUCUN TARIF N'EST SEMÉ. Toutes les lignes sont créées à zéro et
-- `enabled = false`. Tant qu'un Super Admin n'a pas saisi SES chiffres, la
-- découverte affiche « paramètres non configurés » et ne propose aucune
-- fourchette. Inventer un barème serait pire que ne rien afficher : un
-- commercial annoncerait un prix inventé à un vrai client.
--
-- Un seul jeu de paramètres par activité. Le moteur (lib/pricing/compute.ts)
-- lit cette table et ne contient aucune valeur en dur.

create table if not exists pricing_params (
  activity_id uuid primary key references activities(id) on delete cascade,
  enabled boolean not null default false,

  -- Forfait de prise en charge, avant toute variable.
  base_price numeric(10,2) not null default 0,

  -- Inducteur de volume : ce que l'activité facture au m³ (déménagement,
  -- débarras) ou au m² (nettoyage). 'none' = pas d'inducteur de taille.
  unit text not null default 'none' check (unit in ('none', 'm3', 'm2')),
  price_per_unit numeric(10,2) not null default 0,

  -- Déplacement : les premiers kilomètres sont inclus dans le forfait.
  included_km integer not null default 0,
  price_per_km numeric(10,2) not null default 0,

  -- Portage : surcoût par étage SANS ascenseur (avec ascenseur = 0).
  price_per_floor_no_lift numeric(10,2) not null default 0,

  -- Majorations en POURCENTAGE du sous-total.
  urgency_pct numeric(5,2) not null default 0,
  difficulty_pct numeric(5,2) not null default 0,

  -- Options à prix fixe, libellé → montant. Ex. {"emballage": 150}.
  options jsonb not null default '{}'::jsonb,

  -- Plancher commercial : aucune fourchette ne descend sous ce montant.
  min_price numeric(10,2) not null default 0,

  -- Largeur de la fourchette autour du prix calculé, en %. 10/15 donne
  -- « prix -10 % » à « prix +15 % ».
  range_low_pct numeric(5,2) not null default 10,
  range_high_pct numeric(5,2) not null default 15,

  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

-- Une ligne par activité existante, toutes désactivées.
insert into pricing_params (activity_id)
select id from activities
on conflict (activity_id) do nothing;

alter table pricing_params enable row level security;

-- Lecture : tout utilisateur authentifié. La découverte en a besoin pour
-- afficher la fourchette ; les chiffres eux-mêmes (coûts, marges) ne sont pas
-- dans cette table — elle ne porte que des prix de vente.
create policy "pricing_params lisibles par les authentifiés"
  on pricing_params for select
  to authenticated
  using (true);

-- Écriture : Super Admin uniquement. Un commercial ne doit JAMAIS pouvoir
-- modifier une règle tarifaire (exigence explicite du client).
create policy "pricing_params modifiables par admin"
  on pricing_params for all
  to authenticated
  using (is_admin())
  with check (is_admin());

comment on table pricing_params is
  'Paramètres de la fourchette tarifaire recommandée, par activité. Créés vides : tant que enabled=false, la découverte n''affiche aucune fourchette.';
