-- Bibliothèque de devis Déménagement — 3. Transport spécialisé.
-- « Transport de coffre-fort ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Transport de coffre-fort', 'forfait', 0, 20, $D$Prestation à réaliser :
Prise en charge de la manutention et du transport d'un coffre-fort dans le cadre d'un déménagement, comprenant les opérations de protection, de manutention spécialisée, de chargement, de transport sécurisé, de déchargement et de mise en place à l'emplacement indiqué par le client.

Prestations incluses :
- Protection du coffre-fort avant les opérations de manutention.
- Utilisation de matériel professionnel adapté aux charges lourdes.
- Manutention réalisée par des opérateurs qualifiés.
- Chargement et déchargement sécurisés.
- Transport jusqu'au lieu de destination.
- Mise en place du coffre-fort selon les indications du client.

Conditions d'intervention :
Cette option complète le devis principal et est établie sur la base des informations communiquées concernant le poids, les dimensions, les accès et les contraintes de manutention.
Le client s'engage à signaler toute particularité pouvant nécessiter des moyens techniques spécifiques. Toute information non communiquée lors de l'établissement du devis pourra entraîner une réévaluation de cette option après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
