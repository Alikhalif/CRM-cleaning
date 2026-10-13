-- « Mail devis — virement avec acompte (Déménagement) » : alignement sur son
-- jumeau Débarras (demande client 2026-10-12).
--
-- Le corps précédent dictait les coordonnées bancaires EN DUR dans le mail,
-- avec « IBAN : [à compléter] » / « BIC : [à compléter] » — un gabarit non
-- rempli qui partait tel quel chez le client. Depuis que le RIB OPTIMIVV est
-- joint automatiquement à chaque devis (lib/devis/rib.ts), le mail n'a plus à
-- porter l'IBAN : il renvoie à la pièce jointe, comme le modèle Débarras.
--
-- Adaptations par rapport au texte Débarras : « prestation de débarras » →
-- « prestation de déménagement », et la signature de l'activité Déménagement.
--
-- L'objet n'est PAS repris du modèle Débarras : « Votre devis débarras —
-- {societe.nom} » laisse un tiret orphelin quand le lead n'a pas de société
-- (particulier). L'objet actuel est explicite et sans ce défaut, on le garde.
--
-- Audiences : « debarras » est retiré — le modèle Débarras existe désormais,
-- laisser un texte « déménagement » proposé sur un dossier débarras n'a plus
-- lieu d'être. Les profils entrant/emission sont ajoutés pour s'aligner sur
-- « Mail devis — virement (Déménagement) 100% ».
--
-- Idempotent : ré-exécuter réécrit la même valeur.

update message_templates
   set subject = 'Votre devis de déménagement — acompte pour validation',
       body = $corps$Bonjour

Suite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de déménagement demandée.

Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».

Vous trouverez également en pièce jointe notre RIB pour le règlement de l'acompte de {acompte.pct} du montant de la prestation.

Le solde restant dû, d'un montant de {montant.solde}, devra être réglé le jour même, à l'issue de l'intervention, dès réception de la facture correspondante.

Dès réception du devis signé ainsi que du règlement de l'acompte de {acompte.pct}, nous vous confirmerons par retour d'email la date d'intervention ainsi que le créneau horaire.

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$,
       audiences = array['entrant','emission','demenagement']::text[]
 where name = 'Mail devis — virement avec acompte (Déménagement)';
