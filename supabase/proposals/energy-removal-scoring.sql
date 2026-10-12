-- PROPOSAL ONLY. Do not run against production until the read-only preflight
-- results have been reviewed and confirm that the Energy column/checks and
-- every trigger allow NULL. This script intentionally does not alter rows,
-- sentiment_score values, trigger definitions, RLS, ownership, or org/date logic.
--
-- The existing prepare_checkin() trigger can retain its validation and call:
-- calculate_sentiment(NEW.mood, NEW.energy, NEW.workload).
-- The retained 3-argument signature ignores p_energy for the new calculation.
-- Existing stored sentiment scores are not recalculated by this function DDL.

begin;

-- Guard against a score recalculation on historical-row UPDATEs. Review the
-- trigger report first; this draft refuses to proceed if any UPDATE trigger
-- exists on check_ins so its behavior cannot be guessed.
do $guard$
begin
    if exists (
        select 1
        from pg_trigger tr
        join pg_class tbl on tbl.oid = tr.tgrelid
        join pg_namespace ns on ns.oid = tbl.relnamespace
        where ns.nspname = 'public'
          and tbl.relname = 'check_ins'
          and not tr.tgisinternal
          and (tr.tgtype::integer & 16) = 16
    ) then
        raise exception 'Review check_ins UPDATE triggers before applying this proposal; historical scores must not be recalculated.';
    end if;
end;
$guard$;

-- Energy-related CHECK constraints need their own reviewed change; this script
-- will not try to infer or remove a constraint definition.
do $guard$
begin
    if exists (
        select 1
        from pg_constraint c
        join pg_class tbl on tbl.oid = c.conrelid
        join pg_namespace ns on ns.oid = tbl.relnamespace
        where ns.nspname = 'public'
          and tbl.relname = 'check_ins'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid, true) ilike '%energy%'
    ) then
        raise exception 'Review check_ins Energy CHECK constraints before applying this proposal.';
    end if;
end;
$guard$;

-- Omitted Energy must remain NULL rather than receive a fabricated default.
alter table public.check_ins alter column energy drop default;
alter table public.check_ins alter column energy drop not null;

create or replace function public.calculate_sentiment(
    p_mood integer,
    p_energy integer,
    p_workload integer
)
returns numeric
language sql
immutable
as $function$
    select round(
        (
            ((p_mood - 1)::numeric / 4) * 5
            +
            ((5 - p_workload)::numeric / 4) * 2
        ) / 7 * 100,
        2
    );
$function$;

commit;

-- No UPDATE is issued: historical answers and historical scores are preserved.
-- If preflight finds an Energy check constraint that rejects NULL, an UPDATE
-- trigger that recalculates scores, or any other function that requires a
-- non-NULL Energy value, stop and revise this proposal before application.
