-- Bibliothèque de devis Déménagement — 3. Transport spécialisé.
-- « Transport d'objets d'art ou d'objets de valeur ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Transport d''objets d''art ou d''objets de valeur', 'forfait', 0, 20, $D$Prestation à réaliser :
Prise en charge de la manutention et du transport d'œuvres d'art, d'objets de collection ou de biens de valeur nécessitant des précautions particulières, comprenant leur protection, leur manutention spécialisée, leur transport sécurisé et leur mise en place à destination.

Prestations incluses :
- Protection renforcée des œuvres et objets de valeur.
- Conditionnement spécifique selon la nature des biens.
- Manutention réalisée avec le matériel adapté.
- Chargement et déchargement sécurisés.
- Transport sécurisé jusqu'au lieu de destination.
- Mise en place des biens selon les indications du client.

Conditions d'intervention :
Cette option complète le devis principal et concerne exclusivement les biens identifiés lors de l'établissement du devis.
Le client s'engage à déclarer la nature, les dimensions et, si nécessaire, la valeur des biens concernés. Toute demande complémentaire ou tout bien non déclaré avant l'intervention pourra entraîner une réévaluation de cette option après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
