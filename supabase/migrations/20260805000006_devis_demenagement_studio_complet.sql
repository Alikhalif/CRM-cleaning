-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet d'un studio ». Prix à chiffrer (0 €), unité forfait,
-- TVA 20 %. Idempotent par libellé. Description en dollar-quoting.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un studio', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement complet d'un studio comprenant la manutention, le chargement, le transport sécurisé ainsi que le déchargement de l'ensemble du mobilier, des effets personnels, des cartons et de l'électroménager vers la nouvelle adresse.

Prestations incluses :
- Manutention complète des biens à déménager.
- Chargement méthodique du mobilier, des cartons et de l'électroménager.
- Protection du mobilier durant les opérations de manutention et de transport.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens.
- Mise en place du mobilier et des cartons dans les pièces indiquées par le client.
- Utilisation de matériel professionnel adapté à la manutention et au transport.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les accès aux lieux de départ et d'arrivée, les étages, la présence ou non d'un ascenseur, les possibilités de stationnement ainsi que les distances de portage.
Toute modification des conditions d'intervention, du volume à transporter ou de toute information non communiquée lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
