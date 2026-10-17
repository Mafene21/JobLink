import DOMPurify from '../vendor/dompurify.js';

export function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"'`]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
    })[character]);
}

export function setHTML(element, markup) {
    if (!element) return;
    const wrappers = { tbody: ['<table><tbody>', '</tbody></table>', 'tbody'],
        thead: ['<table><thead>', '</thead></table>', 'thead'],
        tr: ['<table><tbody><tr>', '</tr></tbody></table>', 'tr'] };
    const wrapper = wrappers[element.localName];
    const source = wrapper ? wrapper[0] + markup + wrapper[1] : markup;
    const fragment = DOMPurify.sanitize(String(source ?? ''), {
        USE_PROFILES: { html: true }, RETURN_DOM_FRAGMENT: true,
        ADD_ATTR: ['target'], FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style']
    });
    fragment.querySelectorAll('a[target="_blank"]').forEach(link => { link.rel = 'noopener noreferrer'; });
    const content = wrapper ? fragment.querySelector(wrapper[2]) : fragment;
    element.replaceChildren(...(content ? [...content.childNodes] : []));
}

export function safeURL(value, protocols = ['http:', 'https:']) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value, location.href);
        return protocols.includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

export function showNotice(message, type = 'info') {
    document.querySelector('.joblink-toast')?.remove();
    const notice = document.createElement('div');
    notice.className = `joblink-toast joblink-toast-${type}`;
    notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 5000);
}

export function openEmailDraft(recipient, { subject = '', body = '', cc = '' } = {}) {
    const valid = value => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254;
    if (!valid(recipient)) throw new Error('An email address is not available for this contact.');
    const params = new URLSearchParams({ subject, body });
    if (cc && valid(cc)) params.set('cc', cc);
    // URLSearchParams encodes spaces as +; email clients expect percent encoding.
    window.location.href = `mailto:${encodeURIComponent(recipient)}?${params.toString().replace(/\+/g, '%20')}`;
}

const methods = {
    jobLinkHomepage: ['searchCategory', 'showJobDetails', 'clearSearchHistory', 'closeAuthModal', 'closeJobModal',
        'handleJobApplication', 'redirectToLogin', 'redirectToRegister'],
    jobsPage: ['clearFilters', 'loadAllJobs', 'showJobDetails', 'closeAuthModal', 'closeJobModal',
        'handleJobApplication', 'redirectToLogin', 'redirectToRegister'],
    profileEditor: ['removeSkill', 'removeReferee', 'sendRefereeEmail'],
    appliedJobs: ['clearFilters', 'goToPage', 'loadAllApplications'],
    manageApplicants: ['clearFilters', 'goToPage', 'loadApplications'],
    manageJobs: ['clearFilters', 'goToPage', 'loadJobs'],
    jobPosting: ['removeFile'],
    dashboard: ['removeResumeFile', 'saveJob', 'showApplicationModal', 'showEmployerDetails', 'showJobDetails']
};

export function initializeUI() {
    initializeDialogs();
    document.addEventListener('click', async event => {
        const trigger = event.target.closest('[data-controller], [data-nav], [data-open-url], [data-action]');
        if (!trigger || trigger.disabled) return;
        const { controller, method, argument, nav, openUrl, action } = trigger.dataset;
        try {
            if (controller && methods[controller]?.includes(method)) {
                event.preventDefault();
                const instance = window[controller];
                if (typeof instance?.[method] !== 'function') return;
                const value = method === 'goToPage' ? Number(argument) : argument;
                await instance[method](value);
            } else if (nav) {
                const url = safeURL(nav);
                if (url && new URL(url).origin === location.origin) location.href = url;
            } else if (openUrl) {
                const url = safeURL(openUrl);
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
            } else if (action === 'reload') location.reload();
            else if (action === 'print') window.print();
            else if (action === 'retry-jobs') await window.jobLinkHomepage?.loadFeaturedJobs();
            else if (action === 'refresh-stats') await window.jobLinkHomepage?.loadRealStats();
        } catch (error) { showNotice(error.message || 'Unable to complete this action. Please try again.', 'error'); }
    });

    document.addEventListener('error', event => {
        if (!(event.target instanceof HTMLImageElement)) return;
        const image = event.target;
        if (image.dataset.fallbackApplied) return;
        image.dataset.fallbackApplied = 'true';
        const kind = /banner/i.test(image.className + image.id) ? 'banner'
            : /avatar|profile|candidate|seeker/i.test(image.alt + image.id) ? 'avatar' : 'company';
        image.src = `assets/images/${kind}.svg`;
    }, true);

    document.querySelectorAll('i.fas, i.fab').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
        if (!input.labels?.length && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', input.placeholder);
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (!modal.hasAttribute('aria-label')) modal.setAttribute('aria-label', modal.querySelector('h2,h3')?.textContent || 'Details');
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(dialog => getComputedStyle(dialog).display !== 'none');
        const dialog = dialogs.at(-1);
        const close = dialog?.querySelector('.close-modal, .modal-close, [aria-label^="Close"]');
        if (close) close.click();
    });
    document.querySelectorAll('.hamburger').forEach(button => {
        button.setAttribute('aria-label', 'Toggle navigation');
        const update = () => button.setAttribute('aria-expanded', String(button.classList.contains('active')));
        new MutationObserver(update).observe(button, { attributes: true, attributeFilter: ['class'] });
        update();
    });
    document.querySelectorAll('.toast').forEach(notice => notice.setAttribute('role', 'status'));
    document.querySelectorAll('a[target="_blank"]').forEach(link => { link.rel = 'noopener noreferrer'; });
    document.querySelectorAll('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });
    const foundedYear = document.getElementById('foundedYear');
    if (foundedYear) foundedYear.max = new Date().getFullYear();
}

// Existing pages use different open classes. Observe the displayed state so all
// dialogs share focus handling without rewriting their business logic.
function initializeDialogs() {
    const previousFocus = new WeakMap();
    let openDialogs = [];
    let background = new Map();
    let queued = false;
    const visible = node => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
    const controls = dialog => [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
        .filter(node => !node.disabled && node.tabIndex >= 0 && !node.closest('[hidden], [inert]') && node.getClientRects().length);
    const focusDialog = dialog => {
        const target = dialog.querySelector('[autofocus]') || controls(dialog)[0] || dialog;
        if (target === dialog) dialog.tabIndex = -1;
        target.focus({ preventScroll: true });
    };
    const refresh = () => {
        queued = false;
        const dialogs = [...document.querySelectorAll('.modal')];
        dialogs.forEach(dialog => {
            dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
            if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) dialog.setAttribute('aria-label', dialog.querySelector('h2,h3')?.textContent || 'Details');
            dialog.querySelectorAll('.close-modal, .modal-close').forEach(close => {
                if (!close.hasAttribute('aria-label')) close.setAttribute('aria-label', 'Close dialog');
                if (!['BUTTON', 'A'].includes(close.tagName)) { close.setAttribute('role', 'button'); close.tabIndex = 0; }
            });
        });
        const now = dialogs.filter(visible);
        for (const [element, wasInert] of background) element.inert = wasInert;
        background = new Map();
        const active = now.at(-1);
        if (active) {
            // Inert siblings at each ancestor level, preserving nested dialogs.
            for (let node = active; node.parentElement && node !== document.body; node = node.parentElement) {
                for (const sibling of node.parentElement.children) if (sibling !== node) {
                    background.set(sibling, sibling.inert); sibling.inert = true;
                }
            }
            if (!openDialogs.includes(active)) {
                previousFocus.set(active, document.activeElement);
                focusDialog(active);
            }
        } else if (openDialogs.length) {
            const trigger = previousFocus.get(openDialogs.at(-1));
            if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
        }
        openDialogs = now;
    };
    new MutationObserver(() => {
        if (!queued) { queued = true; queueMicrotask(refresh); }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    document.addEventListener('keydown', event => {
        const dialog = openDialogs.at(-1);
        if (!dialog) return;
        if (['Enter', ' '].includes(event.key) && event.target.matches('[role="button"].close-modal')) { event.preventDefault(); event.target.click(); }
        if (event.key !== 'Tab') return;
        const items = controls(dialog);
        if (!items.length) { event.preventDefault(); focusDialog(dialog); return; }
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    });
    document.addEventListener('focusin', event => {
        const dialog = openDialogs.at(-1);
        if (dialog && !dialog.contains(event.target)) focusDialog(dialog);
    });
    document.addEventListener('click', event => {
        if (event.target.matches('.design-modal.show')) event.target.querySelector('.modal-close')?.click();
    });
    refresh();
}
