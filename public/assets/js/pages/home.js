import { setHTML } from '../lib/ui.js';
import { listRecords, getPublicStats } from '../lib/data-service.js';
import { jobCard } from '../lib/job-cards.js';

class Homepage {
    constructor() {
        document.getElementById('homeSearch').addEventListener('submit', event => {
            event.preventDefault();
            const url = new URL('jobs.html', location.href);
            for (const [key, id] of [['q', 'jobSearchInput'], ['location', 'locationSearchInput']]) {
                const value = document.getElementById(id).value.trim();
                if (value) url.searchParams.set(key, value);
            }
            location.href = url.href;
        });
        document.getElementById('jobsGrid').addEventListener('click', event => {
            if (event.target.closest('[data-retry-home]')) this.loadFeaturedJobs();
        });
        this.loadFeaturedJobs();
        this.loadRealStats();
    }

    async loadFeaturedJobs() {
        const grid = document.getElementById('jobsGrid');
        setHTML(grid, '<div class="state-card"><p>Loading opportunities...</p></div>');
        try {
            const jobs = await listRecords('jobs', { filters: [['status', '==', 'active']], orderBy: ['createdAt', 'desc'], limit: 4 });
            setHTML(grid, jobs.length ? jobs.map(job => jobCard(job, { save: false })).join('')
                : '<div class="state-card"><h3>New opportunities start here</h3><p>No jobs have been posted yet. Check back soon, or be the first employer to share a vacancy.</p><a class="button secondary" href="register.html?type=employer">Post a job</a></div>');
        } catch (error) {
            console.error('Error loading jobs:', error);
            setHTML(grid, '<div class="state-card"><h3>Jobs could not be loaded</h3><p>Please check your connection and try again.</p><button class="button" data-retry-home>Try again</button></div>');
        }
    }

    async loadRealStats() {
        try {
            const stats = await getPublicStats();
            for (const [id, field] of [['stat-jobs', 'jobs'], ['stat-companies', 'companies'], ['stat-seekers', 'seekers']]) {
                document.getElementById(id).textContent = Number(stats[field] || 0).toLocaleString();
            }
        } catch {
            for (const id of ['stat-jobs', 'stat-companies', 'stat-seekers']) document.getElementById(id).textContent = '—';
        }
    }
}

window.jobLinkHomepage = new Homepage();
