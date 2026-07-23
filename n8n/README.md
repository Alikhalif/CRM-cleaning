# n8n workflows

| Workflow | Fichier | Rôle |
|---|---|---|
| **WF1** | `WF1.json` | Capture des leads : formulaires des landing pages → CRM + email de notification |
| **WF2** | `WF2.json` | Relance devis : séquence de 4 emails |

---

# WF1 — Capture lead (landing pages → CRM + email)

Un seul webhook pour **toutes** les landing pages. Il normalise le formulaire, le signe, l'envoie au CRM, puis vous notifie par email.

```
Formulaire LP ──► Webhook ──► Normaliser ──► champs OK ? ──non──► 400
                                                 │oui
                                                 ▼
                                     Signer (HMAC) ──► POST CRM ──► 200 ? ──non──► 502
                                                                      │oui
                                                                      ▼
                                                              Email de notif ──► 200
```

Le CRM applique ensuite ses **règles de routing** (superficie, secteur, source, premium, extrême) pour attribuer le lead au bon commercial. Rien à configurer côté n8n pour ça.

## Install (3 étapes)

**Aucune variable d'environnement** — tout se règle dans l'interface n8n (pensé pour une install npm/pm2 sans Docker).

### 1. Importer

n8n → *Workflows* → *Import from File* → `WF1.json`.

### 2. Remplir 3 réglages dans l'UI

| Nœud | Réglage |
|---|---|
| **Signer (HMAC SHA256)** → champ *Secret* | remplacer `REMPLACER_PAR_LEADS_INBOUND_SECRET` par la valeur exacte de `LEADS_INBOUND_SECRET` (celle du `.env.local` et de Vercel) |
| **M'envoyer un email** → *Credential* | créer/choisir une credential **Header Auth** nommée `Brevo API key` — Name `api-key`, Value = clé Brevo v3 *(la même que WF2 : elle se réutilise)* |
| **M'envoyer un email** → *JSON Body* | remplacer les deux `REMPLACER…@ton-domaine.fr` : expéditeur **vérifié dans Brevo** + adresse de réception |

> Le secret **doit être identique des deux côtés** : n8n signe le corps en HMAC-SHA256 (hex), le CRM recalcule et compare. Secret différent ⇒ `401 invalid_signature`.

L'URL du CRM est déjà écrite en dur dans le nœud *POST vers le CRM* (`https://crm-cleaning-one.vercel.app`) — à modifier si tu déploies ailleurs.

Puis **Activer** le workflow (toggle en haut à droite). L'URL du webhook devient `https://n8n.srv1688718.hstgr.cloud/webhook/lead-capture`.

### 3. Brancher les landing pages

Toutes les LP postent sur cette même URL :

```html
<form method="POST" action="https://n8n.srv1688718.hstgr.cloud/webhook/lead-capture">
  <input name="prenom"   required>
  <input name="nom"      required>
  <input name="telephone" required>   <!-- obligatoire -->
  <input name="email"    type="email">
  <input name="code_postal">
  <input name="ville">
  <input name="surface">              <!-- alimente la règle « superficie > 80 m² » -->
  <textarea name="message"></textarea>
  <input type="hidden" name="activity_slug" value="nettoyage">
  <input type="hidden" name="source_slug"   value="site_web">
  <button type="submit">Demander un devis</button>
</form>
```

## Champs acceptés

Le nœud *Normaliser* est **tolérant** : inutile de renommer les champs de vos LP existantes.

| Champ CRM | Alias acceptés |
|---|---|
| `phone` **(obligatoire)** | `telephone`, `tel`, `mobile`, `numero` |
| `first_name` / `last_name` | `prenom` / `nom`, `firstname` / `lastname` |
| `email` | `mail`, `e-mail` |
| `postal_code` / `city` | `code_postal`, `cp`, `zip` / `ville` |
| `surface_m2` | `surface`, `m2`, `superficie` |
| `type_service` | `service_type`, `type_prestation`, `formule` — sous-type libre (ex. « longue distance ») |
| `notes` | `message`, `commentaire`, `demande` |
| `activity_slug` | `activity`, `prestation`, `service` — défaut `nettoyage` |
| `source_slug` | `source`, `utm_source` (+ alias `google`→`google_ads`, `facebook`→`meta_ads`…) — défaut `site_web` |

Traitements automatiques : téléphone → E.164 (`06…` → `+336…`), email en minuscules, `gclid` + `utm_*` transmis (conversions Google Ads), `external_id` généré → **anti-doublon** côté CRM.

`activity_slug` valides : `urgence`, `nettoyage`, `enr`, `renovation`, `debarras`, `demenagement`.

## Vérifier

```bash
curl -X POST https://n8n.srv1688718.hstgr.cloud/webhook/lead-capture \
  -H "Content-Type: application/json" \
  -d '{"prenom":"Jean","nom":"Dupont","telephone":"0612345678",
       "email":"jean@example.com","ville":"Bordeaux","surface":"120",
       "activity_slug":"demenagement","source_slug":"site_web",
       "message":"Test WF1"}'
```

Attendu : `{"ok":true,"id":"…","short_id":"L-…"}`, le lead visible dans le CRM, et l'email reçu.

| Réponse | Cause |
|---|---|
| `400 champs manquants` | téléphone ou nom absent |
| `502` + `invalid_signature` | `LEADS_INBOUND_SECRET` différent entre n8n et le CRM |
| `502` + `invalid_activity_slug` | secteur inconnu |

---

# WF2 — Relance Devis (n8n)

4-email follow-up sequence triggered when a devis is sent. One importable workflow, two credentials, two status-driven endpoints on the CRM side.

## What it does

```
CRM trigger ──► E1 ──► wait 24h ──► check ──► E2 ──► wait 72h ──► check ──► E3 ──► wait 120h ──► check ──► E4 ──► done
                                       │                            │                              │
                                       └─ active=false → stop ──────┴──────────────────────────────┘
```

Between each email the workflow calls `GET /api/leads/:id/status`. The endpoint returns `{ status, sub_envoi, active }` where `active = status NOT IN (signe, perdu, encaisse) AND sub_envoi = 'auto'`. If `active` is false, the workflow exits cleanly. No state DB — the CRM is the source of truth.

## Files

| File | Purpose |
|---|---|
| `WF2.json` | The single n8n workflow. Import it, set credentials, activate. |
| `../app/api/leads/[id]/status/route.ts` | Endpoint the workflow polls between emails. Already wired. |
| `../app/api/leads/[id]/route.ts` | PATCH endpoint the workflow calls at the start to mark `status=envoye`. Already wired. |

## 3-step install

### 1. Set env vars

On the **n8n** host (Settings → Variables, or `.env` if self-hosted):

```bash
CRM_BASE_URL=https://crm.example.com
WF2_TRIGGER_SECRET=<openssl rand -hex 32>   # CRM sends this in X-Trigger-Secret
BREVO_TPL_E1=12
BREVO_TPL_E2=13
BREVO_TPL_E3=14
BREVO_TPL_E4=15
```

On the **CRM** host:

```bash
N8N_TO_CRM_BEARER=<openssl rand -hex 32>           # n8n sends this in Authorization: Bearer …
N8N_WF2_TRIGGER_URL=https://n8n.srv1688718.hstgr.cloud/webhook/relance-devis
N8N_WF2_TRIGGER_SECRET=<same value as WF2_TRIGGER_SECRET above>
```

Restart both.

### 2. Create 2 credentials in n8n

n8n UI → **Credentials → New** — names must match exactly:

| Name | Type | Value |
|---|---|---|
| **CRM Bearer** | Header Auth | Name `Authorization`, Value `Bearer <N8N_TO_CRM_BEARER>` |
| **Brevo API key** | Header Auth | Name `api-key`, Value `<your Brevo v3 API key>` |

### 3. Import the workflow

n8n UI → top-right **+** → **Import from File** → pick `n8n/WF2.json` → **Save** → flip the **Active** toggle.

Copy the webhook URL shown on the trigger node — that's what `N8N_WF2_TRIGGER_URL` should point to.

## Auto / Manuel buttons (CRM)

The lead-detail header shows a two-button segmented control once a devis is sent:

| Button | What it does |
|---|---|
| **Automatique** | Sets `sub_envoi='auto'` + POSTs to the n8n trigger. The workflow runs E1 → E2 → E3 → E4 with status checks between each. |
| **Manuel** | Sets `sub_envoi='mano'`. **This is the interrupt.** The workflow's next status check (within 24h–120h) sees `active=false` and exits cleanly. No more emails sent. |

The interrupt is *eventually consistent* by design: between Manuel and the actual workflow exit, up to 5 days can elapse, but **no further emails go out in that window** — the workflow is suspended in a Wait node, and the very first thing it does after waking is poll the status endpoint. The UI flips to "Manuel" instantly.

**Edge case:** pressing Manuel then Automatique again *before the previous workflow has reached its next check* will spawn a parallel execution. The CRM refuses Auto when `sub_envoi='auto'` already, but cannot tell whether the previous run is still asleep. Rare in practice (windows are 24h / 72h / 120h).

## Trigger payload

```http
POST https://n8n.srv1688718.hstgr.cloud/webhook/relance-devis
X-Trigger-Secret: <WF2_TRIGGER_SECRET>
Content-Type: application/json

{
  "lead_id": "uuid-here",
  "client_email": "client@example.com",
  "client_first_name": "Jean",
  "commercial_name": "Marie Dupont",
  "quote_url": "https://sign.example.com/q/abc123",
  "quote_ref": "DEV-2026-0042"
}
```

## Brevo templates

Create 4 transactional templates in Brevo (Transactional → Templates → New). Each must accept these params:

- `{{ params.FIRST_NAME }}`
- `{{ params.COMMERCIAL_NAME }}`
- `{{ params.QUOTE_URL }}`
- `{{ params.QUOTE_REF }}`

Suggested subject lines:

| Template | When | Subject |
|---|---|---|
| E1 | J+0 | `Votre devis {{ params.QUOTE_REF }} — accès direct` |
| E2 | J+1 | `Toujours intéressé(e) ? Votre devis vous attend` |
| E3 | J+4 | `Dernière relance — votre devis expire bientôt` |
| E4 | J+9 | `Votre devis expire ce soir` |

> **Cadence note.** The CDC specifies J+0/J+3/J+7/J+14, the n8n PDF says J+0/J+1/J+3/J+4. This workflow uses 24h / 72h / 120h waits (= 9 days total). To switch to CDC cadence: change the Wait nodes to **72h / 168h / 336h** (= 14 days total).

## Verification

```bash
# Should reject without the secret:
curl -i -X POST "https://n8n.srv1688718.hstgr.cloud/webhook/relance-devis" \
  -H "Content-Type: application/json" -d '{}'
# → 500 with "UNAUTHORIZED" in the response

# Should accept with the secret (use a real test lead UUID):
curl -i -X POST "https://n8n.srv1688718.hstgr.cloud/webhook/relance-devis" \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: $WF2_TRIGGER_SECRET" \
  -d '{
    "lead_id": "00000000-0000-0000-0000-000000000000",
    "client_email": "you@yourdomain.com",
    "client_first_name": "Test"
  }'
```

Then watch **n8n → Executions** — you should see the run in progress with the first Wait node ticking.

## Killing a running sequence

- **From the CRM** — press the **Manuel** button on the lead. Workflow exits at next check.
- **From n8n** — Executions tab → find the row → **Stop** (instant).
- **From SQL** — drag the lead to `perdu` in the Kanban. Same effect as Manuel: next check returns `active=false`.
