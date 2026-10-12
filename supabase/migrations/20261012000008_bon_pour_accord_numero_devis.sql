-- Insertion de la mention « Bon pour accord – Devis n° {devis.numero} » dans
-- les modèles e-mail d'envoi de devis (demande client 2026-10-12, §3 et §4).
--
-- La variable est remplacée CÔTÉ SERVEUR par /api/devis/envoyer, après
-- l'allocation du numéro et juste avant l'envoi : le PDF et l'e-mail portent
-- toujours le numéro du document réellement envoyé, jamais le dernier numéro
-- du dossier.
--
-- Le lien de signature électronique n'est pas touché : la phrase le mentionne
-- comme alternative, elle ne modifie rien à son fonctionnement.
--
-- Hors périmètre, volontairement non modifiés : « Confirmation de réception de
-- l'acompte » (ce n'est pas un envoi de devis), les modèles de facturation
-- (voir plus bas) et les relances, qui ne reprennent pas les modalités.
--
-- Idempotent : la clause « not like » empêche une seconde insertion.

-- 1. Déménagement avec acompte : la mention « Bon pour accord » existe déjà
--    dans la phrase. On l'enrichit du numéro au lieu d'ajouter une phrase.
update message_templates
   set body = replace(
     body,
     $old$(mention « Bon pour accord »)$old$,
     $new$(mention « Bon pour accord – Devis n° {devis.numero} »)$new$
   )
 where name = 'Mail devis — virement avec acompte (Déménagement)'
   and body not like '%{devis.numero}%';

-- 2. Les autres modèles d'envoi de devis : la phrase complète est insérée
--    juste après le paragraphe annonçant le devis en pièce jointe, avant les
--    coordonnées de règlement.
update message_templates
   set body = regexp_replace(
     body,
     '(veuillez trouver ci-joint[^\n]*)\n\n',
     E'\\1\n\n' ||
     $new$Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».$new$
     || E'\n\n'
   )
 where channel = 'email'
   and category = 'devis'
   and name in (
     'Mail devis — virement (Nettoyage)',
     'Mail devis — virement (Débarras)',
     'Mail devis — virement avec acompte (Nettoyage)',
     'Mail devis — virement avec acompte (Débarras)',
     'Mail devis urgent — 100 % prépaiement (Nettoyage)',
     'Mail devis urgent — 100 % prépaiement (Débarras)'
   )
   and body like '%veuillez trouver ci-joint%'
   and body not like '%{devis.numero}%';
