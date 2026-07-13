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
N8N_WF2_TRIGGER_URL=https://n8n.example.com/webhook/relance-devis
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
POST https://n8n.example.com/webhook/relance-devis
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
curl -i -X POST "https://n8n.example.com/webhook/relance-devis" \
  -H "Content-Type: application/json" -d '{}'
# → 500 with "UNAUTHORIZED" in the response

# Should accept with the secret (use a real test lead UUID):
curl -i -X POST "https://n8n.example.com/webhook/relance-devis" \
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
