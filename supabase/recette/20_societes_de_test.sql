-- ============================================================================
-- SOCIÉTÉS FICTIVES DE RECETTE — séries de factures (D26) — RECETTE UNIQUEMENT
--
-- ⚠️ Pas une migration. À jouer À LA MAIN dans l'éditeur SQL de la RECETTE,
-- après 00_marqueur_environnement.sql, avant `npm run recette:facturation`.
--
-- Une série ne s'active que par `activer_serie_societe()`, qu'aucun rôle
-- applicatif ne peut appeler (instruction du client : aucune activation sans
-- validation explicite). Le test de concurrence ne peut donc PAS activer
-- lui-même les séries qu'il éprouve : ce script le fait, pour des sociétés
-- FICTIVES, et le dit dans la justification.
--
--   TSTCONC, TSTFR, TSTCH, TSTLU, TSTBE, TSTCA → préparées ET activées
--   TSTVERROU                                  → préparée, NON activée : le
--                                                test vérifie qu'elle continue
--                                                la série historique.
-- ============================================================================

do $verrou$
begin
  if to_regclass('public.cgk_environnement') is null
     or not exists (select 1 from public.cgk_environnement where nom = 'recette') then
    raise exception 'REFUS : marqueur de recette absent. Cette base n''est pas la recette — rien n''a été modifié.';
  end if;
end;
$verrou$;

insert into legal_entities (legal_name, legal_form, siret, address, country, code_numerotation, numerotation_depuis)
select v.nom, 'SAS', '00000000000000', jsonb_build_object('line1', '1 rue du Test', 'postal_code', '00000', 'city', 'Test'),
       v.pays, v.code,
       (now() at time zone case v.pays when 'CA' then 'America/Toronto' else 'Europe/Paris' end)::date
  from (values
    ('SOCIÉTÉ FICTIVE — TEST CONCURRENCE', 'FR', 'TSTCONC'),
    ('SOCIÉTÉ FICTIVE FR — TEST', 'FR', 'TSTFR'),
    ('SOCIÉTÉ FICTIVE CH — TEST', 'CH', 'TSTCH'),
    ('SOCIÉTÉ FICTIVE LU — TEST', 'LU', 'TSTLU'),
    ('SOCIÉTÉ FICTIVE BE — TEST', 'BE', 'TSTBE'),
    ('SOCIÉTÉ FICTIVE CA — TEST', 'CA', 'TSTCA'),
    ('SOCIÉTÉ FICTIVE — SÉRIE NON ACTIVÉE', 'FR', 'TSTVERROU')
  ) as v(nom, pays, code)
 where not exists (select 1 from legal_entities e where e.code_numerotation = v.code);

select activer_serie_societe(e.id, 'Recette — sociétés fictives',
         'Activation des séries de sociétés FICTIVES de recette, pour éprouver la numérotation.')
  from legal_entities e
 where e.code_numerotation in ('TSTCONC', 'TSTFR', 'TSTCH', 'TSTLU', 'TSTBE', 'TSTCA')
   and e.serie_activee_le is null;

-- Vérification : six activées, TSTVERROU non activée.
select code_numerotation, country, numerotation_depuis, serie_activee_le is not null as activee
  from legal_entities where code_numerotation like 'TST%' order by code_numerotation;
