-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet dans le cadre d'une succession ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet dans le cadre d''une succession', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier complet dans le cadre d'une succession, comprenant la manutention, le chargement, le transport sécurisé, le déchargement ainsi que la mise en place de l'ensemble du mobilier, des effets personnels, des cartons, de l'électroménager et des biens conservés vers l'adresse désignée par le client.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des objets durant les opérations de manutention et de transport.
- Chargement organisé du mobilier, des cartons, des effets personnels et des équipements.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des cartons dans les pièces indiquées par le client.
- Utilisation de matériel professionnel adapté afin de garantir le bon déroulement de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les accès aux lieux de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La prestation concerne exclusivement les biens destinés à être transférés. Les prestations de débarras, d'évacuation, de tri ou de mise en déchetterie ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, du volume des biens ou des prestations demandées après l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
