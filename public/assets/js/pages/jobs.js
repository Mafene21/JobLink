import { escapeHTML, setHTML, showNotice } from '../lib/ui.js';
import { getCurrentUser } from '../lib/supabase-client.js';
import { getRecord, listActiveJobs, listRecords, insertRecord, deleteRecord } from '../lib/data-service.js';
import { compareSalary, matchesSalaryRange } from '../lib/job-display.js';
import { jobCard } from '../lib/job-cards.js';

const fields = { search: 'jobSearch', location: 'locationFilter', jobType: 'jobTypeFilter', category: 'categoryFilter', experience: 'experienceFilter', salary: 'salaryFilter' };
const params = { search: 'q', location: 'location', jobType: 'type', category: 'category', experience: 'experience', salary: 'salary' };
const categoryKey = value => ({ it: 'technology', health: 'healthcare' }[String(value).toLowerCase()] || String(value).toLowerCase());
const initialFilters = () => Object.fromEntries(Object.keys(fields).map(key => [key, '']));

class JobsPage {
    constructor() {
        this.jobs = [];
        this.filteredJobs = [];
        this.filters = initialFilters();
        this.currentPage = 1;
        this.hasLoaded = false;
        this.sortBy = 'newest';
        this.savedJobs = new Map();
        this.readState();
        this.bindEvents();
        this.loadJobs();
    }

    readState() {
        const query = new URLSearchParams(location.search);
        if (!query.size) {
            try {
                const saved = JSON.parse(localStorage.getItem('joblink.savedSearch') || 'null');
                if (saved) for (const key of Object.keys(fields)) this.filters[key] = typeof saved[key] === 'string' ? saved[key] : '';
                if (typeof saved?.keywords === 'string') this.filters.search = saved.keywords;
            } catch { /* An unavailable browser store does not block browsing. */ }
        } else {
            for (const [key, name] of Object.entries(params)) this.filters[key] = query.get(name) || '';
        }
        this.sortBy = ['newest', 'oldest', 'salary-high', 'salary-low'].includes(query.get('sort')) ? query.get('sort') : 'newest';
        this.currentPage = Math.max(1, Math.min(1000, Number.parseInt(query.get('page'), 10) || 1));
        this.syncInputs();
    }

    syncInputs() {
        for (const [key, id] of Object.entries(fields)) {
            const input = document.getElementById(id);
            input.value = this.filters[key];
            if (input.tagName === 'SELECT' && input.selectedIndex < 0) { input.value = ''; this.filters[key] = ''; }
        }
        document.getElementById('sortBy').value = this.sortBy;
    }

    bindEvents() {
        document.getElementById('catalogSearch').addEventListener('submit', event => {
            event.preventDefault();
            this.filters.search = document.getElementById('jobSearch').value.trim();
            this.applyFilters();
        });
        for (const [key, id] of Object.entries(fields)) {
            if (key === 'search') continue;
            const input = document.getElementById(id);
            input.addEventListener('change', () => { this.filters[key] = input.value.trim(); this.applyFilters(); });
        }
        document.getElementById('sortBy').addEventListener('change', event => { this.sortBy = event.target.value; this.applyFilters(); });
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        document.getElementById('toggleFilters').addEventListener('click', () => this.toggleFilters());
        document.getElementById('closeFilters').addEventListener('click', () => {
            document.getElementById('locationFilter').dispatchEvent(new Event('change'));
            this.toggleFilters(false);
            document.getElementById('toggleFilters').focus();
        });
        document.getElementById('filterChips').addEventListener('click', event => {
            const key = event.target.closest('[data-remove-filter]')?.dataset.removeFilter;
            if (!key) return;
            this.filters[key] = ''; this.syncInputs(); this.applyFilters();
            const input = document.getElementById(fields[key]);
            (input.getClientRects().length ? input : document.getElementById('toggleFilters')).focus();
        });
        document.getElementById('loadMoreJobs').addEventListener('click', () => { this.currentPage++; this.render(); });
        document.getElementById('jobsList').addEventListener('click', event => {
            if (event.target.closest('[data-retry-jobs]')) this.loadJobs();
            const save = event.target.closest('[data-save-job]');
            if (save) this.saveJob(save.dataset.saveJob, save);
            if (event.target.closest('.job-detail-link')) {
                try { sessionStorage.setItem('joblink.resultsPosition', JSON.stringify({ url: location.pathname + location.search, scroll: scrollY })); } catch { /* Optional convenience. */ }
            }
        });
        document.getElementById('setupAlerts').addEventListener('click', () => {
            document.getElementById('alertKeywords').value = this.filters.search;
            document.getElementById('alertLocation').value = this.filters.location;
            document.getElementById('alertJobType').value = this.filters.jobType;
            document.getElementById('alertsModal').classList.add('show');
        });
        for (const id of ['closeAlertsModal', 'cancelAlert']) document.getElementById(id).addEventListener('click', () => document.getElementById('alertsModal').classList.remove('show'));
        document.getElementById('savedSearchForm').addEventListener('submit', event => { event.preventDefault(); this.saveSearch(); });
    }

    toggleFilters(open = !document.getElementById('filtersPanel').classList.contains('is-open')) {
        document.getElementById('filtersPanel').classList.toggle('is-open', open);
        document.getElementById('toggleFilters').setAttribute('aria-expanded', String(open));
        if (open) document.getElementById('locationFilter').focus();
    }

    async loadJobs() {
        if (this.loading) return;
        this.loading = true; this.hasLoaded = false;
        document.getElementById('jobsCount').textContent = 'Loading jobs...';
        document.getElementById('jobsList').setAttribute('aria-busy', 'true');
        document.getElementById('loadMoreJobs').hidden = true;
        setHTML(document.getElementById('jobsList'), '<div class="state-card"><p>Finding opportunities...</p></div>');
        try {
            this.jobs = await listActiveJobs();
            this.hasLoaded = true;
            this.applyFilters(false);
            this.loadSavedJobs();
            try {
                const position = JSON.parse(sessionStorage.getItem('joblink.resultsPosition') || 'null');
                if (position?.url === location.pathname + location.search && Number.isFinite(position.scroll)) requestAnimationFrame(() => scrollTo(0, position.scroll));
            } catch { /* Browsing works without stored position. */ }
        } catch (error) {
            console.error('Error loading jobs:', error);
            document.getElementById('jobsCount').textContent = 'Jobs unavailable';
            setHTML(document.getElementById('jobsList'), '<div class="state-card" role="alert"><h2>Jobs could not be loaded</h2><p>Please check your connection and try again.</p><button class="button" data-retry-jobs>Try again</button></div>');
        } finally {
            this.loading = false;
            document.getElementById('jobsList').setAttribute('aria-busy', 'false');
        }
    }

    applyFilters(resetPage = true) {
        if (resetPage) this.currentPage = 1;
        this.writeState();
        this.renderChips();
        if (!this.hasLoaded) return;
        const filter = this.filters;
        const experience = { entry: ['none', '0-1'], mid: ['1-3', '3-5'], senior: ['5-10', '10+'] };
        this.filteredJobs = this.jobs.filter(job => {
            const text = [job.title, job.companyName, job.description, ...(job.requiredSkills || [])].join(' ').toLowerCase();
            return (!filter.search || text.includes(filter.search.toLowerCase()))
                && (!filter.location || job.location?.toLowerCase().includes(filter.location.toLowerCase()))
                && (!filter.jobType || job.jobType === filter.jobType)
                && (!filter.category || categoryKey(job.category) === filter.category)
                && (!filter.experience || experience[filter.experience]?.includes(job.experienceLevel))
                && matchesSalaryRange(job.salary, filter.salary);
        });
        this.filteredJobs.sort((a, b) => {
            if (this.sortBy.startsWith('salary')) return compareSalary(a.salary, b.salary, this.sortBy === 'salary-high' ? 'desc' : 'asc');
            return (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) * (this.sortBy === 'oldest' ? -1 : 1);
        });
        this.render();
    }

    writeState() {
        const url = new URL(location.href);
        url.search = '';
        for (const [key, name] of Object.entries(params)) if (this.filters[key]) url.searchParams.set(name, this.filters[key]);
        if (this.sortBy !== 'newest') url.searchParams.set('sort', this.sortBy);
        if (this.currentPage > 1) url.searchParams.set('page', this.currentPage);
        history.replaceState(null, '', url);
    }

    renderChips() {
        const active = Object.entries(this.filters).filter(([, value]) => value);
        setHTML(document.getElementById('filterChips'), active.map(([key, value]) => {
            const input = document.getElementById(fields[key]);
            const label = input.tagName === 'SELECT' ? input.selectedOptions[0]?.textContent : value;
            return `<button class="filter-chip" type="button" data-remove-filter="${key}" aria-label="Remove ${escapeHTML(key)} filter: ${escapeHTML(label)}">${escapeHTML(label)} <span aria-hidden="true">&times;</span></button>`;
        }).join(''));
        document.getElementById('filterCount').textContent = active.length ? `(${active.length})` : '';
    }

    render() {
        this.writeState();
        const visible = this.filteredJobs.slice(0, this.currentPage * 12);
        document.getElementById('jobsCount').textContent = this.filteredJobs.length ? `Showing ${visible.length} of ${this.filteredJobs.length} jobs` : 'No jobs found';
        setHTML(document.getElementById('jobsList'), visible.length
            ? visible.map(job => jobCard(job, { saved: this.savedJobs.has(job.id) })).join('')
            : `<div class="state-card"><h2>${this.jobs.length ? 'No matching jobs' : 'New jobs will appear here'}</h2><p>${this.jobs.length ? 'Try a different keyword or remove a filter to explore more opportunities.' : 'There are no active vacancies yet. Check back soon.'}</p>${this.jobs.length ? '<button class="button secondary" data-clear-results>Clear filters</button>' : '<a class="button secondary" href="register.html?type=employer">Post the first job</a>'}</div>`);
        document.querySelector('[data-clear-results]')?.addEventListener('click', () => this.resetFilters());
        document.getElementById('loadMoreJobs').hidden = visible.length >= this.filteredJobs.length;
    }

    resetFilters() { this.filters = initialFilters(); this.sortBy = 'newest'; this.syncInputs(); this.applyFilters(); }

    async loadSavedJobs() {
        try {
            this.user = await getCurrentUser();
            if (!this.user) return;
            this.account = await getRecord('users', this.user.id);
            if (this.account?.userType !== 'seeker') return;
            const saved = await listRecords('savedJobs', { filters: [['seekerId', '==', this.user.id]] });
            this.savedJobs = new Map(saved.map(row => [row.jobId, row.id]));
            if (this.hasLoaded) this.render();
        } catch { /* Public job browsing is available even if account loading fails. */ }
    }

    async saveJob(jobId, button) {
        button.disabled = true;
        try {
            const user = await getCurrentUser();
            if (!user) { sessionStorage.setItem('returnUrl', location.href); location.href = 'login.html'; return; }
            const account = await getRecord('users', user.id);
            if (account?.userType !== 'seeker') { showNotice('Saving jobs is available with a job seeker account.'); return; }
            if (this.savedJobs.has(jobId)) { await deleteRecord('savedJobs', this.savedJobs.get(jobId)); this.savedJobs.delete(jobId); showNotice('Job removed from saved jobs.'); }
            else { const saved = await insertRecord('savedJobs', { seekerId: user.id, jobId }); this.savedJobs.set(jobId, saved.id); showNotice('Job saved.'); }
            this.render();
            document.querySelector(`[data-save-job="${CSS.escape(jobId)}"]`)?.focus();
        } catch (error) { showNotice(error.message || 'The job could not be saved.', 'error'); }
        finally { button.disabled = false; }
    }

    saveSearch() {
        try {
            this.filters.search = document.getElementById('alertKeywords').value.trim();
            this.filters.location = document.getElementById('alertLocation').value.trim();
            this.filters.jobType = document.getElementById('alertJobType').value;
            localStorage.setItem('joblink.savedSearch', JSON.stringify({ ...this.filters, keywords: this.filters.search }));
            this.syncInputs(); this.applyFilters();
            document.getElementById('alertsModal').classList.remove('show');
            showNotice('Search saved in this browser.');
        } catch { document.getElementById('savedSearchError').textContent = 'This browser could not save your search.'; }
    }
}
window.jobsPage = new JobsPage();
