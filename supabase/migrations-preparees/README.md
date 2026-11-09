# Migrations préparées, non appliquées

Ce dossier n'est **pas** lu par `supabase db push`. C'est voulu.

Une migration placée ici est **écrite, relue et contrôlée**, mais elle ne peut
pas être appliquée par accident. Elle n'entre dans `supabase/migrations/`
qu'au moment où le client l'autorise — et c'est ce déplacement, et lui seul,
qui vaut autorisation.

## ⚠️ Pourquoi ce dossier existe

Parce que `supabase/migrations/` est un **chemin d'application**, pas un
dossier de brouillons. Une migration qu'on y dépose « pour plus tard » sera
appliquée au premier `supabase db push`, y compris si ce `db push` était
autorisé pour une **autre** migration. Le risque n'est pas théorique :

> `supabase/migrations/20261108000001_document_versions_historique_devis.sql`
> est présentement dans ce chemin et **n'a jamais été appliquée**. Une
> autorisation donnée pour n'importe quelle autre migration l'appliquerait
> aussi, sans que personne l'ait demandé.

C'est un point à trancher avec le client, pas à corriger sans lui : déplacer
cette migration ici la retirerait du chemin, mais changerait l'ordre
chronologique si elle est appliquée plus tard.

## Comment appliquer, le jour où c'est autorisé

```bash
# 1. Vérifier la cible AVANT tout (le script refuse une cible de production)
npm run verif:cible

# 2. Rejouer l'intégralité des migrations sur le Postgres local, à coût nul
npm run preflight

# 3. Déplacer la migration dans le chemin d'application
git mv supabase/migrations-preparees/<fichier>.sql supabase/migrations/

# 4. Appliquer — sur la recette d'abord, jamais sur la production en premier
npx supabase db push

# 5. Rejouer les contrôles
npm run check:recette
```

## Contenu

| Fichier | Anomalie | Ce qu'elle fait | Pourquoi elle attend |
| --- | --- | --- | --- |
| `20261110000001_numerotation_revoke_public.sql` | **D23** | ferme `PUBLIC` sur trois fonctions `SECURITY DEFINER`, en accordant aux rôles réellement appelants | une erreur de rôle casse l'émission des contrats : à éprouver sur la recette |
