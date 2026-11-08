// État de préparation de la recette — décision PURE (testée sans réseau).
//
// Elle répond à une seule question, celle du client : « quand mon
// intervention devient-elle indispensable ? » — en nommant l'ÉTAPE SUIVANTE
// et QUI doit la faire. Elle ne crée rien, ne lance rien, ne lit aucun secret
// (seulement la PRÉSENCE des variables).

import { deciderMigration, refDepuisUrl } from "../migrer-recette/garde";

export type Faits = {
  envRecetteExiste: boolean;
  modeRecette: boolean;
  motifsBloquants: string[];
  urlRecette?: string;
  urlProduction?: string;
  refCli: string | null;
  comptesTestRenseignes: boolean;
  scriptsRecettePresents: boolean;
};

export type Etape = { numero: number; qui: "vous" | "moi" | "vous + moi"; quoi: string; autorisation: boolean };

export function prochaineEtape(f: Faits): { pret: boolean; etape: Etape; constats: string[] } {
  const constats: string[] = [];
  if (!f.scriptsRecettePresents) {
    return { pret: false, constats: ["scripts de recette manquants dans le dépôt"], etape: { numero: 0, qui: "moi", quoi: "Restaurer supabase/recette/ (00, 10, 20).", autorisation: false } };
  }
  if (!f.envRecetteExiste) {
    constats.push(".env.recette absent");
    return { pret: false, constats, etape: { numero: 1, qui: "vous", quoi: "Vérifier dans le tableau de bord Supabase le plan de l'organisation de production et le nombre de projets gratuits actifs, puis créer le projet de recette (gratuit si une place est libre, ≈ 10 $/mois sinon — sur votre accord).", autorisation: true } };
  }
  const refRec = refDepuisUrl(f.urlRecette);
  const refProd = refDepuisUrl(f.urlProduction);
  if (!f.modeRecette || f.motifsBloquants.length > 0 || !refRec || !refProd || refRec === refProd) {
    if (!f.modeRecette) constats.push("CGK_ENV n'est pas « recette »");
    for (const m of f.motifsBloquants) constats.push(m);
    if (!refProd) constats.push("CGK_SUPABASE_URL_PRODUCTION absente");
    if (refRec && refRec === refProd) constats.push(".env.recette pointe sur la PRODUCTION");
    return { pret: false, constats, etape: { numero: 3, qui: "vous", quoi: "Compléter .env.recette (gabarit .env.recette.example), puis lancer `npm run verif:cible -- .env.recette` et me coller la sortie.", autorisation: false } };
  }
  const gate = deciderMigration({ modeRecette: true, motifsBloquants: [], refCli: f.refCli, urlRecette: f.urlRecette, urlProduction: f.urlProduction });
  if (!gate.ok) {
    constats.push(...gate.raisons);
    return { pret: false, constats, etape: { numero: 5, qui: "vous", quoi: "Lier la CLI au projet de RECETTE (`npx supabase link --project-ref <ref de la recette>`). Aujourd'hui elle est liée à un autre projet.", autorisation: false } };
  }
  if (!f.comptesTestRenseignes) constats.push("identifiants des comptes de test absents : les sections 7 et 9 du test réel seront sautées");
  return { pret: true, constats, etape: { numero: 6, qui: "moi", quoi: "`npm run migrer:recette` (simulation des 185 migrations), puis — sur votre autorisation — `-- --appliquer`.", autorisation: true } };
}
