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

> **⚠️ CORRIGÉ LE 2026-11-08 — la version précédente de cette section ne
> pouvait pas authentifier.**
>
> Elle écrivait `-H "x-cron-secret=%i"`, avec un **signe égal** au lieu de
> `: `. Mesuré contre un serveur d'écho :
>
> ```
> -H "x-cron-secret: SECRET"   →  en-tête reçu
> -H "x-cron-secret=SECRET"    →  AUCUN en-tête — curl l'abandonne en silence
> ```
>
> Une installation qui a suivi l'ancienne version **n'envoie aucun secret** :
> la route répond `403` et le moteur d'alertes ne tourne pas, sans qu'aucun
> message ne le dise. Second défaut de la même ligne : `%i` ne s'étend que
> dans une unité *template* (`nom@.service`) — dans une unité simple il
> n'était pas substitué.
>
> **Si votre VPS utilise un timer systemd, vérifiez-le** avec les commandes de
> l'étape 3 bis ci-dessous avant de supposer que le cron fonctionne.

Le secret passe par un `EnvironmentFile`, jamais en clair dans l'unité.

`/etc/cgk-crm/evaluate.env` (droits `600`, propriétaire `root`) :
```ini
CRON_SECRET=le_meme_secret_que_PRESENCE_CRON_SECRET
```

`/etc/systemd/system/crm-evaluate.service` :
```ini
[Unit]
Description=CRM — évaluation alertes/relances
[Service]
Type=oneshot
EnvironmentFile=/etc/cgk-crm/evaluate.env
# L'en-tête exige « Nom: valeur ». Sans les deux-points, curl abandonne
# l'en-tête SANS erreur, et l'appel part non authentifié.
ExecStart=/usr/bin/curl -fsS -X POST http://127.0.0.1:3000/api/presence/evaluate -H "x-cron-secret: ${CRON_SECRET}"
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

## Étape 3 bis — vérifier la configuration RÉELLEMENT en place (lecture seule)

> Ajoutée le 2026-11-08. Elle existe parce que trois formes d'appel se
> ressemblent et qu'une seule des trois fonctionne. Les quatre commandes
> **lisent** et ne modifient rien : elles n'interrompent pas le service.

```bash
# 1. Une tâche cron appelle-t-elle la route, et sous quelle forme ?
crontab -l 2>/dev/null | grep -i evaluate

# 2. Un timer systemd le fait-il ?
systemctl list-timers --all 2>/dev/null | grep -i -E "crm|evaluate"

# 3. Si un timer existe, comment appelle-t-il exactement ?
systemctl cat crm-evaluate.service 2>/dev/null | grep -i execstart

# 4. La route a-t-elle refusé des appels récemment ?
#    (adapter le nom du conteneur ; -S limite aux dernières 24 h)
docker compose logs --since 24h crm 2>/dev/null | grep -i "presence.evaluate"
```

### Lire le résultat

| Ce que la sortie montre | Diagnostic | Action |
| --- | --- | --- |
| `-H "x-cron-secret: …"` | ✅ forme correcte | Rien. Poser `CGK_CRON_SECRET_URL=refuse` dans l'environnement du CRM ferme définitivement le chemin par URL. |
| `?secret=…` dans l'URL | ⚠️ forme tolérée, mais le secret finit dans les journaux du proxy | Corriger la ligne **d'abord**, poser la variable **ensuite**. L'ordre inverse coupe le moteur. |
| `-H "x-cron-secret=…"` (sans deux-points) | 🔴 **le cron n'a jamais authentifié** | Corriger selon l'Option A bis ci-dessus. Cela expliquerait des alertes et des relances jamais déclenchées. |
| Aucune des quatre commandes ne renvoie rien | 🔴 **aucun appel périodique n'est configuré** | Poser l'Option A. Sans elle, rien ne se déclenche jamais seul. |
| Des lignes `secret_en_url_refuse` ou `forbidden` dans les journaux | 🔴 les appels sont rejetés | Comparer le secret appelant et `PRESENCE_CRON_SECRET` côté serveur. |

**Ne collez pas la sortie brute de la commande 3 ou 4 dans un message** : elle
peut contenir le secret en clair si l'appel le passe en dur. Remplacez la
valeur par `<SECRET>` avant de la transmettre — seule la **forme** de l'appel
importe pour le diagnostic.

## Notes

- Les trois passes sont **isolées** (try/catch chacune) : un échec d'une passe
  n'empêche plus les autres de s'exécuter (correctif A07).
- Le cron peut aussi être déclenché manuellement par un Super Admin connecté
  (bouton « Rafraîchir » de `/presence`) — pratique de secours, pas un
  remplacement du planificateur.
