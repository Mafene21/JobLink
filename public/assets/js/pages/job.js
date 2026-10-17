import { escapeHTML, setHTML, showNotice } from '../lib/ui.js';
import { getCurrentUser } from '../lib/supabase-client.js';
import { getRecord, listRecords, insertRecord, deleteRecord, uploadFile } from '../lib/data-service.js';
import { formatSalary, requirementLines } from '../lib/job-display.js';
import { dateLabel, jobTypeLabel } from '../lib/job-cards.js';

class JobDetails {
    constructor() {
        this.id = new URLSearchParams(location.search).get('id');
        this.container = document.getElementById('jobContent');
        const from = new URLSearchParams(location.search).get('from');
        try {
            const url = new URL(from || 'jobs.html', location.href);
            if (url.origin === location.origin && /\/(jobs|seeker_dashboard|applied_jobs|employer_dashboard|manage_jobs|index)\.html$/.test(url.pathname)) document.getElementById('backToResults').href = url.href;
        } catch { /* Keep the job search link. */ }
        this.container.addEventListener('click', event => {
            if (event.target.closest('#applyJob')) this.apply().catch(error => showNotice(error.message || 'Unable to start your application. Please try again.', 'error'));
            if (event.target.closest('#saveJob')) this.save();
            if (event.target.closest('#shareJob')) this.share();
            if (event.target.closest('#retryJob')) this.load();
        });
        for (const id of ['closeApplication', 'cancelApplication']) document.getElementById(id).addEventListener('click', () => this.closeApplication());
        document.getElementById('applicationForm').addEventListener('submit', event => { event.preventDefault(); this.submit(); });
        document.getElementById('resumeUpload').addEventListener('change', () => this.validateResume());
        this.load();
    }

    async load() {
        try {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.id || '')) {
                this.unavailable(); return;
            }
            this.job = await getRecord('jobs', this.id);
            if (!this.job) { this.unavailable(); return; }
            document.title = `${this.job.title} at ${this.job.companyName || 'Company'} | JobLink`;
            this.render();
            // Company details are optional; they do not block reading a vacancy.
            getRecord('companies', this.job.employerId).then(company => {
                this.company = company;
                const logo = document.getElementById('jobCompanyLogo');
                if (logo && company?.logoUrl) logo.src = company.logoUrl;
            }).catch(() => {});
            await this.loadAccount();
            this.render();
            if (sessionStorage.getItem('pendingJobApplication') === this.id) {
                sessionStorage.removeItem('pendingJobApplication');
                if (this.account?.userType === 'seeker' && !this.application) this.apply();
            }
        } catch (error) {
            console.error('Error loading job details:', error);
            setHTML(this.container, '<div class="state-card" role="alert"><h1>Job details could not be loaded</h1><p>Please check your connection and try again.</p><button class="button" id="retryJob">Try again</button></div>');
        }
    }

    async loadAccount() {
        try {
            this.user = await getCurrentUser();
            if (!this.user) return;
            this.account = await getRecord('users', this.user.id);
            if (this.account?.userType !== 'seeker') return;
            const [applications, saved] = await Promise.all([
                listRecords('applications', { filters: [['jobId', '==', this.id], ['seekerId', '==', this.user.id]], limit: 1 }),
                listRecords('savedJobs', { filters: [['jobId', '==', this.id], ['seekerId', '==', this.user.id]], limit: 1 })
            ]);
            this.application = applications[0]; this.saved = saved[0];
        } catch { showNotice('Your account details could not be loaded. You can still read this job.'); }
    }

    acceptsApplications() {
        const deadline = this.job.applicationDeadline;
        return this.job.status === 'active' && (!deadline || new Date(`${deadline.slice(0, 10)}T23:59:59`) >= new Date());
    }

    render() {
        const job = this.job;
        const open = this.acceptsApplications();
        const listSection = (heading, lines) => lines.length ? `<section class="job-section"><h2>${heading}</h2><ul>${lines.map(line => `<li>${escapeHTML(line)}</li>`).join('')}</ul></section>` : '';
        let action;
        if (this.application) {
            const status = { pending: 'Submitted', reviewed: 'Reviewed', shortlisted: 'Shortlisted', interview: 'Interview', accepted: 'Accepted', hired: 'Hired', rejected: 'Not selected', withdrawn: 'Withdrawn' }[this.application.status] || 'Submitted';
            action = `<div class="inline-success" role="status"><strong>${this.application.status === 'withdrawn' ? 'Application withdrawn' : 'Application submitted'}</strong><p>Current status: ${escapeHTML(status)}</p><a href="applied_jobs.html">View my applications &rarr;</a></div>`;
        }
        else if (this.account?.userType === 'employer') action = job.employerId === this.user.id
            ? `<a class="button wide" href="job_posting.html?edit=${escapeHTML(job.id)}">Edit this job</a>`
            : '<p>Applications are available with a job seeker account.</p>';
        else action = `<button type="button" class="button wide" id="applyJob" ${open ? '' : 'disabled'}>${open ? 'Apply for this job' : 'Applications closed'}</button>`;
        setHTML(this.container, `<div class="job-layout"><article class="job-article"><div class="job-company-line"><img id="jobCompanyLogo" src="${escapeHTML(this.company?.logoUrl || 'assets/images/company.svg')}" alt=""><span>${escapeHTML(job.companyName || 'Company')}</span></div><h1>${escapeHTML(job.title)}</h1><div class="job-facts"><span>${escapeHTML(job.location || 'Location not specified')}</span><span>${escapeHTML(jobTypeLabel(job.jobType))}</span>${job.experienceLevel ? `<span>${escapeHTML(job.experienceLevel === 'none' ? 'No experience required' : job.experienceLevel + ' years experience')}</span>` : ''}</div><section class="job-section"><h2>About this role</h2><p>${escapeHTML(job.description || 'No description provided.')}</p></section>${listSection('What you will need', requirementLines(job.requirements))}${listSection('Responsibilities', job.responsibilities || [])}${job.requiredSkills?.length ? `<section class="job-section"><h2>Skills</h2><div class="skill-tags">${job.requiredSkills.map(skill => `<span>${escapeHTML(skill)}</span>`).join('')}</div></section>` : ''}${listSection('Benefits', job.benefits || [])}${job.posterUrl ? `<section class="job-section"><h2>Job poster</h2><a href="${escapeHTML(job.posterUrl)}" target="_blank" rel="noopener noreferrer"><img class="job-poster" src="${escapeHTML(job.posterUrl)}" alt="Job poster for ${escapeHTML(job.title)}" loading="lazy"></a></section>` : ''}</article><aside class="job-action-panel" aria-label="Apply and save"><span class="job-status ${open ? '' : 'closed'}">${open ? 'Accepting applications' : 'Applications closed'}</span><h2>Offered salary</h2><p class="salary-value">${escapeHTML(formatSalary(job.salary))}</p>${action}${this.account?.userType !== 'employer' ? `<button type="button" class="button secondary" id="saveJob" aria-pressed="${!!this.saved}">${this.saved ? 'Saved — remove' : 'Save job'}</button>` : ''}<button type="button" class="text-button" id="shareJob">Copy job link</button>${job.applicationDeadline ? `<p>Apply by <strong>${escapeHTML(dateLabel(job.applicationDeadline))}</strong></p>` : ''}<p>Posted ${escapeHTML(dateLabel(job.createdAt))}</p><p>Your resume is shared only with the employer receiving your application.</p></aside></div>`);
    }

    unavailable() {
        setHTML(this.container, '<div class="state-card"><h1>This job is unavailable</h1><p>It may have been removed or may no longer be public.</p><a class="button" href="jobs.html">Explore other jobs</a></div>');
    }

    async apply() {
        if (!this.job || !this.acceptsApplications() || this.application) return;
        this.user = await getCurrentUser();
        if (!this.user) {
            sessionStorage.setItem('pendingJobApplication', this.id);
            sessionStorage.setItem('returnUrl', location.href);
            location.href = 'login.html'; return;
        }
        if (!this.account) await this.loadAccount();
        if (this.account?.userType !== 'seeker') { showNotice('Please use a job seeker account to apply.'); return; }
        document.getElementById('applicationIntro').textContent = `Your profile will be shared with ${this.job.companyName || 'the employer'} for ${this.job.title}.`;
        document.getElementById('applicationError').textContent = '';
        document.getElementById('applicationModal').classList.add('show');
    }

    closeApplication() {
        if (this.submitting) return;
        document.getElementById('applicationModal').classList.remove('show');
    }

    validateResume() {
        const file = document.getElementById('resumeUpload').files[0];
        const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const error = file && (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024)
            ? 'Choose a PDF, DOC, or DOCX file up to 5 MB.' : '';
        document.getElementById('applicationError').textContent = error;
        return !error;
    }

    async submit() {
        if (this.submitting || !this.validateResume() || !this.acceptsApplications()) return;
        this.submitting = true;
        const button = document.getElementById('submitApplication');
        button.disabled = true; button.textContent = 'Submitting...';
        document.getElementById('applicationForm').setAttribute('aria-busy', 'true');
        try {
            const file = document.getElementById('resumeUpload').files[0];
            // Keep an uploaded path for retries without duplicating an attachment.
            if (file && this.uploadedFile !== file) {
                this.uploadedResume = await uploadFile('resumes', 'applications', file);
                this.uploadedFile = file;
            }
            this.application = await insertRecord('applications', {
                seekerId: this.user.id, jobId: this.id, jobTitle: this.job.title, companyName: this.job.companyName,
                status: 'pending', coverLetter: document.getElementById('applicationMessage').value.trim(),
                hasResume: !!file, profileUsed: !file,
                ...(file ? { resumePath: this.uploadedResume.path, resumeFileName: file.name } : {})
            });
            this.submitting = false;
            document.getElementById('applicationModal').classList.remove('show');
            this.render();
            const success = this.container.querySelector('.inline-success');
            success.tabIndex = -1; success.focus();
            showNotice('Application submitted. You can track it in your applications.');
        } catch (error) {
            document.getElementById('applicationError').textContent = error.message || 'Your application could not be submitted. Please try again.';
        } finally {
            this.submitting = false; button.disabled = false; button.textContent = 'Submit application';
            document.getElementById('applicationForm').setAttribute('aria-busy', 'false');
        }
    }

    async save() {
        const button = document.getElementById('saveJob');
        button.disabled = true;
        try {
            const user = await getCurrentUser();
            if (!user) { sessionStorage.setItem('returnUrl', location.href); location.href = 'login.html'; return; }
            if (!this.account) await this.loadAccount();
            if (this.account?.userType !== 'seeker') return;
            if (this.saved) { await deleteRecord('savedJobs', this.saved.id); this.saved = null; }
            else this.saved = await insertRecord('savedJobs', { seekerId: user.id, jobId: this.id });
            this.render(); document.getElementById('saveJob').focus();
            showNotice(this.saved ? 'Job saved.' : 'Job removed from saved jobs.');
        } catch (error) { showNotice(error.message || 'The job could not be saved.', 'error'); }
        finally { button.disabled = false; }
    }

    async share() {
        const url = new URL('job.html', location.href); url.searchParams.set('id', this.id);
        try { await navigator.clipboard.writeText(url.href); showNotice('Job link copied.'); }
        catch { showNotice('You can copy this page’s address from your browser.'); }
    }
}
window.jobDetails = new JobDetails();
