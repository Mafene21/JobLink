import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('fresh Supabase schema, account triggers, RLS, and private resumes', async () => {
    const db = new PGlite();
    try {
        // Supabase's platform schemas, represented locally for real Postgres tests.
        await db.exec(`
            create role anon; create role authenticated;
            create schema auth; create schema storage;
            create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb,
                raw_app_meta_data jsonb not null default '{}'::jsonb);
            create function auth.uid() returns uuid language sql stable as $$
                select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
            $$;
            create table storage.buckets (id text primary key, name text, public boolean,
                file_size_limit bigint, allowed_mime_types text[]);
            create table storage.objects (id uuid primary key default gen_random_uuid(),
                bucket_id text references storage.buckets(id), name text);
            alter table storage.objects enable row level security;
            create function storage.foldername(name text) returns text[] language sql immutable as $$
                select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1];
            $$;
            grant usage on schema auth, storage, public to anon, authenticated;
            grant select, insert, update, delete on storage.objects to authenticated;
        `);
        const schema = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
        await db.exec(schema);
        await db.exec(schema); // Setup is safe to rerun.
        const googleMigration = await readFile(new URL('../supabase/google-auth.sql', import.meta.url), 'utf8');
        await db.exec(googleMigration);
        await db.exec(googleMigration); // Existing projects can apply it without data resets.
        assert.deepEqual((await db.query('select public.public_job_stats() as stats')).rows[0].stats,
            { jobs: 0, seekers: 0, companies: 0 });

        const employer = '11111111-1111-4111-8111-111111111111';
        const otherEmployer = '22222222-2222-4222-8222-222222222222';
        const seeker = '33333333-3333-4333-8333-333333333333';
        const otherSeeker = '44444444-4444-4444-8444-444444444444';
        for (const [id, role] of [[employer, 'employer'], [otherEmployer, 'employer'], [seeker, 'seeker'], [otherSeeker, 'seeker']]) {
            await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)',
                [id, `${role}-${id[0]}@example.test`, { full_name: `Test ${role}`, user_type: role }]);
        }
        assert.equal((await db.query('select count(*) from public.profiles')).rows[0].count, 4);
        assert.equal((await db.query('select count(*) from public.seeker_profiles')).rows[0].count, 2);

        async function as(id, role = 'authenticated') {
            await db.exec('reset role');
            await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
            await db.exec(`set role ${role}`);
        }
        await as(employer);
        await db.query(`update public.company_profiles set details = details ||
            '{"hideContact":true,"phone":"private phone"}' where id=$1`, [employer]);
        assert.equal((await db.query('select public.get_company_profile($1) as profile', [employer])).rows[0].profile.details.phone, 'private phone');
        const job = (await db.query(`insert into public.jobs (employer_id, title, job_type)
            values ($1, 'Developer', 'full-time') returning id`, [employer])).rows[0].id;
        await assert.rejects(db.query(`insert into public.jobs (employer_id,title,job_type)
            values ($1,'Forged','full-time')`, [otherEmployer]), /row-level security/);
        await as(otherEmployer);
        assert.equal((await db.query("update public.jobs set title = 'Hijacked' where id = $1 returning id", [job])).rows.length, 0);
        await as(null, 'anon');
        assert.equal((await db.query('select id from public.jobs')).rows.length, 1);
        await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
        await assert.rejects(db.query('select * from public.company_profiles'), /permission denied/);
        const publicCompany = (await db.query('select public.get_company_profile($1) as profile', [employer])).rows[0].profile;
        assert.equal(publicCompany.details.companyName, 'Test employer');
        assert.equal(publicCompany.details.email, undefined);
        assert.equal(publicCompany.details.phone, undefined);

        await as(seeker);
        await assert.rejects(db.query("update public.profiles set user_type='employer' where id=$1", [seeker]), /permission denied/);
        await assert.rejects(db.query(`insert into public.jobs (employer_id,title,job_type)
            values ($1,'Not an employer','full-time')`, [seeker]), /row-level security/);
        assert.equal((await db.query('select id from public.seeker_profiles')).rows.length, 1);
        const resume = `${seeker}/applications/resume.pdf`;
        const unrelatedResume = `${seeker}/applications/private.pdf`;
        await db.query("insert into storage.objects (bucket_id,name) values ('resumes',$1),('resumes',$2)", [resume, unrelatedResume]);
        const app = (await db.query(`insert into public.applications (job_id,seeker_id,resume_path,details)
            values ($1,$2,$3,'{"coverLetter":"Hello"}') returning *`, [job, seeker, resume])).rows[0];
        assert.equal(app.employer_id, employer);
        assert.equal(app.status, 'pending');
        await assert.rejects(db.query('insert into public.applications (job_id,seeker_id) values ($1,$2)', [job, seeker]), /duplicate key/);

        await as(otherSeeker);
        assert.equal((await db.query('select * from public.applications')).rows.length, 0);
        assert.equal((await db.query("select * from storage.objects where bucket_id='resumes'")).rows.length, 0);
        await assert.rejects(db.query('insert into public.applications (job_id,seeker_id) values ($1,$2)', [job, seeker]), /row-level security/);
        await assert.rejects(db.query("insert into storage.objects (bucket_id,name) values ('resumes',$1)", [resume]), /row-level security/);

        await as(otherEmployer);
        assert.equal((await db.query('select * from public.applications')).rows.length, 0);
        assert.equal((await db.query("select * from storage.objects where bucket_id='resumes'")).rows.length, 0);
        assert.equal((await db.query('select * from public.seeker_profiles')).rows.length, 0);
        await as(employer);
        assert.equal((await db.query('select * from public.applications')).rows.length, 1);
        assert.deepEqual((await db.query("select name from storage.objects where bucket_id='resumes'")).rows, [{ name: resume }]);
        await db.query("update public.applications set status='interview', details=details || '{\"notes\":\"Call tomorrow\"}' where id=$1", [app.id]);
        await assert.rejects(db.query("update public.applications set details=details || '{\"coverLetter\":\"Forged\"}' where id=$1", [app.id]), /Employers can only/);
        await db.query("update public.jobs set status='closed' where id=$1", [job]);
        await as(null, 'anon');
        assert.equal((await db.query('select id from public.jobs')).rows.length, 0);
        await as(seeker);
        assert.equal((await db.query('select id from public.jobs')).rows.length, 1, 'applicants retain access to their closed job');
        await db.query("update public.applications set status='withdrawn', details=details || '{\"withdrawalReason\":\"Accepted another offer\"}' where id=$1", [app.id]);
        await assert.rejects(db.query("update public.applications set status='pending' where id=$1", [app.id]), /Applicants can only/);
        await as(employer);
        await assert.rejects(db.query("update public.applications set status='hired' where id=$1", [app.id]), /Employers can only/);

        // Google users choose a role once, using their authenticated identity.
        const googleEmployer = '66666666-6666-4666-8666-666666666666';
        const googleSeeker = '77777777-7777-4777-8777-777777777777';
        const forgedGoogle = '88888888-8888-4888-8888-888888888888';
        await db.exec('reset role');
        for (const [id, email] of [[googleEmployer, 'google-employer@example.test'], [googleSeeker, 'google-seeker@example.test']]) {
            await db.query(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
                values ($1,$2,'{"name":"Google Test User","user_type":"employer"}','{"provider":"google"}')`, [id, email]);
            assert.equal((await db.query('select id from public.profiles where id=$1', [id])).rows.length, 0,
                'Google metadata does not select an account role');
        }
        await as(null, 'anon');
        await assert.rejects(db.query("select public.create_google_account('employer')"), /permission denied/);
        await as(googleEmployer);
        await assert.rejects(db.query("select public.create_google_account('admin')"), /Choose a job seeker or employer/);
        await assert.rejects(db.query('select public.create_google_account(null)'), /Choose a job seeker or employer/);
        await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('resumes',$1)", [`${googleEmployer}/before-choice.pdf`]), /row-level security/);
        const googleCompany = (await db.query("select public.create_google_account('employer') as profile")).rows[0].profile;
        assert.equal(googleCompany.id, googleEmployer);
        assert.equal(googleCompany.full_name, 'Google Test User');
        assert.equal(googleCompany.email, 'google-employer@example.test');
        assert.equal(googleCompany.user_type, 'employer');
        assert.equal((await db.query('select id from public.company_profiles where id=$1', [googleEmployer])).rows.length, 1);
        assert.equal((await db.query("select public.create_google_account('seeker') as profile")).rows[0].profile.user_type, 'employer');
        await assert.rejects(db.query("update public.profiles set user_type='seeker' where id=$1", [googleEmployer]), /permission denied/);
        await as(googleSeeker);
        assert.equal((await db.query("select public.create_google_account('seeker') as profile")).rows[0].profile.user_type, 'seeker');
        assert.equal((await db.query('select id from public.seeker_profiles where id=$1', [googleSeeker])).rows.length, 1);
        assert.equal((await db.query("select public.create_google_account('employer') as profile")).rows[0].profile.user_type, 'seeker');
        await db.query("insert into storage.objects(bucket_id,name) values ('resumes',$1)", [`${googleSeeker}/resume.pdf`]);
        await as(seeker);
        assert.equal((await db.query("select public.create_google_account('employer') as profile")).rows[0].profile.user_type, 'seeker',
            'Existing email accounts cannot change role through Google onboarding');
        await db.exec('reset role');
        await db.query(`insert into auth.users(id,email,raw_user_meta_data)
            values ($1,'forged@example.test','{"provider":"google","user_type":"seeker"}')`, [forgedGoogle]);
        await db.query('delete from public.profiles where id=$1', [forgedGoogle]);
        await as(forgedGoogle);
        await assert.rejects(db.query("select public.create_google_account('employer')"), /Please sign in with Google first/,
            'Editable user metadata is not proof of a Google identity');
    } finally {
        await db.close();
    }
});
