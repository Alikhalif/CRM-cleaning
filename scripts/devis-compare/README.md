# Devis OPTIMIVV — comparaison pixel (régression visuelle)

Vérifie que le générateur TypeScript (`lib/devis`, pdfkit) produit un PDF
**identique au pixel près** au générateur de référence Python (reportlab), qui
est la maquette validée figée.

## Prérequis

```bash
pip install reportlab pypdfium2 pillow numpy   # référence + rasterisation + diff
# esbuild est déjà en devDependency (sert à exécuter le TS hors Next)
```

La **référence** (`devis_generator.py` + `assets/`) est fournie dans
`devis-template.zip` à la racine du dépôt. Décompresser une fois :

```bash
unzip -o devis-template.zip -d /tmp/devref
unzip -o /tmp/devref/optimivv-devis.zip -d /tmp/devref
REF=/tmp/devref/optimivv-devis
```

## Lancer la comparaison

```bash
# 1) PDF de RÉFÉRENCE (reportlab) pour un jeu de données
python "$REF/devis_generator.py" scripts/devis-compare/scenario.json /tmp/ref.pdf

# 2) PDF TYPESCRIPT (pdfkit) pour le MÊME jeu de données
node_modules/.bin/esbuild scripts/devis-compare/ts_entry.ts \
  --bundle --platform=node --format=esm --external:pdfkit --outfile=_ts_entry.mjs
node _ts_entry.mjs scripts/devis-compare/scenario.json /tmp/ts.pdf
rm _ts_entry.mjs

# 3) Rasteriser (2×) + diff
python scripts/devis-compare/render_png.py /tmp/ref.pdf /tmp/ref.png 2.0
python scripts/devis-compare/render_png.py /tmp/ts.pdf  /tmp/ts.png  2.0
python scripts/devis-compare/diff.py /tmp/ref.png /tmp/ts.png /tmp/diff.png
```

`diff.py` imprime le pourcentage de pixels différents (seuils 8/24/64), la
différence absolue moyenne et le max, et écrit une **carte de chaleur**
(`diff.png`, rouge = écart).

## Résultat attendu (obtenu)

Sur les trois jeux de données couvrant toutes les branches de rendu — exemple
complet, **payload vide** (traits à remplir), **description longue + sans
montant** (réduction de police, troncature 9 lignes, « …… € HT ») :

```
pixels diff > 8 :  32  (0.002 %)
mean abs diff   :  0.0009 / 255
```

Les ~32 pixels résiduels sont de l'anti-aliasing sur les pointes de courbes des
icônes (tesselation bézier légèrement différente entre reportlab et pdfkit) —
invisibles à l'œil, non structurels.

### Le point technique clé

pdfkit/fontkit applique par défaut le **kerning + ligatures OpenType**, que
reportlab n'applique pas → la police cursive (Chorus) dérivait
horizontalement. `lib/devis/render.ts` passe donc `features: {kern:false,
liga:false, …}` à chaque `text()`/`widthOfString()` pour reproduire la mise en
page à chasses brutes. Sans ça : ~0,3 % de pixels divergents sur les deux textes
cursifs.
