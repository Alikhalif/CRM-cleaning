# Cron d'évaluation des alertes & relances — runbook

> Correctif recette **A02** (P1). Sans planificateur, tout le module « Actions &
> Relances », l'alerte « Photos », les alertes de présence et l'alerte
> d'expiration des contrats **ne se déclenchent jamais seuls** — uniquement
> quand un Super Admin ouvre `/presence` et clique « Rafraîchir ».

## Ce qu'il faut

Un appel HTTP récurrent (toutes les **1 à 2 minutes**) vers :

```
POST https://<domaine-crm>/api/presence/evaluate
En-tête :  x-cron-secret: <PRESENCE_CRON_SECRET>
```

L'endpoint est **borné** (requêtes limitées, idempotentes via reconcile) : le
lancer toutes les 2 min n'a aucun impact sur les performances du CRM. Il exécute
en une passe, chacune isolée : présence + alertes → actions/relances
commerciales → alertes documents/contrats.

## Étape 1 — définir le secret

Génère une chaîne aléatoire longue et pose-la dans l'environnement du conteneur
CRM (docker-compose `environment:` ou `.env`) :

```
PRESENCE_CRON_SECRET=<colle-ici-une-longue-chaîne-aléatoire>
```

Redéploie le conteneur pour qu'il prenne la variable.
> Tant que `PRESENCE_CRON_SECRET` est vide, la branche « secret » ne peut jamais
> autoriser l'appel : le cron recevra 403. Il faut donc bien la définir.

## Étape 2 — planifier l'appel (choisis UNE option)

### Option A — crontab de l'hôte (recommandée pour un VPS Docker Compose)

La plus simple et la plus robuste : elle ne dépend pas de n8n. Sur l'hôte,
`crontab -e` puis (toutes les 2 minutes) :

```cron
*/2 * * * * curl -fsS -X POST http://127.0.0.1:3000/api/presence/evaluate -H "x-cron-secret: LE_MEME_SECRET" >/dev/null 2>&1
```

Adapte `127.0.0.1:3000` au port/host réellement exposé par le conteneur CRM
(ou au nom de service Docker si le cron tourne dans un conteneur du même réseau).

### Option A bis — systemd timer (équivalent, avec logs)

`/etc/systemd/system/crm-evaluate.service` :
```ini
[Unit]
Description=CRM — évaluation alertes/relances
[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS -X POST http://127.0.0.1:3000/api/presence/evaluate -H "x-cron-secret=%i"
```
`/etc/systemd/system/crm-evaluate.timer` :
```ini
[Unit]
Description=CRM — évaluation toutes les 2 min
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
```
Puis `systemctl enable --now crm-evaluate.timer`.
(Passe le secret via un EnvironmentFile plutôt qu'en clair dans l'unit.)

### Option B — n8n (si tu préfères tout centraliser dans n8n)

Nouveau workflow à 2 nœuds :
1. **Schedule Trigger** — intervalle : every 2 minutes.
2. **HTTP Request** — Method `POST`, URL `https://<domaine-crm>/api/presence/evaluate`,
   Header `x-cron-secret` = `{{$env.PRESENCE_CRON_SECRET}}` (ou la valeur en dur
   dans un credential). Active le workflow.

## Étape 3 — vérifier

Appelle l'endpoint une fois à la main :

```bash
curl -i -X POST https://<domaine-crm>/api/presence/evaluate -H "x-cron-secret: LE_SECRET"
```

Attendu : `200` avec un JSON `{ ...présence, commercial: {...}, documents: {...} }`.
Un `403 forbidden` = secret manquant/incorrect côté serveur ou côté appel.

Ensuite, ouvre `/ma-journee` : les actions (découverte/devis/relance/photos)
doivent apparaître et se clôturer automatiquement au fil des cycles, et
`/presence` doit lister les alertes ouvertes sans clic manuel.

## Notes

- Les trois passes sont **isolées** (try/catch chacune) : un échec d'une passe
  n'empêche plus les autres de s'exécuter (correctif A07).
- Le cron peut aussi être déclenché manuellement par un Super Admin connecté
  (bouton « Rafraîchir » de `/presence`) — pratique de secours, pas un
  remplacement du planificateur.
