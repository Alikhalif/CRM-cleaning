# Bannières de signature e-mail (par secteur)

Ces images sont ajoutées **en bas des e-mails client** (envoi devis/facture +
e-mail du devis signé), choisies selon le **secteur du lead** :

| Secteur du lead | Fichier attendu |
|---|---|
| `demenagement` | `demenagement.png` |
| `nettoyage` / `nettoyage_difficile` / `debarras` | `nettoyage.png` |

## À faire

Dépose ici les **2 bannières** OPTIMIVV, exactement sous ces noms :

- `public/email-signatures/demenagement.png` — bannière bleue « OPTIMIVV DÉMÉNAGEMENT »
- `public/email-signatures/nettoyage.png` — bannière verte « OPTIMIVV NETTOYAGE / DÉBARRAS »

Recommandations :
- Largeur ~**600–880 px** (elles s'affichent à 440 px de large dans l'e-mail, donc du 2× pour rester nettes sur écrans Retina).
- Format **PNG** (ou JPG). Poids conseillé < 150 Ko chacune pour la délivrabilité.

Elles sont servies publiquement à :
`https://devis.optimivv-demenagement.com/email-signatures/demenagement.png`
`https://devis.optimivv-nettoyage.com/email-signatures/nettoyage.png`

> Sans ces fichiers, l'e-mail afficherait une image cassée → **ajoute-les avant
> de déployer**. Le code n'insère la bannière que pour les secteurs ci-dessus.
