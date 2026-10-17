import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../scripts/server.mjs';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { SUPABASE_URL } from '../public/assets/js/config/supabase.js';

const authStorageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

const employerId = '11111111-1111-4111-8111-111111111111';
const seekerId = '33333333-3333-4333-8333-333333333333';
const jobId = '55555555-5555-4555-8555-555555555555';
const googleId = '99999999-9999-4999-8999-999999999999';
const stamp = new Date().toISOString();

test('browser workflows use Supabase without writing to the hosted project', { timeout: 240000 }, async t => {
    const server = createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch({
            executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
            headless: true, args: ['--no-sandbox']
        });
        const state = {
            profiles: [
                { id: employerId, full_name: 'Test Employer', email: 'employer@example.test', user_type: 'employer', profile_completed: true },
                { id: seekerId, full_name: 'Test Seeker', email: 'seeker@example.test', user_type: 'seeker', profile_completed: true }
            ],
            company_profiles: [{ id: employerId, details: { companyName: 'Test Company', email: 'employer@example.test' } }],
            seeker_profiles: [{ id: seekerId, details: { fullName: 'Test Seeker', email: 'seeker@example.test', location: 'Kampala', professionalTitle: 'Developer', skills: ['JavaScript'], jobTypes: ['full-time'] } }],
            jobs: [], applications: [], saved_jobs: [], requests: [], googleEnabled: false,
            googleUser: { id: googleId, full_name: 'Google Test User', email: 'google@example.test' }
        };
        function session(role) {
            const profile = role === 'google' ? state.googleUser : state.profiles.find(profile => profile.user_type === role);
            const exp = Math.floor(Date.now() / 1000) + 3600;
            const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
                Buffer.from(JSON.stringify({ sub: profile.id, role: 'authenticated', exp })).toString('base64url'), 'test-signature'].join('.');
            return { access_token: token, refresh_token: 'test-refresh-token', expires_at: exp, expires_in: 3600, token_type: 'bearer',
                user: { id: profile.id, email: profile.email, aud: 'authenticated', role: 'authenticated', created_at: stamp,
                    app_metadata: { provider: role === 'google' ? 'google' : 'email' }, user_metadata: { full_name: profile.full_name, ...(role === 'google' ? {} : { user_type: role }) } } };
        }
        async function pageFor(role) {
            const context = await browser.newContext();
            await context.routeWebSocket('**', socket => socket.close());
            await context.route('**/*', async route => {
                const request = route.request();
                const url = new URL(request.url());
                if (url.origin === origin) return route.continue();
                if (url.hostname.endsWith('.supabase.co')) {
                    const method = request.method();
                    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
                    state.requests.push({ path: url.pathname, method, body, search: url.search });
                    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
                    if (url.pathname === '/auth/v1/settings') return json({ external: { google: state.googleEnabled, email: true } });
                    if (url.pathname === '/auth/v1/authorize') {
                        const auth = session('google');
                        const callback = new URL(url.searchParams.get('redirect_to'));
                        callback.hash = new URLSearchParams({ access_token: auth.access_token, refresh_token: auth.refresh_token, expires_in: '3600', token_type: 'bearer' }).toString();
                        return route.fulfill({ status: 302, headers: { location: callback.href }, body: '' });
                    }
                    if (url.pathname === '/auth/v1/user') return json(session('google').user);
                    if (url.pathname === '/auth/v1/token') return json(session(body.email.startsWith('employer') ? 'employer' : 'seeker'));
                    if (url.pathname === '/auth/v1/signup') return json({ id: 'new-account', email: body.email, identities: [{ id: 'new-identity' }], user_metadata: body.data });
                    if (url.pathname === '/auth/v1/logout') return json({});
                    if (url.pathname === '/rest/v1/rpc/public_job_stats') return json({ jobs: state.jobs.length, companies: 1, seekers: 1 });
                    if (url.pathname === '/rest/v1/rpc/get_company_profile') return json(state.company_profiles.find(row => row.id === body.target_id) ?? null);
                    if (url.pathname === '/rest/v1/rpc/create_google_account') {
                        let profile = state.profiles.find(row => row.id === googleId);
                        if (!profile) {
                            profile = { ...state.googleUser, user_type: body.requested_type, profile_completed: false, created_at: stamp };
                            state.profiles.push(profile);
                            state[profile.user_type === 'employer' ? 'company_profiles' : 'seeker_profiles'].push({ id: googleId, details: { fullName: profile.full_name, companyName: profile.full_name, email: profile.email } });
                        }
                        return json(profile);
                    }
                    if (url.pathname.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/resumes/test.pdf?token=test' });
                    if (url.pathname.startsWith('/storage/v1/object/')) return json({ Key: url.pathname.split('/object/')[1] });
                    const table = url.pathname.split('/').pop();
                    if (!Array.isArray(state[table])) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Unknown mock endpoint"}' });
                    let rows = state[table].filter(row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)));
                    if (method === 'POST') {
                        const data = { id: body.id || crypto.randomUUID(), created_at: stamp, applied_at: stamp, saved_at: stamp, ...body };
                        if (table === 'applications') data.employer_id = employerId;
                        const previous = state[table].findIndex(row => row.id === data.id || table === 'saved_jobs' && row.seeker_id === data.seeker_id && row.job_id === data.job_id);
                        if (previous >= 0) state[table][previous] = data; else state[table].push(data);
                        rows = [data];
                    } else if (method === 'PATCH') {
                        rows.forEach(row => Object.assign(row, body));
                    } else if (method === 'DELETE') {
                        state[table] = state[table].filter(row => !rows.includes(row));
                    }
                    rows = rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000));
                    return json(request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
                }
                if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.emailjs = { send: async () => ({}) };' });
                if (url.pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: '' });
                return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"/>' });
            });
            if (role) await context.addInitScript(({ origin, session, storageKey }) => {
                if (location.origin === origin) sessionStorage.setItem(storageKey, JSON.stringify(session));
            }, { origin, session: session(role), storageKey: authStorageKey });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error' && !/Failed to load resource|WebSocket/i.test(message.text())) errors.push(message.text());
            });
            return { page, context, errors };
        }

        await t.test('public browsing, saved searches, and accessible dialogs', async () => {
            const { page, context, errors } = await pageFor();
            await page.goto(origin, { waitUntil: 'networkidle' });
            assert.equal(await page.locator('#stat-jobs').textContent(), '0');
            assert.match(await page.locator('#jobsGrid').innerText(), /No jobs have been posted/);
            await page.goto(`${origin}/browse_jobs.html`, { waitUntil: 'networkidle' });
            await page.waitForURL('**/jobs.html');
            await page.waitForFunction(() => window.jobsPage?.hasLoaded);
            assert.equal(await page.evaluate(() => window.jobsPage.jobs.length), 0);
            await page.click('#setupAlerts');
            await page.waitForFunction(() => document.getElementById('alertsModal').contains(document.activeElement));
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'saveAlert');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'closeAlertsModal');
            await page.fill('#alertKeywords', 'Developer');
            await page.fill('#alertLocation', 'Kampala');
            await page.click('#saveAlert');
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('joblink.savedSearch')));
            assert.equal(saved.keywords, 'Developer');
            await page.waitForFunction(() => document.activeElement.id === 'setupAlerts');
            await page.goto(`${origin}/jobs.html`, { waitUntil: 'networkidle' });
            assert.equal(await page.inputValue('#jobSearch'), 'Developer');
            assert.equal(await page.inputValue('#locationFilter'), 'Kampala');
            await page.click('#setupAlerts');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.getElementById('alertsModal').classList.contains('show'));
            assert.equal((await page.request.get(`${origin}/package.json`)).status(), 404);
            assert.equal((await page.request.get(`${origin}/supabase/setup.sql`)).status(), 404);
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('registration supports an email-confirmation response without a session', async () => {
            const { page, context, errors } = await pageFor();
            await page.goto(`${origin}/register.html?type=employer`, { waitUntil: 'networkidle' });
            await page.fill('#fullName', 'New Employer');
            await page.fill('#email', 'new@example.test');
            await page.fill('#password', 'test-password');
            await page.click('#signupButton');
            await page.waitForFunction(() => document.getElementById('successMessage').textContent.includes('Check your email'));
            const signup = state.requests.find(request => request.path === '/auth/v1/signup');
            assert.equal(signup.body.data.user_type, 'employer');
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('login routes to the correct dashboard and honors tab-only sessions', async () => {
            const { page, context, errors } = await pageFor();
            await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle' });
            await page.fill('#email', 'seeker@example.test');
            await page.fill('#password', 'test-password');
            await page.uncheck('#rememberMe');
            await page.click('#loginButton');
            await page.waitForURL('**/seeker_dashboard.html');
            await page.waitForFunction(() => window.dashboard?.currentUser);
            assert.equal(await page.evaluate(key => localStorage.getItem(key), authStorageKey), null);
            assert.ok(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey));
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('first employer login opens the profile form, remembers the session, and signs out', async () => {
            state.profiles[0].profile_completed = false;
            const { page, context, errors } = await pageFor();
            await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle' });
            await page.fill('#email', 'employer@example.test');
            await page.fill('#password', 'test-password');
            await page.evaluate(() => { document.getElementById('rememberMe').checked = true; });
            await page.click('#loginButton');
            await page.waitForURL('**/employer_profile.html');
            await page.waitForFunction(() => window.companyProfile?.currentUser);
            assert.ok(await page.evaluate(key => localStorage.getItem(key), authStorageKey));
            await page.evaluate(() => window.companyProfile.handleLogout());
            await page.waitForURL('**/login.html');
            assert.equal(await page.evaluate(key => localStorage.getItem(key), authStorageKey), null);
            assert.deepEqual(errors, []);
            state.profiles[0].profile_completed = true;
            await context.close();
        });
        state.jobs.push({ id: jobId, employer_id: employerId, title: 'Developer', company_name: 'Test Company', job_type: 'full-time',
            category: 'technology', location: 'Kampala', status: 'active', featured: false, created_at: stamp, updated_at: stamp,
            details: { description: 'Build useful software.', salary: 'Negotiable', requirements: 'JavaScript experience', requiredSkills: ['JavaScript'] } });
        await t.test('signing in from a shared job link returns to its application', async () => {
            const { page, context, errors } = await pageFor();
            try {
                await page.goto(`${origin}/job.html?id=${jobId}`, { waitUntil: 'networkidle' });
                await page.click('#applyJob');
                await page.waitForURL('**/login.html');
                await page.fill('#email', 'seeker@example.test');
                await page.fill('#password', 'test-password');
                await page.click('#loginButton');
                await page.waitForURL('**/job.html?*');
                await page.waitForFunction(() => document.getElementById('applicationModal').classList.contains('show'));
                await page.click('#submitApplication');
                await page.waitForSelector('.inline-success');
                assert.equal(state.applications.length, 1);
                assert.equal(state.applications[0].details.profileUsed, true);
                assert.equal(state.applications[0].details.hasResume, false);
                assert.deepEqual(errors, []);
            } finally { state.applications = []; await context.close(); }
        });
        await t.test('automatic profile drafts, direct job applications, private resumes, and withdrawal', async () => {
            const { page, context, errors } = await pageFor('seeker');
            await page.goto(`${origin}/seeker_edit_profile.html`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.profileEditor?.currentUser);
            await page.fill('#professionalTitle', 'Senior Developer');
            await page.waitForFunction(id => JSON.parse(sessionStorage.getItem('joblink.profileDraft:' + id) || 'null')?.data.professionalTitle === 'Senior Developer', seekerId);
            await page.reload({ waitUntil: 'networkidle' });
            await page.waitForFunction(() => document.getElementById('professionalTitle').value === 'Senior Developer');
            await page.evaluate(() => window.profileEditor.handleFormSubmit());
            assert.equal(await page.evaluate(id => sessionStorage.getItem('joblink.profileDraft:' + id), seekerId), null);
            assert.equal(state.seeker_profiles[0].details.professionalTitle, 'Senior Developer');
            await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
            await page.locator('#jobsGrid .vacancy-title a').first().click();
            await page.waitForURL('**/job.html?*');
            await page.waitForFunction(() => window.jobDetails?.account?.userType === 'seeker');
            assert.match(await page.locator('.job-article').innerText(), /JavaScript experience/);
            await page.click('#saveJob');
            await page.waitForFunction(() => document.getElementById('saveJob').getAttribute('aria-pressed') === 'true');
            assert.equal(state.saved_jobs.length, 1);
            await page.click('#saveJob');
            await page.waitForFunction(() => document.getElementById('saveJob').getAttribute('aria-pressed') === 'false');
            assert.equal(state.saved_jobs.length, 0);
            await page.click('#applyJob');
            await page.waitForFunction(() => document.getElementById('applicationModal').contains(document.activeElement));
            await page.fill('#applicationMessage', 'I would love to join your team.');
            await page.setInputFiles('#resumeUpload', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('not a resume') });
            assert.match(await page.locator('#applicationError').innerText(), /PDF, DOC, or DOCX/);
            await page.setInputFiles('#resumeUpload', { name: 'resume.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test resume') });
            await page.click('#submitApplication');
            await page.waitForSelector('.inline-success');
            assert.equal(state.applications.length, 1);
            assert.ok(state.applications[0].resume_path.startsWith(`${seekerId}/`));
            assert.equal(state.applications[0].details.resumeUrl, undefined);
            await page.reload({ waitUntil: 'networkidle' });
            await page.waitForSelector('.inline-success');
            assert.equal(await page.locator('#applyJob').count(), 0);
            await page.goto(`${origin}/applied_jobs.html`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.appliedJobs?.applications.length === 1);
            await page.evaluate(async () => { document.getElementById('withdrawReason').value = 'Other opportunity'; await window.appliedJobs.withdrawApplication(window.appliedJobs.applications[0].id); });
            assert.equal(state.applications[0].status, 'withdrawn');
            const downloadReady = page.waitForEvent('download');
            await page.click('#exportApplications');
            const download = await downloadReady;
            assert.equal(download.suggestedFilename(), 'joblink-applications.csv');
            const stream = await download.createReadStream();
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const csv = Buffer.concat(chunks).toString('utf8');
            assert.match(csv, /Developer/);
            assert.doesNotMatch(csv, /token=test/);
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('employer pages load candidates and update application status', async () => {
            state.applications[0].status = 'pending';
            const { page, context, errors } = await pageFor('employer');
            for (const file of ['employer_dashboard.html', 'employer_profile.html', 'manage_jobs.html']) {
                await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
            }
            await page.waitForSelector('#jobsTableBody tr[data-job-id]');
            const jobsDownload = page.waitForEvent('download');
            await page.click('#exportJobs');
            assert.equal((await jobsDownload).suggestedFilename(), 'joblink-jobs.csv');
            await page.goto(`${origin}/job_posting.html`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.jobPosting?.currentUser);
            await page.fill('#jobTitle', 'QA Engineer');
            await page.fill('#companyName', 'Test Company');
            await page.selectOption('#category', 'it');
            await page.fill('#location', 'Kampala');
            await page.selectOption('#jobType', 'full-time');
            await page.selectOption('#experienceLevel', '1-3');
            await page.fill('#requirements', 'Testing experience');
            await page.fill('#description', 'Help us ship reliable software.');
            await page.setInputFiles('#poster', { name: 'poster.png', mimeType: 'image/png', buffer: Buffer.from('test png') });
            await page.click('#submitBtn');
            await page.waitForFunction(() => document.getElementById('previewModal').classList.contains('show'));
            await page.click('#confirmPost');
            await page.waitForFunction(() => document.getElementById('successModal').classList.contains('show'));
            assert.equal(state.jobs.length, 2);
            assert.equal(state.jobs[1].job_type, 'full-time');
            assert.equal(state.jobs[1].employer_id, employerId);
            assert.equal(state.jobs[1].details.experienceLevel, '1-3');
            assert.match(state.jobs[1].details.posterUrl, /\/job-posters\//);
            const postedId = state.jobs[1].id;
            const originalPoster = state.jobs[1].details.posterUrl;
            await page.goto(`${origin}/job_posting.html?edit=${postedId}`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.jobPosting?.originalJob);
            assert.equal(await page.inputValue('#experienceLevel'), '1-3');
            await page.fill('#jobTitle', 'QA Lead');
            await page.click('#submitBtn');
            await page.click('#confirmPost');
            await page.waitForFunction(() => document.getElementById('successModal').classList.contains('show'));
            assert.equal(state.jobs.length, 2, 'editing updates the existing job instead of creating another');
            assert.equal(state.jobs[1].title, 'QA Lead');
            assert.equal(state.jobs[1].details.posterUrl, originalPoster);
            await page.goto(`${origin}/browse_jobs.html`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.jobsPage?.hasLoaded);
            await page.selectOption('#experienceFilter', 'mid');
            assert.equal(await page.locator('#jobsList .vacancy-title h3 a').textContent(), 'QA Lead');
            await page.goto(`${origin}/manage_applicants.html`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.manageApplicants?.applications.length === 1);
            await page.evaluate(async () => {
                document.getElementById('newStatus').value = 'reviewed';
                document.getElementById('statusNotes').value = 'Good candidate';
                await window.manageApplicants.updateApplicationStatus(window.manageApplicants.applications[0].id);
            });
            assert.equal(state.applications[0].status, 'reviewed');
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('job titles and detail text cannot inject executable markup', async () => {
            const original = state.jobs[0].title;
            const malicious = 'Developer <img src=x onerror="window.__joblinkXSS=1">';
            state.jobs[0].title = malicious;
            const { page, context, errors } = await pageFor('seeker');
            try {
                await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
                assert.equal(await page.locator('#jobsGrid .vacancy-title h3 a').first().textContent(), malicious);
                await page.locator('#jobsGrid .vacancy-title a').first().click();
                await page.waitForSelector('.job-article h1');
                assert.equal(await page.locator('.job-article h1').textContent(), malicious);
                assert.equal(await page.locator('img[src="x"]').count(), 0);
                assert.equal(await page.evaluate(() => window.__joblinkXSS), undefined);
                assert.deepEqual(errors, []);
            } finally { state.jobs[0].title = original; await context.close(); }
        });
        await t.test('help search filters real articles and unavailable support does not claim a submission', async () => {
            const { page, context, errors } = await pageFor();
            await page.goto(`${origin}/help_support.html`, { waitUntil: 'networkidle' });
            assert.equal(await page.locator('#supportForm').isVisible(), false);
            await page.fill('#helpSearch', 'no-such-help-article');
            assert.match(await page.locator('#seekerHelp .empty-help').innerText(), /No matching/);
            await page.fill('#helpSearch', 'profile');
            assert.ok(await page.locator('#seekerHelp .faq-item:visible, #seekerHelp .help-card:visible').count() > 0);
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('mobile layouts prioritize jobs and shared navigation works with a keyboard', async () => {
            const { page, context, errors } = await pageFor();
            await page.setViewportSize({ width: 390, height: 844 });
            for (const file of ['index.html', 'jobs.html']) {
                await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
                const top = await page.locator('.vacancy-card').first().evaluate(node => node.getBoundingClientRect().top);
                assert.ok(top < 800, `${file}: first job starts at ${top}`);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
            assert.equal(await page.locator('#filtersPanel').isVisible(), false);
            await page.click('#toggleFilters');
            assert.equal(await page.locator('#filtersPanel').isVisible(), true);
            await page.click('#closeFilters');
            assert.equal(await page.locator('#toggleFilters').getAttribute('aria-expanded'), 'false');
            await page.locator('.site-menu-toggle').focus();
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('.site-menu-toggle').getAttribute('aria-expanded'), 'true');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.site-menu-toggle').getAttribute('aria-expanded'), 'false');
            await page.goto(`${origin}/about.html`, { waitUntil: 'networkidle' });
            assert.match(await page.locator('.mission-stats').innerText(), /Profiles/);
            assert.doesNotMatch(await page.locator('.mission-stats').innerText(), /NaN|85%|94%/);
            assert.deepEqual(errors, []);
            await context.close();
        });
        await t.test('catalog search covers 1,003 jobs and restores filters, loaded results, and scroll', async () => {
            const originalJobs = state.jobs;
            state.jobs = Array.from({ length: 1003 }, (_, index) => ({
                id: crypto.randomUUID(), employer_id: employerId, title: index === 1002 ? 'Water engineer' : `Catalog vacancy ${index}`,
                company_name: 'Test Company', job_type: index === 1002 ? 'freelance' : 'full-time', category: 'engineering',
                location: index === 1002 ? 'Gulu' : 'Kampala, Uganda', status: 'active', created_at: stamp, updated_at: stamp,
                details: { description: 'Work on useful projects.', requiredSkills: index === 1002 ? ['Hydrology'] : ['Communication'],
                    requirements: 'A relevant diploma, or equivalent experience', salary: index === 1002 ? '2,500,000 UGX/month' : '750k' }
            }));
            const { page, context, errors } = await pageFor();
            try {
                await page.goto(`${origin}/jobs.html`, { waitUntil: 'networkidle' });
                await page.waitForFunction(() => window.jobsPage?.jobs.length === 1003);
                assert.equal(await page.locator('#jobsList .job-card').count(), 12);
                await page.click('#loadMoreJobs');
                assert.equal(await page.locator('#jobsList .job-card').count(), 24);
                await page.fill('#jobSearch', 'Hydrology');
                await page.click('#searchBtn');
                assert.equal(await page.locator('#jobsList .vacancy-title h3 a').textContent(), 'Water engineer');
                assert.match(page.url(), /q=Hydrology/);
                await page.locator('#jobsList .vacancy-title a').click();
                await page.waitForSelector('.job-article h1');
                assert.match(await page.locator('.job-article').innerText(), /A relevant diploma, or equivalent experience/);
                await page.click('#backToResults');
                await page.waitForFunction(() => window.jobsPage?.hasLoaded);
                assert.equal(await page.inputValue('#jobSearch'), 'Hydrology');
                await page.click('[data-remove-filter="search"]');
                await page.fill('#jobSearch', 'Catalog');
                await page.click('#searchBtn');
                await page.click('#loadMoreJobs');
                const target = page.locator('#jobsList .vacancy-title a').nth(18);
                await target.scrollIntoViewIfNeeded();
                const previousScroll = await page.evaluate(() => scrollY);
                await target.click();
                await page.waitForSelector('.job-article h1');
                await page.goBack({ waitUntil: 'networkidle' });
                await page.waitForFunction(() => window.jobsPage?.hasLoaded);
                assert.equal(await page.locator('#jobsList .job-card').count(), 24);
                assert.equal(await page.inputValue('#jobSearch'), 'Catalog');
                await page.waitForFunction(top => Math.abs(scrollY - top) < 50, previousScroll);
                await page.selectOption('#salaryFilter', '2M+');
                assert.equal(await page.locator('#jobsList .job-card').count(), 0);
                assert.equal(await page.locator('#loadMoreJobs').isVisible(), false);
                await page.click('#resetFilters');
                await page.selectOption('#salaryFilter', '2M+');
                assert.equal(await page.locator('#jobsList .vacancy-title h3 a').textContent(), 'Water engineer');
                assert.deepEqual(errors, []);
            } finally { state.jobs = originalJobs; await context.close(); }
        });
        function clearGoogleAccount() {
            for (const table of ['profiles', 'company_profiles', 'seeker_profiles']) state[table] = state[table].filter(row => row.id !== googleId);
            state.googleEnabled = false;
        }
        await t.test('Google provider is unavailable until enabled and OAuth cancellation stays readable', async () => {
            const { page, context, errors } = await pageFor();
            try {
                await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle' });
                assert.equal(await page.locator('#googleSignIn').isDisabled(), true);
                assert.match(await page.locator('#googleSignInStatus').innerText(), /currently unavailable/);
                await page.evaluate(() => sessionStorage.setItem('joblink.oauthAccountType', 'employer'));
                await page.goto(`${origin}/auth.html?error=access_denied&error_description=User%20cancelled`, { waitUntil: 'networkidle' });
                assert.match(await page.locator('#authError').innerText(), /User cancelled/);
                assert.equal(await page.evaluate(() => sessionStorage.getItem('joblink.oauthAccountType')), null);
                assert.deepEqual(errors, []);
            } finally { await context.close(); }
        });
        await t.test('first Google login chooses an account type and returns to the selected job', async () => {
            state.googleEnabled = true;
            const { page, context, errors } = await pageFor();
            try {
                await page.goto(`${origin}/job.html?id=${jobId}`, { waitUntil: 'networkidle' });
                await page.click('#applyJob');
                await page.waitForURL('**/login.html');
                await page.waitForFunction(() => !document.getElementById('googleSignIn').disabled);
                await page.click('#googleSignIn');
                await page.waitForURL('**/auth.html*');
                await page.waitForSelector('#googleAccountForm:visible');
                await page.check('input[name="accountType"][value="seeker"]');
                await page.click('#completeGoogleAccount');
                await page.waitForURL('**/job.html?*');
                await page.waitForFunction(() => document.getElementById('applicationModal').classList.contains('show'));
                const account = state.profiles.find(row => row.id === googleId);
                assert.equal(account.user_type, 'seeker');
                assert.equal(account.email, 'google@example.test');
                assert.equal(await page.evaluate(key => localStorage.getItem(key), authStorageKey), null);
                assert.ok(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey));
                const authorize = state.requests.findLast(request => request.path === '/auth/v1/authorize');
                assert.equal(new URLSearchParams(authorize.search).get('provider'), 'google');
                assert.equal(new URLSearchParams(authorize.search).get('redirect_to'), `${origin}/auth.html`);
                assert.deepEqual(errors, []);
            } finally { clearGoogleAccount(); await context.close(); }
        });
        await t.test('Google signup preserves the employer choice and creates its company profile', async () => {
            state.googleEnabled = true;
            const { page, context, errors } = await pageFor();
            try {
                await page.goto(`${origin}/register.html?type=employer`, { waitUntil: 'networkidle' });
                await page.waitForFunction(() => !document.getElementById('googleSignIn').disabled);
                await page.click('#googleSignIn');
                await page.waitForURL('**/employer_profile.html');
                await page.waitForFunction(() => window.companyProfile?.currentUser);
                assert.equal(state.profiles.find(row => row.id === googleId).user_type, 'employer');
                assert.equal(state.company_profiles.filter(row => row.id === googleId).length, 1);
                assert.equal(state.seeker_profiles.filter(row => row.id === googleId).length, 0);
                assert.deepEqual(errors, []);
            } finally { clearGoogleAccount(); await context.close(); }
        });
        await t.test('returning Google users keep their existing role and Remember Me preference', async () => {
            state.googleEnabled = true;
            state.profiles.push({ ...state.googleUser, user_type: 'employer', profile_completed: true });
            state.company_profiles.push({ id: googleId, details: { companyName: 'Google Test Company', email: state.googleUser.email } });
            const { page, context, errors } = await pageFor();
            const before = state.requests.filter(request => request.path.endsWith('/create_google_account')).length;
            try {
                await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle' });
                await page.locator('label').filter({ has: page.locator('#rememberMe') }).click();
                assert.equal(await page.locator('#rememberMe').isChecked(), true);
                await page.waitForFunction(() => !document.getElementById('googleSignIn').disabled);
                await page.click('#googleSignIn');
                await page.waitForURL('**/employer_dashboard.html');
                await page.waitForFunction(() => window.employerDashboard?.currentUser || document.getElementById('companyName').textContent !== 'Welcome back!');
                assert.ok(await page.evaluate(key => localStorage.getItem(key), authStorageKey));
                assert.equal(state.requests.filter(request => request.path.endsWith('/create_google_account')).length, before);
                assert.equal(state.profiles.find(row => row.id === googleId).user_type, 'employer');
                assert.deepEqual(errors, []);
            } finally { clearGoogleAccount(); await context.close(); }
        });
        await t.test('catalog failures stay retryable and invalid job links have a useful empty state', async () => {
            const { page, context, errors } = await pageFor();
            let unavailable = true;
            await context.route(url => url.hostname.endsWith('.supabase.co') && url.pathname === '/rest/v1/jobs', route => {
                if (unavailable) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Catalog temporarily unavailable"}' });
                return route.fallback();
            });
            try {
                await page.goto(`${origin}/jobs.html`, { waitUntil: 'networkidle' });
                assert.match(await page.locator('#jobsList').innerText(), /Jobs could not be loaded/);
                await page.fill('#jobSearch', 'Developer'); await page.click('#searchBtn');
                assert.match(await page.locator('#jobsList').innerText(), /Jobs could not be loaded/);
                unavailable = false; await page.click('[data-retry-jobs]');
                await page.waitForFunction(() => window.jobsPage?.hasLoaded);
                assert.equal(await page.locator('#jobsList .job-card').count(), 1);
                await page.goto(`${origin}/job.html?id=not-a-job`, { waitUntil: 'networkidle' });
                assert.match(await page.locator('#jobContent').innerText(), /This job is unavailable/);
                assert.equal(errors.length, 1);
                assert.match(errors[0], /Error loading jobs/);
            } finally { await context.close(); }
        });
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
