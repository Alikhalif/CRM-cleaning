"""Produire un gabarit NEUTRE a partir du gabarit nettoyage fourni.

── POURQUOI ────────────────────────────────────────────────────────────

`public/devis-assets/nettoyage-template.pdf` est le design valide par le
client. Il porte l'identite d'OPTIMIVV NETTOYAGE : la denomination, l'adresse,
le SIRET, le telephone, le site, et l'emblème. Le moteur ecrit par-dessus les
donnees variables (numero, date, client, montant).

La « voie 0 » consiste a reutiliser ce design pour une AUTRE societe emettrice.
Le reflexe serait de poser un rectangle blanc sur l'identite et de reecrire par
dessus — c'est deja ce que fait `render-nettoyage.ts` pour le telephone.

Ce reflexe est FAUX ici, et c'est le point central de ce script : un rectangle
ne retire pas le texte de la COUCHE TEXTE du PDF. Un devis emis au nom d'une
societe suisse continuerait de contenir, en copier-coller et en recherche
plein texte, « OPTIMIVV SAS » et « SIRET : 928 083 427 00023 ». Sur un document
contractuel, c'est une fausse mention d'identite, pas un detail graphique.

Ce script retire donc le texte du FLUX DE CONTENU, puis verifie qu'il n'en
reste aucune trace. Il s'execute UNE fois, hors ligne ; le gabarit neutre est
versionne a cote de l'original, qui n'est jamais modifie.

── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────

Il ne touche ni a la charte, ni aux cadres, ni a la photo, ni aux libelles
(« PRESTATAIRE », « Adresse : », « SIRET : » …), ni aux positions. Seules les
VALEURS d'identite partent. Le reste du design est conserve a l'octet.

── USAGE ───────────────────────────────────────────────────────────────

    python scripts/gabarit-neutre/neutraliser.py

Prerequis : pypdf, pdfplumber.
"""
import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SOURCE = "public/devis-assets/nettoyage-template.pdf"
SORTIE = "public/devis-assets/nettoyage-template-neutre.pdf"
MANIFESTE = "public/devis-assets/nettoyage-template-neutre.json"

# ── Zones d'identite, relevees sur le gabarit avec pdfplumber ──────────
#
# Coordonnees en POINTS, origine EN HAUT (meme convention que
# render-nettoyage.ts). Chaque zone est legerement elargie pour couvrir la
# ligne de base et les jambages, sans mordre sur le libelle voisin.
#
# `logo` : les deux placements de l'emblème. Un emblème est une marque ; on ne
# l'imprime pas au nom d'une autre societe.
ZONES = [
    # nom                       x0     top0    x1     top1
    ("en-tete : nom de marque", 80.0, 26.0, 300.0, 50.0),
    ("en-tete : slogan", 80.0, 48.0, 300.0, 64.0),
    ("carte : denomination", 40.0, 172.0, 205.0, 188.0),
    ("carte : adresse", 40.0, 189.0, 205.0, 202.0),
    ("carte : ville", 40.0, 202.0, 205.0, 213.0),
    ("carte : identifiant legal", 40.0, 217.0, 205.0, 230.0),
    ("carte : telephone", 60.0, 236.0, 205.0, 249.0),
    ("carte : courriel", 60.0, 251.0, 205.0, 264.0),
    ("carte : site", 60.0, 266.0, 205.0, 280.0),
    ("pied : ligne d'identite", 55.0, 813.0, 350.0, 826.0),
    ("pied : telephone et site", 440.0, 818.0, 570.0, 832.0),
    # ── Valeurs d'EXEMPLE du gabarit ──────────────────────────────────
    #
    # Le moteur les recouvre deja d'un rectangle blanc, mais elles restent
    # dans la couche texte : une extraction du devis rendait
    # « 2017//0171//22002266 », les deux dates entrelacees. Sur le gabarit
    # neutre, elles partent.
    ("en-tete : numero d'exemple", 118.0, 100.0, 210.0, 112.0),
    # Libelle + valeur dans un MEME operateur de texte, ancre a x=50.4 :
    # indissociables. Le moteur redessine la ligne entiere.
    ("en-tete : date d'emission", 45.0, 118.0, 165.0, 127.0),
    # ── Valeurs CONTRACTUELLES ecrites en dur ─────────────────────────
    #
    # Le gabarit affirme « 30 jours », « 30 % » et l'article 293 B. Ce sont
    # des engagements, pas de la decoration : un devis de nettoyage dont
    # l'acompte est a 20 % ne doit pas en imprimer 30, et une societe suisse
    # ne doit porter aucune mention fiscale francaise.
    ("validite de l'offre", 190.0, 118.0, 300.0, 127.0),
    ("mention de TVA", 30.0, 550.0, 300.0, 560.0),
    ("acompte a la commande", 330.0, 598.0, 470.0, 608.0),
    # Texte d'invite de l'encadre descriptif. Recouvert a l'oeil par le
    # moteur, mais toujours present dans la couche texte : un copier-coller
    # du devis le rendait entrelace avec le vrai descriptif.
    #
    # Borne a x < 430 : au-dela commencent les pointilles du montant
    # (x 437,5) et le « € HT », que le moteur emploie encore.
    ("encadre : texte d invite", 45.0, 472.0, 430.0, 505.0),
]

ZONES_IMAGE = [
    ("en-tete : emblème", 30.0, 18.0, 80.0, 75.0),
    ("pied : emblème", 30.0, 809.0, 58.0, 840.0),
]

# Ce qui ne doit PLUS etre extractible du gabarit neutre.
SONDES_INTERDITES = [
    "21/07/2026",
    "2026-00045",
    "30 jours",
    "30 %",
    "293 B",
    "Merci de décrire ici",
    "OPTIMIVV",
    "928 083 427",
    "Alfred Bruneau",
    "75016 Paris",
    "optimivv.fr",
    "01 84 80 41 15",
    "propreté sans compromis",
]

# Ce qui doit SURVIVRE : le design, les libelles, les valeurs d'exemple que le
# moteur reecrit. Leur disparition signalerait une zone trop large.
# ⚠️ « SIRET : » n'y figure PAS, et c'est voulu. Le libelle lui-meme est
# francais : une societe suisse porte un IDE, une belge un numero BCE. Le
# libelle part donc avec la valeur, et le moteur le redessine selon le pays
# de la societe emettrice (`IDENTIFIANT_LEGAL` dans lib/leads.ts).
SONDES_ATTENDUES = [
    "PRESTATAIRE",
    "CLIENT",
    "DEVIS",
    "Nom / Société",
    "Satisfaction garantie",
    # Les LIBELLÉS restent : seules les VALEURS partent.
    "Solde à réception",
    "Adresse",
    "Nettoyage professionnel",
    "Merci pour votre confiance",
]

ESPACES = b"\x00\t\n\x0c\r "
DELIMS = b"()<>[]{}/%"


def jetons(data: bytes):
    """Decoupe un flux de contenu en jetons (genre, debut, fin).

    Genres : "nombre", "nom", "chaine", "tableau", "dict", "operateur".
    Les offsets permettent de recomposer le flux a l'octet pres.
    """
    i, n = 0, len(data)
    while i < n:
        c = data[i]
        if c in ESPACES:
            i += 1
            continue
        if c == 0x25:  # % commentaire
            while i < n and data[i] not in b"\r\n":
                i += 1
            continue
        debut = i
        if c == 0x2F:  # /Nom
            i += 1
            while i < n and data[i] not in ESPACES and data[i] not in DELIMS:
                i += 1
            yield ("nom", debut, i)
            continue
        if c == 0x28:  # (chaine)
            prof, i = 0, i
            while i < n:
                if data[i] == 0x5C:
                    i += 2
                    continue
                if data[i] == 0x28:
                    prof += 1
                elif data[i] == 0x29:
                    prof -= 1
                    if prof == 0:
                        i += 1
                        break
                i += 1
            yield ("chaine", debut, i)
            continue
        if c == 0x3C:
            if i + 1 < n and data[i + 1] == 0x3C:  # << dict >>
                prof, i = 0, i
                while i < n:
                    if data[i : i + 2] == b"<<":
                        prof += 1
                        i += 2
                        continue
                    if data[i : i + 2] == b">>":
                        prof -= 1
                        i += 2
                        if prof == 0:
                            break
                        continue
                    i += 1
                yield ("dict", debut, i)
                continue
            i = data.find(b">", i)
            i = n if i < 0 else i + 1
            yield ("chaine", debut, i)
            continue
        if c == 0x5B:  # [ tableau ]
            prof, i = 0, i
            while i < n:
                if data[i] == 0x5C:
                    i += 2
                    continue
                if data[i] == 0x28:  # une chaine peut contenir ]
                    p2 = 0
                    while i < n:
                        if data[i] == 0x5C:
                            i += 2
                            continue
                        if data[i] == 0x28:
                            p2 += 1
                        elif data[i] == 0x29:
                            p2 -= 1
                            if p2 == 0:
                                i += 1
                                break
                        i += 1
                    continue
                if data[i] == 0x5B:
                    prof += 1
                elif data[i] == 0x5D:
                    prof -= 1
                    if prof == 0:
                        i += 1
                        break
                i += 1
            yield ("tableau", debut, i)
            continue
        if c in b"+-.0123456789":
            i += 1
            while i < n and data[i] in b"+-.0123456789eE":
                i += 1
            yield ("nombre", debut, i)
            continue
        if c in DELIMS:
            i += 1
            yield ("operateur", debut, i)
            continue
        i += 1
        while i < n and data[i] not in ESPACES and data[i] not in DELIMS:
            i += 1
        yield ("operateur", debut, i)


def mul(m, p):
    """Applique une matrice [a b c d e f] a un point."""
    a, b, c, d, e, f = m
    x, y = p
    return (a * x + c * y + e, b * x + d * y + f)


def compose(m, n):
    """m puis n."""
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2,
    )


def dans(zones, x, top):
    for nom, x0, t0, x1, t1 in zones:
        if x0 <= x <= x1 and t0 <= top <= t1:
            return nom
    return None


def neutraliser(data: bytes, hauteur: float):
    """Retourne (flux nettoye, journal des retraits)."""
    toks = list(jetons(data))
    ctm = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    pile = []
    tm = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    operandes = []  # (genre, debut, fin) depuis le dernier operateur
    retraits = []  # (debut, fin, nom de zone, genre)
    journal = []

    def nombre(t):
        try:
            return float(data[t[1] : t[2]])
        except ValueError:
            return 0.0

    for genre, debut, fin in toks:
        if genre != "operateur":
            operandes.append((genre, debut, fin))
            continue
        op = data[debut:fin].decode("latin1")

        if op == "q":
            pile.append(ctm)
        elif op == "Q":
            if pile:
                ctm = pile.pop()
        elif op == "cm" and len(operandes) >= 6:
            m = tuple(nombre(t) for t in operandes[-6:])
            ctm = compose(m, ctm)
        elif op == "Tm" and len(operandes) >= 6:
            tm = tuple(nombre(t) for t in operandes[-6:])
        elif op in ("TJ", "Tj", "'", '"'):
            dev = mul(compose(tm, ctm), (0.0, 0.0))
            x, top = dev[0], hauteur - dev[1]
            nom = dans(ZONES, x, top)
            if nom:
                # On retire l'operande ET l'operateur. Tm et Tf restent :
                # inoffensifs, et les laisser evite de decaler quoi que ce soit.
                d0 = operandes[-1][1] if operandes else debut
                retraits.append((d0, fin, nom, "texte"))
                journal.append(("texte", nom, x, top))
        elif op == "Do" and operandes and operandes[-1][0] == "nom":
            # Rectangle occupe par l'image : l'espace unitaire [0,1]x[0,1]
            # transforme par la CTM.
            coins = [mul(ctm, p) for p in ((0, 0), (1, 0), (0, 1), (1, 1))]
            xs = [c[0] for c in coins]
            ys = [hauteur - c[1] for c in coins]
            cx, ctop = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            nom = dans(ZONES_IMAGE, cx, ctop)
            if nom:
                retraits.append((operandes[-1][1], fin, nom, "image"))
                journal.append(("image", nom, cx, ctop))

        operandes = []

    out = bytearray()
    curseur = 0
    for d0, f0, _nom, _g in sorted(retraits):
        if d0 < curseur:
            continue
        out += data[curseur:d0]
        curseur = f0
    out += data[curseur:]
    return bytes(out), journal


def main() -> int:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import DecodedStreamObject

    if not os.path.exists(SOURCE):
        print("source introuvable : %s" % SOURCE)
        return 1

    lecteur = PdfReader(SOURCE)
    page = lecteur.pages[0]
    hauteur = float(page.mediabox.height)
    flux = page.get_contents()
    data = flux.get_data()

    propre, journal = neutraliser(data, hauteur)

    print("gabarit source : %s" % SOURCE)
    print("flux de contenu : %d octets  ->  %d octets" % (len(data), len(propre)))
    print()
    print("%d element(s) retire(s) :" % len(journal))
    for genre, nom, x, top in journal:
        print("  %-6s %-28s x=%6.1f  top=%6.1f" % (genre, nom, x, top))
    print()

    # `flux.set_data()` modifierait un objet DETACHE de la page : le flux
    # rendu par `get_contents()` est une recomposition. `replace_contents`
    # est ce qui reecrit reellement /Contents.
    nouveau = DecodedStreamObject()
    nouveau.set_data(propre)
    page.replace_contents(nouveau)
    ecrivain = PdfWriter()
    ecrivain.add_page(page)
    with io.open(SORTIE, "wb") as f:
        ecrivain.write(f)
    print("gabarit neutre ecrit : %s (%d octets)" % (SORTIE, os.path.getsize(SORTIE)))
    print()

    # ── Verification : ce qui doit avoir disparu, ce qui doit survivre ──
    import pdfplumber

    with pdfplumber.open(SORTIE) as pdf:
        texte = pdf.pages[0].extract_text() or ""
        nb_images = len(pdf.pages[0].images)

    ko = 0
    print("--- l'identite ne doit plus etre extractible ---")
    for s in SONDES_INTERDITES:
        present = s.lower() in texte.lower()
        if present:
            ko += 1
        print("  %-24s %s" % (s, "ENCORE PRESENT" if present else "retire"))

    print()
    print("--- le design doit avoir survecu ---")
    for s in SONDES_ATTENDUES:
        present = s.lower() in texte.lower()
        if not present:
            ko += 1
        print("  %-24s %s" % (s, "present" if present else "DISPARU"))

    print()
    print("images : %d (3 dans la source, 1 attendue : la photo)" % nb_images)
    if nb_images != 1:
        ko += 1

    # ── Manifeste : la preuve voyage avec l'artefact ────────────────
    #
    # Le gabarit neutre est un BINAIRE versionne. Rien, dans le depot, ne
    # dirait qu'il a ete remplace par un fichier qui porte encore l'identite
    # d'OPTIMIVV. Le manifeste enregistre les empreintes des deux fichiers et
    # le resultat de la verification ; la suite `gabarits.ts` les recontrole a
    # chaque execution de `npm run check:devis`.
    import hashlib
    import json
    import datetime

    def md5(p):
        return hashlib.md5(io.open(p, "rb").read()).hexdigest()

    manifeste = {
        "genere_par": "scripts/gabarit-neutre/neutraliser.py",
        "genere_le": datetime.date.today().isoformat(),
        "source": SOURCE,
        "source_md5": md5(SOURCE),
        "neutre": SORTIE,
        "neutre_md5": md5(SORTIE),
        "elements_retires": [
            {"genre": g, "zone": n, "x": round(x, 1), "top": round(top, 1)}
            for g, n, x, top in journal
        ],
        "sondes_interdites": SONDES_INTERDITES,
        "sondes_interdites_absentes": ko == 0,
        "sondes_attendues": SONDES_ATTENDUES,
        "images_restantes": nb_images,
    }
    with io.open(MANIFESTE, "w", encoding="utf-8") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("manifeste ecrit : %s" % MANIFESTE)

    print()
    print("VERDICT : " + ("tout est conforme" if ko == 0 else "%d probleme(s)" % ko))
    return 0 if ko == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
