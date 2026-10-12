-- Ajout de la phrase « solde restant dû » dans les modèles e-mail prévoyant un
-- acompte (demande client 2026-10-12).
--
-- Variable utilisée : {montant.solde}, qui EXISTAIT DÉJÀ (déclarée « Solde
-- restant » dans lib/message-templates-shared.ts et calculée sur la page devis
-- par montant − acompte, d'après le pourcentage réellement saisi). Aucune
-- nouvelle variable n'est créée.
--
-- Le symbole € n'est PAS écrit dans la phrase : formatEUR rend déjà « 1 000 € ».
-- L'écrire donnerait « 1 000 € € ».
--
-- Trois modèles seulement. Les autres textes mentionnant « acompte » sont hors
-- périmètre : confirmation de réception d'acompte, transmission à la
-- planificatrice (e-mail interne) et facture d'acompte ne sont pas des e-mails
-- d'envoi de devis.
--
-- Idempotent : la clause « not like » empêche un second ajout.

-- 1. Déménagement — la phrase de solde existante est remplacée par la formule
--    retenue, pour ne pas évoquer le solde deux fois dans le même e-mail.
update message_templates
   set body = replace(
     body,
     $old$Le solde ({montant.solde}) sera à régler à réception de la facture, selon les modalités convenues.$old$,
     $new$Le solde restant dû, d'un montant de {montant.solde}, devra être réglé le jour même, à l'issue de l'intervention, dès réception de la facture correspondante.$new$
   )
 where name = 'Mail devis — virement avec acompte (Déménagement)'
   and body like '%Le solde ({montant.solde}) sera à régler%';

-- 2. Nettoyage et Débarras — insertion juste après le paragraphe du RIB.
update message_templates
   set body = replace(
     body,
     $anc$Vous trouverez également en pièce jointe notre RIB pour le règlement de l'acompte de {acompte.pct} du montant de la prestation.$anc$,
     $anc$Vous trouverez également en pièce jointe notre RIB pour le règlement de l'acompte de {acompte.pct} du montant de la prestation.$anc$
       || chr(10) || chr(10) ||
     $new$Le solde restant dû, d'un montant de {montant.solde}, devra être réglé le jour même, à l'issue de l'intervention, dès réception de la facture correspondante.$new$
   )
 where name in (
     'Mail devis — virement avec acompte (Nettoyage)',
     'Mail devis — virement avec acompte (Débarras)'
   )
   and body not like '%Le solde restant dû%';
