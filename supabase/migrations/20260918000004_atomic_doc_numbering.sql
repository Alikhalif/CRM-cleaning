-- Recette 2026-09-18 · Correctif A11 (P2, numérotation légale sans trou)
-- ⚠️ À VALIDER EN STAGING avant prod : ce trigger porte TOUTE la numérotation
--    devis/factures. Non testable sans base au moment de l'écriture.
--
-- Problème : le code allouait le numéro (next_doc_num) dans une requête, PUIS
-- insérait le document dans une autre. Si l'INSERT échoue après l'allocation, le
-- numéro est « brûlé » → trou dans la séquence (interdit par le CGI, art. 289).
-- La note de 20260515000004 le dit : l'allocation et l'INSERT doivent être dans
-- la MÊME transaction.
--
-- Solution : un trigger BEFORE INSERT alloue le numéro AU SEIN de l'INSERT. Si
-- l'INSERT est annulé (contrainte, etc.), l'incrément du compteur est annulé
-- avec lui → aucun trou. Le code applicatif n'alloue plus à l'avance : il insère
-- `num = ''` et le trigger le renseigne.
--
-- Le trigger ne renseigne le numéro que si `num` est vide, donc tant que le code
-- déployé continuerait de pré-allouer, ce trigger est inerte (rétro-compatible).

create or replace function assign_doc_num()
returns trigger
language plpgsql
as $$
begin
  if new.num is null or new.num = '' then
    new.num := next_doc_num(
      new.type,
      extract(year from coalesce(new.issued_at, now()))::int
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_assign_num on documents;
create trigger trg_documents_assign_num
  before insert on documents
  for each row execute function assign_doc_num();
