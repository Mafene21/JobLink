import { initializeUI } from './ui.js';
import { site } from '../config/site.js';
import { getCurrentUser, signOut } from './supabase-client.js';
import { getRecord } from './data-service.js';
import { setHTML, showNotice } from './ui.js';

function initializeSite() {
    initializeUI();
    document.querySelectorAll('[data-support-contact]').forEach(element => {
        element.textContent = site.supportEmail || 'A support contact is not available yet.';
    });
    document.querySelectorAll('a[href="browse_jobs.html"]').forEach(link => { link.href = 'jobs.html'; });
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a[href]').forEach(link => {
        const target = new URL(link.href);
        if (target.pathname.split('/').pop() === page && (page !== 'register.html' || target.search === location.search)) link.setAttribute('aria-current', 'page');
    });
    const nav = document.querySelector('[data-site-nav]');
    if (!nav) return;
    const button = nav.querySelector('.site-menu-toggle');
    const links = nav.querySelector('.site-links');
    const close = () => { links.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Open navigation'); };
    button.addEventListener('click', () => {
        const open = links.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    nav.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); button.focus(); } });
    document.addEventListener('click', event => { if (!nav.contains(event.target)) close(); });
    links.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    getCurrentUser().then(async user => {
        if (!user) return;
        const account = await getRecord('users', user.id);
        if (!account) return;
        const destination = account.userType === 'employer' ? 'employer_dashboard.html' : 'seeker_dashboard.html';
        setHTML(nav.querySelector('[data-account-nav]'), `<a href="${destination}">My workspace</a>`);
        setHTML(nav.querySelector('[data-guest-register]'), '<button class="button secondary" type="button" id="siteSignOut">Sign out</button>');
        document.getElementById('siteSignOut').addEventListener('click', async () => {
            try { await signOut(); location.href = 'index.html'; }
            catch (error) { showNotice(error.message || 'Unable to sign out.', 'error'); }
        });
    }).catch(() => { /* Public navigation remains available when signed out. */ });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeSite, { once: true });
else initializeSite();
