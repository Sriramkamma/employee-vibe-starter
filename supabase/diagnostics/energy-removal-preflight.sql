-- Read-only production inspection for removing Energy from new check-ins.
-- Run in the Supabase SQL Editor for project vibe-employee-pulse.
-- Return all result sets before applying the proposal under ../proposals/.

-- 1. check_ins columns: type, nullability and defaults.
select column_name, data_type, is_nullable, column_default, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public' and table_name = 'check_ins'
order by ordinal_position;

-- 2. Constraints (including Energy checks and uniqueness constraints).
select c.conname, c.contype, pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'check_ins'
order by c.contype, c.conname;

-- 3. Indexes, including user/date uniqueness.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'check_ins'
order by indexname;

-- 4. All non-internal triggers and complete trigger function definitions.
select tr.tgname,
       pg_get_triggerdef(tr.oid, true) as trigger_definition,
       fn.oid::regprocedure as function_signature,
       pg_get_functiondef(fn.oid) as function_definition
from pg_trigger tr
join pg_class tbl on tbl.oid = tr.tgrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
join pg_proc fn on fn.oid = tr.tgfoid
where ns.nspname = 'public' and tbl.relname = 'check_ins'
  and not tr.tgisinternal
order by tr.tgname;

-- 5. RLS status and policies. This proposal does not change either.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'check_ins';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'check_ins'
order by policyname;

-- 6. Full definitions of every function on the check_ins write/signal path.
select p.oid::regprocedure as function_signature,
       pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
      'calculate_sentiment',
      'prepare_checkin',
      'after_checkin_saved',
      'evaluate_checkin_signals'
  )
order by p.proname, p.oid::regprocedure::text;

-- 7. Catalog-tracked dependencies on the scoring and signal functions.
-- SQL-language function bodies may not always create dependency records, so
-- also run the source-text search in query 8 below.
select target.oid::regprocedure as target_signature,
       pg_describe_object(d.classid, d.objid, d.objsubid) as dependent_object,
       d.deptype
from pg_proc target
join pg_namespace target_ns on target_ns.oid = target.pronamespace
join pg_depend d on d.refclassid = 'pg_proc'::regclass and d.refobjid = target.oid
where target_ns.nspname = 'public'
  and target.proname in ('calculate_sentiment', 'evaluate_checkin_signals')
order by target.oid::regprocedure::text, dependent_object;

-- 8. Source-text references in public functions, including dependencies that
-- PostgreSQL does not record for a function body stored as a string.
select p.oid::regprocedure as function_signature,
       p.prosrc as function_source
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%check_ins%'
       or p.prosrc ilike '%energy%'
       or p.prosrc ilike '%calculate_sentiment%'
       or p.prosrc ilike '%evaluate_checkin_signals%'
       or p.prosrc ilike '%after_checkin_saved%')
order by p.proname;
