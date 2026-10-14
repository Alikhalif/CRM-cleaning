-- Module « Grilles tarifaires » (demande client 2026-10-14).
--
-- Remplace pricing_params, créé la veille : ce modèle-là ne portait qu'une
-- valeur par paramètre, alors que la politique tarifaire réelle s'exprime en
-- TRANCHES avec un minimum et un maximum (0–5 m³ : 450 à 750 €). Deux modèles
-- concurrents auraient divergé. pricing_params n'a jamais reçu de donnée
-- (8 lignes à zéro, aucune activée) : rien n'est perdu.
--
-- La grille entière vit dans un JSONB : chaque activité a ses propres unités
-- (m³, m², heures, passages…) et le Super Admin doit pouvoir ajouter des
-- paramètres sans migration. Un schéma en colonnes rigides l'en empêcherait.

drop table if exists pricing_params;

create table if not exists pricing_grids (
  activity_id uuid primary key references activities(id) on delete cascade,

  -- brouillon : jamais utilisée par les commerciaux, quel que soit le reste.
  -- active    : publiée, utilisée dans la découverte.
  -- inactive  : publiée puis suspendue.
  status text not null default 'brouillon'
    check (status in ('brouillon', 'active', 'inactive')),
  version integer not null default 1,

  -- Contenu de la grille. Forme : { "<section>": [ { key, label, from, to,
  -- min, max, pct, custom }, … ] }. Voir lib/pricing/grid-types.ts.
  grid jsonb not null default '{}'::jsonb,

  -- ── Visibilité ────────────────────────────────────────────────────────
  -- Le commercial ne voit JAMAIS la grille : au mieux la fourchette calculée.
  visible_to_commercial boolean not null default false,
  -- Sous-traitants : fermé par défaut, exigence explicite du client.
  visible_to_subcontractor boolean not null default false,

  -- ── Contrôle du prix annoncé ──────────────────────────────────────────
  allow_commercial_override boolean not null default false,
  max_discount_pct numeric(5,2) not null default 0,
  floor_price numeric(10,2) not null default 0,

  -- Position du prix conseillé dans la fourchette, en %. 75 = plutôt haut,
  -- conformément à la politique demandée.
  positioning_pct numeric(5,2) not null default 75,

  -- TVA : nullable À DESSEIN. Aucun taux universel n'est supposé — tant qu'il
  -- n'est pas renseigné, les montants sont annoncés HT et l'interface le dit.
  vat_rate numeric(5,2),

  -- Arrondi commercial du prix conseillé (0 = pas d'arrondi).
  rounding integer not null default 50,

  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  published_at timestamptz,
  published_by uuid references users(id)
);

-- Historique : chaque publication fige la grille telle qu'elle était. Un devis
-- déjà émis garde donc son contexte tarifaire, et une modification de grille ne
-- réécrit jamais le passé.
create table if not exists pricing_grid_history (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  version integer not null,
  status text not null,
  grid jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references users(id),
  note text
);

create index if not exists pricing_grid_history_activity_idx
  on pricing_grid_history (activity_id, changed_at desc);

-- Une ligne par activité, toutes en brouillon et vides.
insert into pricing_grids (activity_id)
select id from activities
on conflict (activity_id) do nothing;

alter table pricing_grids enable row level security;
alter table pricing_grid_history enable row level security;

-- Lecture : tout utilisateur authentifié. La découverte a besoin de calculer ;
-- le filtrage de ce qu'on MONTRE (fourchette seule, jamais la grille) est fait
-- côté serveur dans lib/pricing/grid-server.ts.
create policy "pricing_grids lisibles par les authentifiés"
  on pricing_grids for select to authenticated using (true);

-- Écriture : Super Admin uniquement. Exigence explicite : personne d'autre ne
-- décide d'un tarif.
create policy "pricing_grids modifiables par admin"
  on pricing_grids for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "pricing_grid_history lisible par admin"
  on pricing_grid_history for select to authenticated using (is_admin());
create policy "pricing_grid_history écrivable par admin"
  on pricing_grid_history for insert to authenticated with check (is_admin());

-- ── Grille DÉMÉNAGEMENT, en BROUILLON ──────────────────────────────────
-- Montants fournis par le client, décrits par lui comme « valeurs initiales
-- proposées » sur une politique haute. Chargés en brouillon : aucun commercial
-- ne les verra tant que le Super Admin n'a pas publié.
--
-- `custom: true` = « calcul personnalisé » : le moteur refuse de chiffrer et
-- demande une validation, au lieu d'extrapoler.
update pricing_grids
   set grid = $json${
  "volume": [
    { "key": "v0_5",   "label": "0 à 5 m³",        "from": 0,  "to": 5,   "min": 450,  "max": 750 },
    { "key": "v6_10",  "label": "6 à 10 m³",       "from": 6,  "to": 10,  "min": 750,  "max": 1150 },
    { "key": "v11_15", "label": "11 à 15 m³",      "from": 11, "to": 15,  "min": 1050, "max": 1550 },
    { "key": "v16_20", "label": "16 à 20 m³",      "from": 16, "to": 20,  "min": 1400, "max": 1950 },
    { "key": "v21_25", "label": "21 à 25 m³",      "from": 21, "to": 25,  "min": 1750, "max": 2350 },
    { "key": "v26_30", "label": "26 à 30 m³",      "from": 26, "to": 30,  "min": 2100, "max": 2850 },
    { "key": "v31_40", "label": "31 à 40 m³",      "from": 31, "to": 40,  "min": 2650, "max": 3650 },
    { "key": "v41_50", "label": "41 à 50 m³",      "from": 41, "to": 50,  "min": 3400, "max": 4600 },
    { "key": "v51_60", "label": "51 à 60 m³",      "from": 51, "to": 60,  "min": 4200, "max": 5600 },
    { "key": "v61_80", "label": "61 à 80 m³",      "from": 61, "to": 80,  "min": 5300, "max": 7200 },
    { "key": "v80p",   "label": "Plus de 80 m³",   "from": 81, "to": null, "min": 0,   "max": 0, "custom": true }
  ],
  "distance": [
    { "key": "d0_20",   "label": "Jusqu'à 20 km",  "from": 0,   "to": 20,   "min": 0,    "max": 0 },
    { "key": "d21_50",  "label": "21 à 50 km",     "from": 21,  "to": 50,   "min": 150,  "max": 350 },
    { "key": "d51_100", "label": "51 à 100 km",    "from": 51,  "to": 100,  "min": 300,  "max": 650 },
    { "key": "d101_200","label": "101 à 200 km",   "from": 101, "to": 200,  "min": 550,  "max": 1100 },
    { "key": "d201_300","label": "201 à 300 km",   "from": 201, "to": 300,  "min": 850,  "max": 1500 },
    { "key": "d301_500","label": "301 à 500 km",   "from": 301, "to": 500,  "min": 1300, "max": 2300 },
    { "key": "d501_700","label": "501 à 700 km",   "from": 501, "to": 700,  "min": 1900, "max": 3200 },
    { "key": "d700p",   "label": "Plus de 700 km", "from": 701, "to": null, "min": 0,    "max": 0, "custom": true }
  ],
  "floors": [
    { "key": "f1", "label": "1er étage sans ascenseur",  "from": 1, "to": 1,   "min": 80,  "max": 150 },
    { "key": "f2", "label": "2e étage sans ascenseur",   "from": 2, "to": 2,   "min": 150, "max": 250 },
    { "key": "f3", "label": "3e étage sans ascenseur",   "from": 3, "to": 3,   "min": 250, "max": 400 },
    { "key": "f4", "label": "4e étage sans ascenseur",   "from": 4, "to": 4,   "min": 350, "max": 550 },
    { "key": "f5", "label": "5e étage sans ascenseur",   "from": 5, "to": 5,   "min": 450, "max": 700 },
    { "key": "f6p","label": "6e étage et plus",          "from": 6, "to": null,"min": 0,   "max": 0, "custom": true }
  ],
  "access": [
    { "key": "portage_10_30",  "label": "Portage 10 à 30 m",        "min": 80,  "max": 150 },
    { "key": "portage_31_50",  "label": "Portage 31 à 50 m",        "min": 150, "max": 250 },
    { "key": "portage_51_100", "label": "Portage 51 à 100 m",       "min": 250, "max": 450 },
    { "key": "portage_100p",   "label": "Portage > 100 m",          "min": 0,   "max": 0, "custom": true },
    { "key": "escalier_etroit","label": "Escalier étroit",          "min": 100, "max": 300 },
    { "key": "passage_difficile","label": "Passage difficile",      "min": 100, "max": 350 },
    { "key": "acces_vehicule", "label": "Accès véhicule compliqué", "min": 150, "max": 400 },
    { "key": "rue_pietonne",   "label": "Rue piétonne",             "min": 0,   "max": 0 },
    { "key": "centre_ville",   "label": "Centre-ville difficile",   "min": 0,   "max": 0 },
    { "key": "sans_stationnement","label": "Absence de stationnement","min": 0, "max": 0 },
    { "key": "cour_interieure","label": "Cour intérieure",          "min": 0,   "max": 0 },
    { "key": "long_couloir",   "label": "Long couloir",             "min": 0,   "max": 0 },
    { "key": "plusieurs_batiments","label": "Plusieurs bâtiments",  "min": 0,   "max": 0 },
    { "key": "passage_jardin", "label": "Passage par jardin",       "min": 0,   "max": 0 },
    { "key": "marches_ext",    "label": "Marches extérieures",      "min": 0,   "max": 0 },
    { "key": "restrictions_horaires","label": "Restrictions horaires","min": 0, "max": 0 },
    { "key": "navette_petit_vehicule","label": "Navette petit véhicule","min": 0,"max": 0 },
    { "key": "manutention_exceptionnelle","label": "Manutention exceptionnelle","min": 0,"max": 0, "custom": true }
  ],
  "heavy": [
    { "key": "frigo_americain","label": "Réfrigérateur américain", "min": 100, "max": 250 },
    { "key": "piano_droit",    "label": "Piano droit",             "min": 350, "max": 750 },
    { "key": "piano_queue",    "label": "Piano à queue",           "min": 0,   "max": 0, "custom": true },
    { "key": "coffre_fort",    "label": "Coffre-fort",             "min": 0,   "max": 0, "custom": true },
    { "key": "aquarium",       "label": "Grand aquarium",          "min": 150, "max": 450 },
    { "key": "table_marbre",   "label": "Table en marbre",         "min": 150, "max": 400 },
    { "key": "mobilier_ancien","label": "Mobilier ancien fragile",  "min": 100, "max": 350 },
    { "key": "grand_miroir",   "label": "Grand miroir",            "min": 80,  "max": 200 },
    { "key": "oeuvre_art",     "label": "Œuvre d'art",             "min": 0,   "max": 0, "custom": true },
    { "key": "mobilier_volumineux","label": "Mobilier très volumineux","min": 0,"max": 0 }
  ],
  "demontage": [
    { "key": "lit_simple",      "label": "Lit simple",        "min": 50,  "max": 100 },
    { "key": "lit_double",      "label": "Lit double",        "min": 80,  "max": 150 },
    { "key": "armoire",         "label": "Armoire standard",  "min": 100, "max": 250 },
    { "key": "grande_armoire",  "label": "Grande armoire",    "min": 180, "max": 350 },
    { "key": "dressing",        "label": "Dressing complexe", "min": 0,   "max": 0, "custom": true },
    { "key": "meuble_volumineux","label": "Meuble volumineux","min": 100, "max": 250 },
    { "key": "cuisine",         "label": "Cuisine équipée",   "min": 0,   "max": 0, "custom": true }
  ],
  "emballage": [
    { "key": "fragiles",        "label": "Emballage objets fragiles", "min": 150, "max": 450 },
    { "key": "vaisselle",       "label": "Emballage vaisselle",       "min": 150, "max": 400 },
    { "key": "logement_complet","label": "Emballage complet",         "min": 0,   "max": 0, "custom": true },
    { "key": "protection_mobilier","label": "Protection renforcée",   "min": 100, "max": 350 },
    { "key": "cartons",         "label": "Fourniture de cartons",     "min": 0,   "max": 0 },
    { "key": "housses",         "label": "Housses de protection",     "min": 0,   "max": 0 },
    { "key": "cartons_penderie","label": "Cartons penderie",          "min": 0,   "max": 0 },
    { "key": "protection_sols", "label": "Protection sols/communs",   "min": 0,   "max": 0 }
  ],
  "materiel": [
    { "key": "monte_meubles",   "label": "Monte-meubles",            "min": 350, "max": 750 },
    { "key": "monte_meubles_op","label": "Monte-meubles + opérateur","min": 0,   "max": 0, "custom": true },
    { "key": "vehicule_sup",    "label": "Véhicule supplémentaire",  "min": 250, "max": 650 },
    { "key": "equipe_sup",      "label": "Équipe supplémentaire",    "min": 0,   "max": 0 },
    { "key": "navette",         "label": "Navette de manutention",   "min": 200, "max": 500 },
    { "key": "stockage",        "label": "Stockage temporaire",      "min": 0,   "max": 0, "custom": true },
    { "key": "garde_meubles",   "label": "Garde-meubles",            "min": 0,   "max": 0, "custom": true }
  ],
  "majorations": [
    { "key": "urgent_48h", "label": "Urgence sous 48 h",   "minPct": 15, "maxPct": 30 },
    { "key": "dimanche",   "label": "Dimanche",            "minPct": 20, "maxPct": 40 },
    { "key": "ferie",      "label": "Jour férié",          "minPct": 30, "maxPct": 50 },
    { "key": "nuit",       "label": "Intervention de nuit","minPct": 25, "maxPct": 50 },
    { "key": "fin_de_mois","label": "Fin de mois",         "minPct": 0,  "maxPct": 0 },
    { "key": "estivale",   "label": "Période estivale",    "minPct": 0,  "maxPct": 0 },
    { "key": "date_imposee","label": "Date imposée",       "minPct": 0,  "maxPct": 0 }
  ]
}$json$::jsonb
 where activity_id = (select id from activities where slug = 'demenagement')
   and grid = '{}'::jsonb;

comment on table pricing_grids is
  'Grilles tarifaires par activité. status=brouillon tant que le Super Admin n''a pas publié : aucune grille non publiée n''est utilisée par un commercial.';
