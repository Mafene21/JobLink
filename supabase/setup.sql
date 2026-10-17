-- Run this entire file once in your Supabase project's SQL Editor.
-- Creates JobLink's fresh schema; it does not delete existing data.
begin;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null,
    user_type text not null check (user_type in ('seeker', 'employer')),
    profile_completed boolean not null default false,
    created_at timestamptz not null default now()
);
create table if not exists public.seeker_profiles (
    id uuid primary key references public.profiles(id) on delete cascade,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    updated_at timestamptz not null default now()
);
create table if not exists public.company_profiles (
    id uuid primary key references public.profiles(id) on delete cascade,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    updated_at timestamptz not null default now()
);
create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    employer_id uuid not null references public.profiles(id) on delete cascade,
    title text not null check (length(trim(title)) > 0),
    company_name text not null default '',
    job_type text not null,
    category text not null default '',
    location text not null default '',
    status text not null default 'active' check (status in ('active', 'paused', 'closed', 'draft')),
    featured boolean not null default false,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.jobs(id) on delete cascade,
    seeker_id uuid not null references public.profiles(id) on delete cascade,
    employer_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'reviewed', 'shortlisted', 'interview', 'accepted', 'hired', 'rejected', 'withdrawn')),
    resume_path text,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    applied_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (job_id, seeker_id)
);
create table if not exists public.saved_jobs (
    id uuid primary key default gen_random_uuid(),
    seeker_id uuid not null references public.profiles(id) on delete cascade,
    job_id uuid not null references public.jobs(id) on delete cascade,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    saved_at timestamptz not null default now(),
    unique (seeker_id, job_id)
);

create index if not exists jobs_employer_idx on public.jobs(employer_id);
create index if not exists jobs_feed_idx on public.jobs(status, created_at desc, id);
create index if not exists applications_seeker_idx on public.applications(seeker_id, applied_at desc);
create index if not exists applications_employer_idx on public.applications(employer_id);

-- Derive ownership from the authenticated account, never from editable metadata.
create or replace function public.is_employer()
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.profiles where id = auth.uid() and user_type = 'employer');
$$;
create or replace function public.owns_job(target_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.jobs where id = target_job and employer_id = auth.uid());
$$;
create or replace function public.has_applied(target_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.applications where job_id = target_job and seeker_id = auth.uid());
$$;

-- Signup works with email confirmation enabled: no client session is needed here.
create or replace function public.create_joblink_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
    account_type text := coalesce(new.raw_user_meta_data->>'user_type', 'seeker');
    account_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
begin
    -- Google has no JobLink role yet; let the signed-in owner choose once.
    if new.raw_app_meta_data->>'provider' = 'google' then return new; end if;
    if account_type not in ('seeker', 'employer') then
        raise exception 'Choose a job seeker or employer account';
    end if;
    insert into public.profiles(id, full_name, email, user_type)
    values (new.id, account_name, new.email, account_type);
    if account_type = 'seeker' then
        insert into public.seeker_profiles(id, details)
        values (new.id, jsonb_build_object('fullName', account_name, 'email', new.email));
    else
        insert into public.company_profiles(id, details)
        values (new.id, jsonb_build_object('companyName', account_name, 'email', new.email));
    end if;
    return new;
end;
$$;
-- Create only the signed-in Google account. Existing roles are immutable.
create or replace function public.create_google_account(requested_type text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    account public.profiles%rowtype;
    google_user auth.users%rowtype;
    account_name text;
begin
    if auth.uid() is null then raise exception 'Please sign in with Google first'; end if;
    select * into account from public.profiles where id = auth.uid();
    if found then return to_jsonb(account); end if;
    if requested_type is null or requested_type not in ('seeker', 'employer') then
        raise exception 'Choose a job seeker or employer account';
    end if;
    select * into google_user from auth.users
        where id = auth.uid() and raw_app_meta_data->>'provider' = 'google';
    if not found or google_user.email is null then
        raise exception 'Please sign in with Google first';
    end if;
    account_name := coalesce(nullif(trim(google_user.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(google_user.raw_user_meta_data->>'name'), ''), split_part(google_user.email, '@', 1));
    insert into public.profiles(id, full_name, email, user_type)
        values (google_user.id, account_name, google_user.email, requested_type)
        on conflict (id) do nothing;
    -- A concurrent request may already have made the choice. Keep its role.
    select * into account from public.profiles where id = auth.uid();
    if account.user_type = 'seeker' then
        insert into public.seeker_profiles(id, details)
            values (account.id, jsonb_build_object('fullName', account.full_name, 'email', account.email))
            on conflict (id) do nothing;
    else
        insert into public.company_profiles(id, details)
            values (account.id, jsonb_build_object('companyName', account.full_name, 'email', account.email))
            on conflict (id) do nothing;
    end if;
    return to_jsonb(account);
end;
$$;
revoke execute on function public.create_google_account(text) from public, anon;
grant execute on function public.create_google_account(text) to authenticated;

drop trigger if exists joblink_account_created on auth.users;
create trigger joblink_account_created after insert on auth.users
for each row execute function public.create_joblink_account();

create or replace function public.touch_joblink_record()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists joblink_job_updated on public.jobs;
create trigger joblink_job_updated before update on public.jobs for each row execute function public.touch_joblink_record();
drop trigger if exists joblink_seeker_updated on public.seeker_profiles;
create trigger joblink_seeker_updated before update on public.seeker_profiles for each row execute function public.touch_joblink_record();
drop trigger if exists joblink_company_updated on public.company_profiles;
create trigger joblink_company_updated before update on public.company_profiles for each row execute function public.touch_joblink_record();

create or replace function public.validate_joblink_application()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'INSERT' then
        select employer_id into new.employer_id from public.jobs where id = new.job_id and status = 'active';
        if new.employer_id is null then raise exception 'This job is no longer accepting applications'; end if;
        if new.resume_path is not null and split_part(new.resume_path, '/', 1) <> new.seeker_id::text then
            raise exception 'The resume must belong to the applicant';
        end if;
        new.status := 'pending';
        new.applied_at := now();
    elsif auth.uid() is not null then
        if new.job_id <> old.job_id or new.seeker_id <> old.seeker_id or new.employer_id <> old.employer_id
            or new.resume_path is distinct from old.resume_path or new.applied_at <> old.applied_at then
            raise exception 'Application ownership and submitted files cannot be changed';
        end if;
        if auth.uid() = old.seeker_id then
            if new.status <> 'withdrawn' or old.status = 'withdrawn'
                or (new.details - 'withdrawalReason') <> (old.details - 'withdrawalReason') then
                raise exception 'Applicants can only withdraw their application';
            end if;
        elsif auth.uid() = old.employer_id then
            if new.status = 'withdrawn' or old.status = 'withdrawn'
                or (new.details - array['notes', 'interviewDate']) <> (old.details - array['notes', 'interviewDate']) then
                raise exception 'Employers can only update the review status, notes, and interview date';
            end if;
        else raise exception 'You cannot update this application';
        end if;
    end if;
    new.updated_at := now();
    return new;
end;
$$;
drop trigger if exists joblink_application_validated on public.applications;
create trigger joblink_application_validated before insert or update on public.applications
for each row execute function public.validate_joblink_application();

alter table public.profiles enable row level security;
alter table public.seeker_profiles enable row level security;
alter table public.company_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;

revoke all on public.profiles, public.seeker_profiles, public.company_profiles,
    public.jobs, public.applications, public.saved_jobs from anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant select on public.company_profiles to authenticated;
grant select on public.profiles, public.seeker_profiles, public.applications, public.saved_jobs to authenticated;
grant update (full_name, profile_completed) on public.profiles to authenticated;
grant insert, update, delete on public.seeker_profiles, public.company_profiles, public.jobs, public.saved_jobs to authenticated;
grant insert on public.applications to authenticated;
grant update (status, details, updated_at) on public.applications to authenticated;

drop policy if exists joblink_profile_read on public.profiles;
create policy joblink_profile_read on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists joblink_profile_update on public.profiles;
create policy joblink_profile_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists joblink_seeker_read on public.seeker_profiles;
create policy joblink_seeker_read on public.seeker_profiles for select to authenticated using (
    id = auth.uid() or (public.is_employer() and (
        exists (select 1 from public.jobs where employer_id = auth.uid() and status = 'active')
        or exists (select 1 from public.applications where seeker_id = seeker_profiles.id and employer_id = auth.uid())
    ))
);
drop policy if exists joblink_seeker_write on public.seeker_profiles;
create policy joblink_seeker_write on public.seeker_profiles for all to authenticated
using (id = auth.uid() and not public.is_employer()) with check (id = auth.uid() and not public.is_employer());

drop policy if exists joblink_company_read on public.company_profiles;
create policy joblink_company_read on public.company_profiles for select to authenticated using (id = auth.uid());
drop policy if exists joblink_company_write on public.company_profiles;
create policy joblink_company_write on public.company_profiles for all to authenticated
using (id = auth.uid() and public.is_employer()) with check (id = auth.uid() and public.is_employer());

drop policy if exists joblink_job_read on public.jobs;
create policy joblink_job_read on public.jobs for select to anon, authenticated
using (status = 'active' or employer_id = auth.uid() or public.has_applied(id));
drop policy if exists joblink_job_insert on public.jobs;
create policy joblink_job_insert on public.jobs for insert to authenticated
with check (employer_id = auth.uid() and public.is_employer());
drop policy if exists joblink_job_update on public.jobs;
create policy joblink_job_update on public.jobs for update to authenticated
using (employer_id = auth.uid() and public.is_employer()) with check (employer_id = auth.uid() and public.is_employer());
drop policy if exists joblink_job_delete on public.jobs;
create policy joblink_job_delete on public.jobs for delete to authenticated using (employer_id = auth.uid() and public.is_employer());

drop policy if exists joblink_application_read on public.applications;
create policy joblink_application_read on public.applications for select to authenticated
using (seeker_id = auth.uid() or employer_id = auth.uid());
drop policy if exists joblink_application_insert on public.applications;
create policy joblink_application_insert on public.applications for insert to authenticated
with check (seeker_id = auth.uid() and not public.is_employer() and employer_id <> auth.uid()
    and exists (select 1 from public.jobs where id = job_id and status = 'active'));
drop policy if exists joblink_application_update on public.applications;
create policy joblink_application_update on public.applications for update to authenticated
using (seeker_id = auth.uid() or employer_id = auth.uid())
with check (seeker_id = auth.uid() or employer_id = auth.uid());

drop policy if exists joblink_saved_jobs on public.saved_jobs;
create policy joblink_saved_jobs on public.saved_jobs for all to authenticated
using (seeker_id = auth.uid() and not public.is_employer())
with check (seeker_id = auth.uid() and not public.is_employer());

-- Only aggregate counts are exposed; account emails and profiles stay private.
create or replace function public.public_job_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'jobs', (select count(*) from public.jobs where status = 'active'),
        'companies', (select count(*) from public.profiles where user_type = 'employer'),
        'seekers', (select count(*) from public.profiles where user_type = 'seeker')
    );
$$;
-- Honor the company form's Hide Contact setting at the database boundary.
create or replace function public.get_company_profile(target_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
    select to_jsonb(company) || jsonb_build_object('details',
        case when company.id = auth.uid() or company.details->'hideContact' is distinct from 'true'::jsonb
            then company.details
            else company.details - array['email', 'phone', 'address', 'contactEmail', 'contactPhone']
        end)
    from public.company_profiles company where company.id = target_id;
$$;
revoke execute on function public.is_employer(), public.owns_job(uuid), public.has_applied(uuid),
    public.public_job_stats(), public.get_company_profile(uuid), public.create_joblink_account(), public.touch_joblink_record(),
    public.validate_joblink_application() from public;
grant execute on function public.is_employer(), public.owns_job(uuid), public.has_applied(uuid),
    public.public_job_stats(), public.get_company_profile(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
    ('company-assets', 'company-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
    ('job-posters', 'job-posters', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
    ('resumes', 'resumes', false, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists joblink_asset_insert on storage.objects;
create policy joblink_asset_insert on storage.objects for insert to authenticated with check (
    (storage.foldername(name))[1] = auth.uid()::text and (
        (bucket_id in ('company-assets', 'job-posters') and public.is_employer())
        or (bucket_id in ('avatars', 'resumes') and exists (
            select 1 from public.profiles where id = auth.uid() and user_type = 'seeker'
        ))
    )
);
drop policy if exists joblink_asset_read on storage.objects;
create policy joblink_asset_read on storage.objects for select to authenticated using (
    bucket_id in ('avatars', 'company-assets', 'job-posters')
    or (bucket_id = 'resumes' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.applications where resume_path = name and employer_id = auth.uid())
    ))
);
drop policy if exists joblink_asset_delete on storage.objects;
create policy joblink_asset_delete on storage.objects for delete to authenticated
using (bucket_id in ('avatars', 'company-assets', 'job-posters', 'resumes') and (storage.foldername(name))[1] = auth.uid()::text);

-- Optional live updates for the employer's own job records.
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
        and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
        alter publication supabase_realtime add table public.jobs;
    end if;
end $$;
-- Refresh the REST API after creating or updating the schema.
notify pgrst, 'reload schema';
commit;
