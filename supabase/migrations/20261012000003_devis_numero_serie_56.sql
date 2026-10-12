-- Numérotation des devis : passage au format « AAAA-56-N » et démarrage de la
-- série 2026 au numéro 144 (demande client 2026-10-12).
--
-- CE QUI NE CHANGE PAS — et c'est l'essentiel :
-- le compteur était DÉJÀ commun aux deux activités. Déménagement et Nettoyage
-- passent tous deux par /devis/nouveau → table devis_optimivv → cette même
-- fonction. Il n'y a jamais eu deux compteurs à fusionner. Seuls le FORMAT du
-- numéro et la valeur de départ changent ici.
--
-- Format : 2026-56-144, puis 2026-56-145, 2026-56-146…
--   AAAA = année de création · 56 = identifiant fixe de la série · N = séquence
--
-- Les 17 devis déjà émis (2026-00002 … 2026-00018) gardent leur numéro : la
-- fonction ne réécrit aucune ligne existante.
--
-- Atomicité : inchangée. L'INSERT … ON CONFLICT DO UPDATE … RETURNING prend un
-- verrou de ligne sur le compteur, donc deux créations simultanées obtiennent
-- deux numéros distincts et consécutifs.

create or replace function next_devis_optimivv_num(p_year integer)
returns text
language plpgsql
as $fn$
declare
  v_n integer;
begin
  -- Année sans compteur : la première allocation rend 1 (donc next_value = 2).
  -- L'année 2026 est amorcée à 144 juste en dessous.
  insert into devis_optimivv_counters (year, next_value)
  values (p_year, 2)
  on conflict (year)
    do update set next_value = devis_optimivv_counters.next_value + 1
  returning next_value - 1 into v_n;

  return p_year::text || '-56-' || v_n::text;
end;
$fn$;

alter function next_devis_optimivv_num(integer)
  security definer
  set search_path = public, pg_temp;

revoke all on function next_devis_optimivv_num(integer) from public;
grant execute on function next_devis_optimivv_num(integer) to authenticated, service_role;

-- Démarrage de la série 2026 au 144 : le prochain devis émis portera
-- « 2026-56-144 ». Idempotent — on n'abaisse jamais un compteur déjà plus haut,
-- ce qui rendrait possible la réattribution d'un numéro déjà utilisé.
insert into devis_optimivv_counters (year, next_value)
values (2026, 144)
on conflict (year) do update
   set next_value = greatest(devis_optimivv_counters.next_value, 144);
