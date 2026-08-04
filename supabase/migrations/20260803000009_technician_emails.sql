-- Emails des intervenants (dérivés du nom, domaine optimivv-nettoyage.com) —
-- placeholders de démo, à remplacer par les vrais via Paramètres → Intervenants.
-- Guardé sur email is null pour ne pas écraser une vraie valeur.
update technicians set email = 'aicha.lefort@optimivv-nettoyage.com'   where name = 'Aïcha Lefort'  and email is null;
update technicians set email = 'bastien.roy@optimivv-nettoyage.com'    where name = 'Bastien Roy'   and email is null;
update technicians set email = 'khaled.brahim@optimivv-nettoyage.com'  where name = 'Khaled Brahim' and email is null;
update technicians set email = 'vincent.caron@optimivv-nettoyage.com'  where name = 'Vincent Caron' and email is null;
