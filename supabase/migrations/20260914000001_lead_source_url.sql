-- ============================================================================
-- Lien du site / formulaire d'origine du lead.
-- Additif : conserve l'URL exacte de la page (ou du formulaire) depuis laquelle
-- le lead a été soumis, à côté des champs marketing existants (utm_*, gclid,
-- landing_page_id). Renseigné par le webhook WF1 (payload source_url / page_url
-- / referrer). N'altère aucune donnée existante.
-- ============================================================================

alter table leads add column if not exists source_url text;

comment on column leads.source_url is
  'URL de la page/formulaire d''origine du lead (site web). Renseignée par WF1.';
