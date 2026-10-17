-- Run once in the Supabase SQL Editor before enabling the Google provider.
-- Safe to rerun. Keeps existing accounts, roles, jobs, and uploads.
begin;

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

drop policy if exists joblink_asset_insert on storage.objects;
create policy joblink_asset_insert on storage.objects for insert to authenticated with check (
    (storage.foldername(name))[1] = auth.uid()::text and (
        (bucket_id in ('company-assets', 'job-posters') and public.is_employer())
        or (bucket_id in ('avatars', 'resumes') and exists (
            select 1 from public.profiles where id = auth.uid() and user_type = 'seeker'
        ))
    )
);
-- Make the account setup function available to the REST API after this commit.
notify pgrst, 'reload schema';
commit;
