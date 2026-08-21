# Devis OPTIMIVV — générateur PDF autonome

Génère un devis PDF A4 **pixel-perfect** (déménagement / débarras / intervention
spécialisée), l'affiche en aperçu et l'envoie au client. Port fidèle de la
maquette de référence `devis_generator.py` (reportlab) vers TypeScript/pdfkit —
**le design est figé** : toute différence de mise en page est un bug.

## Fichiers

| Chemin | Rôle |
|---|---|
| `lib/devis/layout.ts` | Système de coordonnées (X/YT/W/FS), palette, `safe()`, `euro()`, résolution des polices/images |
| `lib/devis/icons.ts` | 18 icônes vectorielles + adaptateur graphique (mêmes primitives que reportlab) |
| `lib/devis/render.ts` | `genererDevisBuffer(data)` → `Promise<Buffer>` — le cœur du rendu |
| `lib/devis/types.ts` | Type `Devis`/`DevisInput`, défauts, `buildDevis()` |
| `lib/devis/numero.ts` | Allocation du numéro `AAAA-00001` (RPC gapless) — **server-only** |
| `lib/devis/archive.ts` | Archive du PDF exact (bucket privé) + ligne liée à l'affaire — **server-only** |
| `lib/devis/email.ts` | Envoi SMTP (nodemailer) — **server-only** |
| `lib/devis/prefill.ts` | Préremplissage depuis une affaire (RLS-scopé) — **server-only** |
| `app/api/devis/route.ts` | `POST` → PDF (mode `preview` = sans numéro/archive ; `final` = numéro + archive) |
| `app/api/devis/envoyer/route.ts` | `POST` → génère + envoie + archive, renvoie du JSON |
| `app/(app)/devis/nouveau/` | UI : formulaire + aperçu iframe (debounce 600 ms) + Télécharger + Envoyer |
| `public/devis-assets/` | `logo.png`, `photo.jpg`, `fonts/*.ttf` (Poppins + Chorus) |
| `supabase/migrations/20260807000020_devis_optimivv.sql` | Compteur gapless, table d'archive, bucket |
| `scripts/devis-compare/` | Harnais de régression visuelle (voir son README) |

## Configuration (variables d'environnement)

Secrets **par variables d'environnement uniquement**, jamais en dur. L'envoi
utilise **Brevo par défaut** (déjà configuré dans le CRM — aucun secret
supplémentaire), avec **repli SMTP** si Brevo est absent :

```
# Canal 1 — Brevo (défaut, si BREVO_API_KEY présent)
DEVIS_SENDER_EMAIL=devispro@optimivv-nettoyage.com  # optionnel — sinon BREVO_SENDER_EMAIL (doit être vérifié dans Brevo)
DEVIS_SENDER_NAME=OPTIMIVV Déménagement             # optionnel

# Canal 2 — SMTP (repli, ou forcé via DEVIS_EMAIL_TRANSPORT=smtp)
SMTP_HOST=smtp.hostinger.com        # défaut Hostinger
SMTP_PORT=465                       # 465 = SSL ; 587 = STARTTLS
SMTP_USER=devispro@optimivv-nettoyage.com
SMTP_PASS=********
SMTP_FROM_NAME=OPTIMIVV Déménagement
SMTP_BCC=archive@…                  # optionnel : copie cachée d'archive

DEVIS_ASSETS_DIR=                   # optionnel : override du dossier assets
```

> `lib/devis/email.ts` route via **Brevo** (`sendBrevoEmail`, pièce jointe PDF)
> dès que `BREVO_API_KEY` est défini — cohérent avec le reste du CRM. Sans Brevo
> (ou avec `DEVIS_EMAIL_TRANSPORT=smtp`), il bascule sur **nodemailer/SMTP**
> comme prévu au cahier des charges. ⚠️ L'expéditeur doit être un **expéditeur
> vérifié** dans Brevo, sinon l'API renvoie « Sender not valid ».

## Numérotation (sans trou — exigence comptable)

Séquence **en base** (`next_devis_optimivv_num`, `SECURITY DEFINER`, verrou de
ligne) au format `2026-00001`, remise à 1 chaque année. Un numéro n'est **consommé
qu'à l'émission réelle** (Télécharger / Envoyer) — jamais à l'aperçu. Deux appels
concurrents obtiennent deux numéros distincts et consécutifs ; un redéploiement
ne remet pas le compteur à zéro.

## Archive

Chaque devis émis est archivé : le **PDF binaire exact** (pièce qui fait foi) dans
le bucket privé `devis-optimivv`, plus une ligne `devis_optimivv` liée à l'affaire
(`lead_id`). Jamais d'URL publique — accès par URL signée (TTL court).

## Sécurité

- Les deux routes vérifient la session (`supabaseServer().auth.getUser()`) : un
  endpoint de génération ouvert permettrait d'émettre un e-mail signé au nom de
  l'entreprise.
- L'aperçu (`mode: "preview"`) ne consomme ni numéro ni archive.
- L'envoi demande une **confirmation** affichant le destinataire en clair.

## Critères d'acceptation — état

| # | Critère | État |
|---|---|---|
| 1 | Rendu identique au pixel près (payload vide + variantes) | ✅ 0,002 % de pixels (AA d'icônes), voir `scripts/devis-compare` |
| 2 | Texte sélectionnable/cherchable, seuls logo/photo en image | ✅ (2688 caractères extraits) |
| 3 | Accents FR corrects (é è à ç É ° € «) | ✅ |
| 4 | Deux appels concurrents → numéros distincts consécutifs | ✅ RPC gapless en base |
| 5 | Poids PDF < 400 Ko | ⚠️ ~580 Ko — dominé par `logo.png`/`photo.jpg` embarqués (la référence Python fait déjà 746 Ko). Priorité donnée à la **contrainte absolue #1** ; passer sous 400 Ko impose de ré-échantillonner le logo à sa taille d'affichage, ce qui introduit un micro-écart au pixel. Décision volontairement laissée ouverte. |
| 6 | `next build` sans warning TypeScript | ✅ `tsc --noEmit` : 0 erreur, build OK |

## Utilisation

- Depuis une affaire : `/devis/nouveau?affaire=<id|short_id>` (préremplit client,
  adresse, téléphone, e-mail — lecture RLS-scopée).
- À blanc : `/devis/nouveau`.
