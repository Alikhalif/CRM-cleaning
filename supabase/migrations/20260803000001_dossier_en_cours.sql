-- Nouvel état de dossier « En cours de réalisation » (client 2026-08-03).
-- Le jour J : technicien arrivé → en_cours ; non présenté → reprogrammation
-- (nouvelle date, le dossier reste planifié). Inséré entre planifie et finalise.
alter type dossier_status add value if not exists 'en_cours' after 'planifie';
