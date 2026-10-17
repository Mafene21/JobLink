import { supabase, getCurrentUser } from './supabase-client.js';
import { tableConfig, decodeRecord, encodeRecord, encodeUpdate } from './data-model.js';

function checked(result) {
    if (result.error) {
        const error = result.error;
        if (['PGRST205', '42P01', '42883', 'PGRST202'].includes(error.code)) {
            console.error('Database setup is not complete. Run supabase/setup.sql in the Supabase SQL Editor.', error);
            throw new Error('JobLink is not ready yet. Please contact the site owner.');
        }
        if (error.code === '23505') throw new Error('This job has already been saved or applied for.');
        throw error;
    }
    return result.data;
}

export async function getRecord(name, id) {
    if (name === 'companies') {
        const row = checked(await supabase.rpc('get_company_profile', { target_id: id }));
        return decodeRecord(name, row);
    }
    const row = checked(await supabase.from(tableConfig(name).table).select('*').eq('id', id).maybeSingle());
    return hydrateRecord(name, row);
}

export async function getAccountUser(role) {
    const user = await getCurrentUser();
    if (!user) {
        sessionStorage.setItem('returnUrl', window.location.href);
        window.location.replace('login.html');
        return null;
    }
    const profile = await getRecord('users', user.id);
    if (!profile && user.app_metadata?.provider === 'google') {
        sessionStorage.setItem('returnUrl', window.location.href);
        window.location.replace('auth.html');
        return null;
    }
    if (!profile) throw new Error('Your account profile could not be found. Please contact support.');
    if (profile.userType !== role) {
        window.location.replace(profile.userType === 'employer' ? 'employer_dashboard.html' : 'seeker_dashboard.html');
        return null;
    }
    return user;
}

export async function createGoogleAccount(accountType) {
    return decodeRecord('users', checked(await supabase.rpc('create_google_account', { requested_type: accountType })));
}

export async function listRecords(name, { filters = [], orderBy, limit = 1000, offset = 0 } = {}) {
    const config = tableConfig(name);
    let request = supabase.from(config.table).select('*');
    for (const [field, operator, value] of filters) {
        const column = config.fields[field];
        if (!column) throw new Error(`Cannot filter ${name} by ${field}`);
        if (operator === '==') request = request.eq(column, value);
        else if (operator === 'in') request = request.in(column, value);
        else throw new Error(`Unsupported filter: ${operator}`);
    }
    if (orderBy) {
        const column = config.fields[orderBy[0]];
        if (!column) throw new Error(`Cannot sort ${name} by ${orderBy[0]}`);
        request = request.order(column, { ascending: orderBy[1] !== 'desc' });
    }
    request = request.order('id').range(offset, offset + limit - 1);
    const rows = checked(await request);
    return Promise.all(rows.map(row => hydrateRecord(name, row)));
}

export async function listActiveJobs() {
    // Search must cover the catalog, including records beyond Supabase's row cap.
    // Keep each response small; display pagination is handled by the calling page.
    const jobs = [];
    const limit = 500;
    for (let offset = 0; ; offset += limit) {
        const page = await listRecords('jobs', {
            filters: [['status', '==', 'active']], orderBy: ['createdAt', 'desc'], limit, offset
        });
        jobs.push(...page);
        if (page.length < limit) return jobs;
    }
}

async function hydrateRecord(name, row) {
    const record = decodeRecord(name, row);
    if (name === 'applications' && record?.resumePath) {
        // Persist the private path, never an expiring signed URL.
        const result = await supabase.storage.from('resumes').createSignedUrl(record.resumePath, 3600);
        record.resumeUrl = result.error ? null : result.data.signedUrl;
    }
    return record;
}

export async function insertRecord(name, record) {
    const row = encodeRecord(name, record);
    const table = tableConfig(name).table;
    const request = name === 'savedJobs'
        ? supabase.from(table).upsert(row, { onConflict: 'seeker_id,job_id' })
        : supabase.from(table).insert(row);
    return decodeRecord(name, checked(await request.select('*').single()));
}

export async function saveRecord(name, id, record) {
    const previous = await getRecord(name, id);
    const row = encodeRecord(name, { ...previous, ...record });
    const result = await supabase.from(tableConfig(name).table).upsert({ ...row, id }).select('*').single();
    const saved = decodeRecord(name, checked(result));
    if (name === 'seekers' || name === 'companies') {
        checked(await supabase.from('profiles').update({ profile_completed: true }).eq('id', id));
    }
    return saved;
}

export async function updateRecord(name, id, changes) {
    const previous = await getRecord(name, id);
    if (!previous) throw new Error('This record is unavailable or you do not have access.');
    const row = encodeUpdate(name, { ...previous, ...changes });
    const result = await supabase.from(tableConfig(name).table).update(row).eq('id', id).select('*').single();
    return decodeRecord(name, checked(result));
}

export async function deleteRecord(name, id) {
    checked(await supabase.from(tableConfig(name).table).delete().eq('id', id));
}

export function watchRecord(name, id, callback) {
    let active = true;
    const channel = supabase.channel(`${name}:${id}`).on('postgres_changes', {
        event: '*', schema: 'public', table: tableConfig(name).table, filter: `id=eq.${id}`
    }, () => { getRecord(name, id).then(record => { if (active) callback(record); }).catch(console.error); }).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
}

export async function uploadFile(bucket, folder, file) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Please log in before uploading a file.');
    const image = ['image/jpeg', 'image/png', 'image/webp'];
    const documents = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowed = bucket === 'resumes' ? documents : image;
    const maxSize = bucket === 'resumes' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!allowed.includes(file.type)) throw new Error(bucket === 'resumes' ? 'Please choose a PDF, DOC, or DOCX file.' : 'Please choose a JPEG, PNG, or WebP image.');
    if (file.size > maxSize) throw new Error(`The file must be smaller than ${maxSize / 1024 / 1024} MB.`);
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${extension}`;
    checked(await supabase.storage.from(bucket).upload(path, file));
    const url = bucket === 'resumes' ? null : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return { path, url };
}

export async function getPublicStats() {
    return checked(await supabase.rpc('public_job_stats'));
}
