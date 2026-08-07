-- Bibliothèque de devis Déménagement — 3. Transport spécialisé.
-- « Transport de piano ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Transport de piano', 'forfait', 0, 20, $D$Prestation à réaliser :
Prise en charge de la manutention et du transport d'un piano dans le cadre d'un déménagement, comprenant les opérations de protection, de manutention spécialisée, de chargement, de transport sécurisé, de déchargement et de mise en place à l'emplacement indiqué par le client.

Prestations incluses :
- Protection renforcée du piano avant toute manipulation.
- Manutention réalisée par des opérateurs qualifiés.
- Utilisation de matériel professionnel adapté au transport d'instruments de musique lourds et volumineux.
- Chargement et déchargement sécurisés.
- Transport jusqu'au lieu de destination.
- Mise en place du piano à son emplacement définitif selon les indications du client.

Conditions d'intervention :
Cette option complète le devis principal et s'applique à tout type de piano (droit, à queue ou autre modèle), sous réserve de faisabilité technique.
Le client s'engage à communiquer les caractéristiques du piano, son poids approximatif ainsi que les conditions d'accès aux lieux de départ et d'arrivée. Toute difficulté d'accès non signalée, toute manutention exceptionnelle ou tout moyen technique supplémentaire nécessaire pourra entraîner une réévaluation de cette option après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
