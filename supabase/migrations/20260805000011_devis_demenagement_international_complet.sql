-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet international ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet international', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier complet à l'international comprenant la manutention, le chargement, le transport sécurisé des biens jusqu'au pays de destination, le déchargement ainsi que la mise en place du mobilier, des effets personnels, des cartons et de l'électroménager dans le nouveau logement.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des équipements durant les opérations de transport.
- Chargement organisé du véhicule ou du moyen de transport adapté.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens.
- Mise en place du mobilier et des cartons dans les pièces désignées par le client.
- Coordination logistique de l'opération de déménagement en fonction du pays de destination.
- Utilisation de matériel professionnel et de moyens de transport adaptés au volume et aux contraintes du déménagement.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les adresses de départ et d'arrivée, les conditions d'accès, les possibilités de stationnement, les distances de portage ainsi que les contraintes logistiques propres au pays de destination.
Les éventuels frais administratifs, douaniers, taxes locales, autorisations spécifiques ou formalités imposées par les autorités compétentes ne sont pas inclus, sauf mention contraire figurant au devis.
Toute modification des informations communiquées lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
