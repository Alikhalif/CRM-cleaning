-- next_doc_num must run as the function owner so authenticated callers
-- (commerciaux, planificateurs) can allocate a document number without
-- INSERT/UPDATE rights on doc_counters. The 20260515000005_init_rls
-- migration already documented this assumption ("the next_doc_num()
-- function runs as security definer so callers don't need direct write
-- rights anyway") but the function definition itself was missing the
-- qualifier — calls would fail RLS the moment a non-admin tried to
-- create a devis. Pin search_path so the definer body can't be hijacked
-- by a caller-provided path.

alter function next_doc_num(document_type, integer)
  security definer
  set search_path = public, pg_temp;

-- Restrict who can call the function. Without this, anon could call it
-- and burn through document numbers without ever inserting a document.
revoke all on function next_doc_num(document_type, integer) from public;
grant execute on function next_doc_num(document_type, integer) to authenticated;
