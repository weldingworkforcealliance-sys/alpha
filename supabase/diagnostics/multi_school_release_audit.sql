-- LTG multi-school release audit
-- Read-only diagnostics. This file is not a migration and does not change data or schema.

-- 1) Every public table should have RLS enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname;

-- 2) Inventory public RLS policies and their school/role predicates.
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Inventory SECURITY DEFINER functions exposed to app roles.
select
  p.oid::regprocedure::text as function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
order by p.proname, p.oid::regprocedure::text;

-- 4) Heuristic review list: privileged authenticated functions whose definitions
-- do not visibly contain the standard LTG authorization helpers. Every row here
-- must be manually classified before multi-school release.
with f as (
  select
    p.oid,
    p.oid::regprocedure::text as function_signature,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
)
select function_signature
from f
where definition !~* '(auth\.uid\(|is_platform_owner\(|can_[a-z_]+\(|is_school_[a-z_]+\(|is_section_instructor\(|has_school_role\(|is_training_session_member\()'
order by function_signature;

-- 5) Direct table privileges granted to application roles. Review any sensitive
-- table that is directly accessible instead of being intentionally RPC-only.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
