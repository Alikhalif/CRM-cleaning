-- Règle « prise en charge » du moteur d'actions (audit 2026-10-15).
--
-- ANOMALIE CORRIGÉE : un lead qui arrive et que personne ne touche ne générait
-- AUCUNE action. Le scénario « découverte » exige qu'un appel ait déjà été
-- passé (lastCallAt > 0) : il ne couvre donc que les dossiers déjà entamés.
-- Résultat mesuré sur la base : 437 leads au statut « lead » sans la moindre
-- action, dont 79 arrivés dans les 7 derniers jours — invisibles dans
-- « Ma journée ».
--
-- Délai initial : 30 minutes après l'arrivée. Volontairement court — c'est la
-- réactivité sur un lead frais qui fait la conversion — et modifiable depuis
-- l'écran de configuration des actions comme les quatre autres règles.

insert into commercial_action_rules (key, label, enabled, config)
select 'prise_en_charge', 'Prise en charge d''un nouveau lead', true,
       '{"after_minutes": 30}'::jsonb
where not exists (select 1 from commercial_action_rules where key = 'prise_en_charge');

comment on table commercial_action_rules is
  'Règles du moteur d''actions commerciales. prise_en_charge = lead non traité ; decouverte = appel sans découverte ; photos = photos demandées non reçues ; devis = découverte sans devis ; relance = devis envoyé sans réponse.';
