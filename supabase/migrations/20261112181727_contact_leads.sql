-- Additive lead storage only: no attendance, payroll, curriculum or grading changes.
create table public.contact_leads (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 name text not null check (length(name) between 1 and 120),
 institution text not null check (length(institution) between 1 and 200),
 job_title text not null default '' check (length(job_title) <= 120),
 email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check (length(phone) <= 50),
 department text not null default '' check (length(department) <= 160),
 inquiry_type text not null check (inquiry_type in ('LTG demonstration','Founding/Beta partnership','Using LTG at my school','Pricing/licensing','Consulting/configuration','General information')),
 message text not null default '' check (length(message) <= 5000),
 heard_about text not null default '' check (length(heard_about) <= 300),
 source_page text not null default '/contact' check (length(source_page) <= 500),
 referrer text not null default '' check (length(referrer) <= 500),
 utm_source text not null default '' check (length(utm_source) <= 200),
 utm_medium text not null default '' check (length(utm_medium) <= 200),
 utm_campaign text not null default '' check (length(utm_campaign) <= 200),
 utm_term text not null default '' check (length(utm_term) <= 200),
 utm_content text not null default '' check (length(utm_content) <= 200),
 status text not null default 'New' check (status in ('New','Contacted','Demo Scheduled','Pilot Discussion','Partner','Closed')),
 notes text not null default '' check (length(notes) <= 10000),
 notification_status text not null default 'pending' check (notification_status in ('pending','sent','failed')),
 notified_at timestamptz
);
create index contact_leads_status_created on public.contact_leads(status, created_at desc);
create table public.contact_rate_limits (
 fingerprint text primary key, window_start timestamptz not null, requests integer not null
);
create table public.contact_lead_history (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.contact_leads(id) on delete cascade,
 changed_at timestamptz not null default now(), changed_by uuid,
 old_status text not null, new_status text not null, notes_changed boolean not null
);
create index contact_lead_history_lead on public.contact_lead_history(lead_id, changed_at desc);
alter table public.contact_leads enable row level security;
alter table public.contact_rate_limits enable row level security;
alter table public.contact_lead_history enable row level security;
revoke all on public.contact_leads, public.contact_rate_limits, public.contact_lead_history from public, anon, authenticated;
grant select on public.contact_leads, public.contact_lead_history to authenticated;
grant update(status, notes) on public.contact_leads to authenticated;
grant all on public.contact_leads, public.contact_rate_limits, public.contact_lead_history to service_role;
create policy contact_owner_read on public.contact_leads for select to authenticated using ((select public.is_platform_owner()));
create policy contact_owner_update on public.contact_leads for update to authenticated using ((select public.is_platform_owner())) with check ((select public.is_platform_owner()));
create policy contact_history_read on public.contact_lead_history for select to authenticated using ((select public.is_platform_owner()));

-- Invoker RPC: only the server credential can submit. Rate checking and insert are atomic.
create function public.submit_contact_lead(p_lead jsonb, p_fingerprint text, p_submission uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing uuid; total integer; created uuid;
begin
 if length(p_fingerprint) <> 64 then raise exception 'Invalid fingerprint'; end if;
 -- Serialize retries for this submission before consuming rate allowance.
 perform pg_advisory_xact_lock(hashtextextended(p_submission::text, 0));
 select id into existing from public.contact_leads where submission_id=p_submission;
 if existing is not null then return jsonb_build_object('id',existing,'duplicate',true); end if;
 delete from public.contact_rate_limits where window_start < now() - interval '2 hours';
 insert into public.contact_rate_limits as r values (p_fingerprint,now(),1)
 on conflict (fingerprint) do update set
 requests=case when r.window_start < now()-interval '1 hour' then 1 else r.requests+1 end,
 window_start=case when r.window_start < now()-interval '1 hour' then now() else r.window_start end
 returning requests into total;
 if total > 5 then return jsonb_build_object('rate_limited',true); end if;
 insert into public.contact_leads(submission_id,name,institution,job_title,email,phone,department,inquiry_type,message,heard_about,source_page,referrer,utm_source,utm_medium,utm_campaign,utm_term,utm_content)
 values(p_submission,p_lead->>'name',p_lead->>'institution',p_lead->>'job_title',p_lead->>'email',p_lead->>'phone',p_lead->>'department',p_lead->>'inquiry_type',p_lead->>'message',p_lead->>'heard_about',p_lead->>'source_page',p_lead->>'referrer',p_lead->>'utm_source',p_lead->>'utm_medium',p_lead->>'utm_campaign',p_lead->>'utm_term',p_lead->>'utm_content')
 returning id into created;
 return jsonb_build_object('id',created,'duplicate',false);
end $$;
revoke all on function public.submit_contact_lead(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_contact_lead(jsonb,text,uuid) to service_role;

-- Private trigger records owner changes without granting clients audit-write access.
create schema if not exists private;
create function private.contact_lead_audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.updated_at=clock_timestamp();
 if old.status is distinct from new.status or old.notes is distinct from new.notes then
   if auth.uid() is null or not public.is_platform_owner() then raise exception 'Platform owner required'; end if;
   insert into public.contact_lead_history(lead_id,changed_by,old_status,new_status,notes_changed)
   values(new.id,auth.uid(),old.status,new.status,old.notes is distinct from new.notes);
 end if;
 return new;
end $$;
revoke all on function private.contact_lead_audit() from public,anon,authenticated;
create trigger contact_lead_audit before update on public.contact_leads for each row execute function private.contact_lead_audit();
