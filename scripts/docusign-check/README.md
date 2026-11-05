# Contrôles DocuSign

151 assertions sur la logique **pure** de l'intégration DocuSign et des
sociétés émettrices.

```bash
npm run check:docusign
```

Sortie attendue : `2 suites — TOUT PASSE`, code de sortie 0.

## Pourquoi ces fichiers existent

Le dépôt n'a volontairement aucun framework de test (cf. `CLAUDE.md`). Ces
contrôles suivent donc le précédent de [`scripts/devis-compare`](../devis-compare) :
un vérificateur autonome, lancé à la main, qui n'alourdit ni le build ni le
lint.

Ce qu'ils protègent est précisément ce qui ne se voit pas à l'écran et ne se
rattrape pas après coup :

- une signature HMAC acceptée à tort fait déclarer un contrat « signé » par
  un inconnu ;
- une transition d'état relâchée fait repasser un contrat signé en attente ;
- une clé d'idempotence trop large fait archiver deux fois, trop étroite fait
  retraiter chaque réémission de DocuSign ;
- une URL d'API codée en dur envoie un contrat réel depuis le bac à sable, ou
  l'inverse ;
- une société sans représentant légal produit un contrat dont le bloc
  « ENTRE LES SOUSSIGNÉS » est vide — donc inopposable.

## Portée — et ses limites

**Aucun réseau, aucune base, aucune enveloppe envoyée.** Les suites
s'exécutent sur une machine sans le moindre secret configuré. C'est la
condition pour qu'elles soient lançables à tout moment, y compris avant un
déploiement.

La contrepartie doit être dite : elles ne prouvent **rien** sur le
raccordement réel. Un OAuth qui aboutit, une enveloppe acceptée par DocuSign,
un webhook reçu en production — cela se vérifie sur l'environnement, pas ici.

## Les deux suites

### `integration.ts` — 23 sections

PKCE (vérificateur, défi S256, comparaison à temps constant), `state`
(expiration, usage unique), URL d'autorisation, séparation bac à sable /
production, non-codage en dur de l'URL d'API, redirection autorisée, marge de
rafraîchissement des jetons, limite de 30 jours du jeton de renouvellement,
HMAC Connect, idempotence des notifications, file de reprise et back-off,
lecture des deux générations de format Connect, traduction DocuSign → CRM,
transitions interdites, statuts terminaux et déclenchement de l'archivage,
signataires restants, ancres de positionnement, contrôle d'entité,
instantané juridique.

### `entites.ts` — 6 sections

La chaîne complète du représentant légal : contrôle d'entité → variables du
contrat → en-tête « ENTRE LES SOUSSIGNÉS » → instantané figé à l'envoi.

Elle part de l'état réel du CRM au 2026-11-03 — **sept sociétés, zéro
représentant** — et vérifie que cet état est refusé avec un motif précis,
puis qu'il devient émissible une fois les deux champs saisis dans
Réglages › Sociétés émettrices.

## Ajouter une suite

Déposer le fichier `.ts` ici et l'ajouter au tableau `SUITES` de
[`run.mjs`](run.mjs). Conventions : une assertion par ligne, un libellé en
français qui dit ce qui est garanti (pas le nom de la fonction), sortie en
code 1 au premier échec cumulé.

Les imports utilisent `@/lib/...` ; `run.mjs` passe `--alias:@=.` à esbuild
pour reproduire l'alias du `tsconfig.json`. N'importer que des modules
**purs** — un module commençant par `import "server-only"` ne se compile pas
ici, et c'est voulu.
