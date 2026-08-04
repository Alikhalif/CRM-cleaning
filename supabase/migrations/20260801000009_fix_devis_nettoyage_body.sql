-- Fix the "Mail devis — virement (Nettoyage)" body: it mentioned "débarras"
-- (a source copy quirk). Client edit 2026-08-02 → corrected to "nettoyage".
update message_templates set body =
  E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de nettoyage demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement du devis nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
where name = 'Mail devis — virement (Nettoyage)';
