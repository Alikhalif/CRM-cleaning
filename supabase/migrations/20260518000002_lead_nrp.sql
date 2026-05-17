-- NRP (« Ne Répond Pas ») — commercial flag a lead when a prospect doesn't
-- answer the phone / doesn't reply. The lead's pipeline status stays as-is;
-- NRP is an orthogonal annotation so the commercial can find their unreached
-- leads to follow up on later. Cleared manually when contact is re-established.
--
-- Two columns: a boolean (cheap to filter on) and a timestamp (so we can
-- show "marqué NRP il y a 3 jours" and later sort by oldest-first for
-- relance prioritisation).

alter table leads add column is_nrp boolean not null default false;
alter table leads add column nrp_at timestamptz;

-- Partial index — only rows where is_nrp = true are indexed (cheap, and the
-- filter query path is exclusively WHERE is_nrp = true).
create index leads_is_nrp_idx on leads(owner_id, nrp_at desc) where is_nrp;
