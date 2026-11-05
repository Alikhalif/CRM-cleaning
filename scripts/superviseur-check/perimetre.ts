// PÉRIMÈTRE DU SUPERVISEUR — fermé par défaut (« Option A », 2026-11-05).
//
// POURQUOI CE CONTRÔLE EXISTE. Le client a exigé, mot pour mot : « Une absence
// de configuration signifie zéro accès, jamais un accès global. » La migration
// d'origine (20261015000002) documentait exactement l'inverse. Une sémantique
// inversée ne se voit ni au typage ni au build : elle se voit le jour où un
// superviseur lit les dossiers de cinq pays qu'il n'était pas censé voir.
//
// Ce fichier teste les RÈGLES pures de lib/supervision-perimetre.ts. Aucune
// base, aucun réseau, aucun secret : exécutable à tout moment.
//
// CE QU'IL NE FAIT PAS : il ne prouve pas qu'une session superviseur réelle
// voit ce tableau de bord-là. Cela demande un compte de test, que le client a
// demandé de ne pas créer sans son accord.

import {
  AUCUN_DROIT,
  COUNTRIES,
  PERIMETRE_VIDE,
  SECTEURS_HORS_PERIMETRE,
  SECTEURS_SUPERVISES,
  TOUS_LES_DROITS,
  aDroit,
  couvreTousLesPays,
  couvreToutesLesActivites,
  dossierDansPerimetre,
  motifExclusion,
  perimetreConfigure,
  type DossierAFiltrer,
  type Perimetre,
  type Univers,
} from "@/lib/supervision-perimetre";
import { SECTORS } from "@/lib/leads";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

// ── Jeu d'essai ──────────────────────────────────────────────────────
// Identifiants factices, un par secteur supervisé. L'ordre suit la taxonomie.
const ID: Record<string, string> = {
  nettoyage: "a0000000-0000-4000-8000-000000000001",
  nettoyage_difficile: "a0000000-0000-4000-8000-000000000002",
  diogene: "a0000000-0000-4000-8000-000000000003",
  demenagement: "a0000000-0000-4000-8000-000000000004",
  debarras: "a0000000-0000-4000-8000-000000000005",
  transport: "a0000000-0000-4000-8000-000000000006",
  // Hors familles — ne doit JAMAIS passer.
  urgence: "a0000000-0000-4000-8000-000000000090",
  renovation: "a0000000-0000-4000-8000-000000000091",
  enr: "a0000000-0000-4000-8000-000000000092",
};

const COM_A = "c0000000-0000-4000-8000-00000000000a";
const COM_B = "c0000000-0000-4000-8000-00000000000b";

const UNIVERS: Univers = {
  activityIds: SECTEURS_SUPERVISES.map((s) => ID[s]),
};

const dossier = (p: Partial<DossierAFiltrer> = {}): DossierAFiltrer => ({
  pays: "FR",
  activityId: ID.nettoyage,
  activiteSlug: "nettoyage",
  ownerId: COM_A,
  ...p,
});

const perimetre = (p: Partial<Perimetre> = {}): Perimetre => ({
  portee: "superviseur",
  pays: ["FR"],
  activityIds: [ID.nettoyage],
  commerciauxIds: [COM_A],
  inclureNonAttribues: false,
  droits: AUCUN_DROIT,
  ...p,
});

const ADMIN: Perimetre = {
  portee: "admin",
  pays: [...COUNTRIES],
  activityIds: UNIVERS.activityIds,
  commerciauxIds: [],
  inclureNonAttribues: true,
  droits: TOUS_LES_DROITS,
};

console.log("\n1. Fermé par défaut");

vrai("un périmètre vide n'est PAS configuré", !perimetreConfigure(PERIMETRE_VIDE));
vrai(
  "un périmètre vide ne laisse passer AUCUN dossier",
  !dossierDansPerimetre(PERIMETRE_VIDE, dossier(), UNIVERS),
);
vrai(
  "pays seuls, sans activité ni commercial : pas configuré",
  !perimetreConfigure(perimetre({ activityIds: [], commerciauxIds: [] })),
);
vrai(
  "activités seules, sans pays : pas configuré",
  !perimetreConfigure(perimetre({ pays: [] })),
);
vrai(
  "pays + activités mais aucun commercial ni leads non attribués : pas configuré",
  !perimetreConfigure(perimetre({ commerciauxIds: [] })),
);
vrai(
  "pays + activités + leads non attribués, sans commercial : configuré",
  perimetreConfigure(perimetre({ commerciauxIds: [], inclureNonAttribues: true })),
);
vrai("un périmètre complet est configuré", perimetreConfigure(perimetre()));
vrai("le Super Admin est toujours considéré configuré", perimetreConfigure(ADMIN));

console.log("\n2. Exclusion des activités hors des deux familles");

for (const s of SECTEURS_HORS_PERIMETRE) {
  vrai(
    `${s} est refusé à un superviseur, même si l'identifiant est listé`,
    !dossierDansPerimetre(
      perimetre({ activityIds: [...UNIVERS.activityIds, ID[s]] }),
      dossier({ activityId: ID[s], activiteSlug: s }),
      UNIVERS,
    ),
  );
  vrai(
    `${s} est refusé au Super Admin lui aussi (périmètre du MODULE)`,
    !dossierDansPerimetre(ADMIN, dossier({ activityId: ID[s], activiteSlug: s }), UNIVERS),
  );
}
for (const s of SECTEURS_SUPERVISES) {
  vrai(
    `${s} est accepté par le Super Admin`,
    dossierDansPerimetre(ADMIN, dossier({ activityId: ID[s], activiteSlug: s }), UNIVERS),
  );
}

console.log("\n3. Les trois axes se cumulent");

vrai("dossier conforme aux trois axes : accepté", dossierDansPerimetre(perimetre(), dossier(), UNIVERS));
vrai(
  "mauvais pays : refusé",
  !dossierDansPerimetre(perimetre(), dossier({ pays: "CH" }), UNIVERS),
);
vrai(
  "mauvais commercial : refusé",
  !dossierDansPerimetre(perimetre(), dossier({ ownerId: COM_B }), UNIVERS),
);
vrai(
  "activité supervisée mais non autorisée : refusé",
  !dossierDansPerimetre(
    perimetre(),
    dossier({ activityId: ID.debarras, activiteSlug: "debarras" }),
    UNIVERS,
  ),
);
vrai(
  "les cinq pays cochés : un dossier suisse passe",
  dossierDansPerimetre(perimetre({ pays: [...COUNTRIES] }), dossier({ pays: "CH" }), UNIVERS),
);

console.log("\n4. Valeurs non renseignées — on ne devine pas");

vrai(
  "lead sans commercial : refusé par défaut",
  !dossierDansPerimetre(perimetre(), dossier({ ownerId: null }), UNIVERS),
);
vrai(
  "lead sans commercial : accepté si « inclure les non attribués » est coché",
  dossierDansPerimetre(perimetre({ inclureNonAttribues: true }), dossier({ ownerId: null }), UNIVERS),
);
vrai(
  "lead sans pays : refusé sur un périmètre restreint à la France",
  !dossierDansPerimetre(perimetre(), dossier({ pays: null }), UNIVERS),
);
vrai(
  "lead sans pays : accepté quand les cinq pays sont couverts",
  dossierDansPerimetre(perimetre({ pays: [...COUNTRIES] }), dossier({ pays: null }), UNIVERS),
);
vrai(
  "lead sans activité : refusé sur un périmètre partiel",
  !dossierDansPerimetre(perimetre(), dossier({ activityId: null, activiteSlug: null }), UNIVERS),
);
vrai(
  "lead sans activité : accepté quand toutes les activités supervisées sont couvertes",
  dossierDansPerimetre(
    perimetre({ activityIds: UNIVERS.activityIds }),
    dossier({ activityId: null, activiteSlug: null }),
    UNIVERS,
  ),
);
vrai(
  "couvreTousLesPays est faux dès qu'un pays manque",
  !couvreTousLesPays(perimetre({ pays: ["FR", "CH", "LU", "BE"] })),
);
vrai(
  "couvreToutesLesActivites est faux sur un univers vide (aucune activité en base)",
  !couvreToutesLesActivites(perimetre({ activityIds: [] }), { activityIds: [] }),
);

console.log("\n5. Motif d'exclusion — le dossier écarté reste explicable");

vrai(
  "dossier accepté : aucun motif",
  motifExclusion(perimetre(), dossier(), UNIVERS) === null,
);
vrai(
  "activité hors module → activite_hors_module",
  motifExclusion(perimetre(), dossier({ activityId: ID.urgence, activiteSlug: "urgence" }), UNIVERS) ===
    "activite_hors_module",
);
vrai(
  "pays non autorisé → pays_non_autorise",
  motifExclusion(perimetre(), dossier({ pays: "CA" }), UNIVERS) === "pays_non_autorise",
);
vrai(
  "lead non attribué → non_attribue",
  motifExclusion(perimetre(), dossier({ ownerId: null }), UNIVERS) === "non_attribue",
);
vrai(
  "commercial non autorisé → commercial_non_autorise",
  motifExclusion(perimetre(), dossier({ ownerId: COM_B }), UNIVERS) === "commercial_non_autorise",
);
vrai(
  "activité non autorisée → activite_non_autorisee",
  motifExclusion(
    perimetre(),
    dossier({ activityId: ID.transport, activiteSlug: "transport" }),
    UNIVERS,
  ) === "activite_non_autorisee",
);

console.log("\n6. Droits d'intervention");

vrai("aucun droit par défaut", !aDroit(perimetre(), "reaffecter"));
vrai(
  "un droit accordé sur un périmètre NON configuré ne vaut rien",
  !aDroit(perimetre({ pays: [], droits: TOUS_LES_DROITS }), "reaffecter"),
);
vrai(
  "un droit accordé sur un périmètre configuré s'applique",
  aDroit(perimetre({ droits: { ...AUCUN_DROIT, reaffecter: true } }), "reaffecter"),
);
vrai(
  "les droits ne se contaminent pas entre eux",
  !aDroit(perimetre({ droits: { ...AUCUN_DROIT, reaffecter: true } }), "definirPriorite"),
);
vrai("le Super Admin a tous les droits", aDroit(ADMIN, "definirPriorite"));

console.log("\n7. Non-régression — aucun secteur ne peut rester non classé");

// Si un dixième secteur est ajouté à lib/leads.ts sans être rangé dans une
// famille ou dans les exclusions, ce contrôle échoue. Sans lui, le secteur
// serait silencieusement invisible dans la supervision — ou, pire, visible
// alors qu'il devait être exclu.
for (const s of SECTORS) {
  vrai(
    `le secteur ${s} est explicitement classé (supervisé ou exclu)`,
    SECTEURS_SUPERVISES.includes(s) || SECTEURS_HORS_PERIMETRE.includes(s),
  );
}
vrai(
  "aucun secteur n'est à la fois supervisé et exclu",
  !SECTEURS_SUPERVISES.some((s) => SECTEURS_HORS_PERIMETRE.includes(s)),
);
vrai(
  "tous les secteurs exclus existent réellement dans lib/leads.ts",
  SECTEURS_HORS_PERIMETRE.every((s) => (SECTORS as string[]).includes(s)),
);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
