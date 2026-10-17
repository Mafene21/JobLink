import { escapeHTML } from './ui.js';
import { formatSalary } from './job-display.js';

export function jobLink(job, from = location.pathname + location.search) {
    const url = new URL('job.html', location.href);
    url.searchParams.set('id', job.id);
    url.searchParams.set('from', from);
    return url.pathname + url.search;
}

export function jobTypeLabel(value) {
    return { 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship', remote: 'Remote', freelance: 'Freelance' }[value] || value || 'Not specified';
}

export function dateLabel(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Not specified';
    return new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function jobCard(job, { save = true, saved = false, from, reasons = [] } = {}) {
    const initials = (job.companyName || 'Company').split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
    return `<article class="vacancy-card job-card" data-job-id="${escapeHTML(job.id)}">
        <div class="vacancy-heading">
            <span class="company-monogram" aria-hidden="true">${escapeHTML(initials)}</span>
            <div class="vacancy-title"><p class="vacancy-company">${escapeHTML(job.companyName || 'Company')}</p>
                <h3><a class="job-detail-link" href="${escapeHTML(jobLink(job, from))}">${escapeHTML(job.title || 'Untitled position')}</a></h3></div>
            ${save ? `<button type="button" class="save-vacancy${saved ? ' is-saved' : ''}" data-save-job="${escapeHTML(job.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHTML(job.title)}"><i class="bookmark-icon" aria-hidden="true"></i><span>${saved ? 'Saved' : 'Save'}</span></button>` : ''}
        </div>
        <div class="vacancy-meta"><span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHTML(job.location || 'Location not specified')}</span><span>${escapeHTML(jobTypeLabel(job.jobType || job.type))}</span><span class="vacancy-salary">${escapeHTML(formatSalary(job.salary))}</span></div>
        ${reasons.length ? `<p class="match-reasons">${reasons.map(escapeHTML).join(' &middot; ')}</p>` : ''}
        <div class="vacancy-bottom"><span>${job.applicationDeadline ? `Apply by ${escapeHTML(dateLabel(job.applicationDeadline))}` : `Posted ${escapeHTML(dateLabel(job.createdAt))}`}</span><a class="vacancy-link job-detail-link" href="${escapeHTML(jobLink(job, from))}">View job <span aria-hidden="true">&rarr;</span></a></div>
    </article>`;
}
