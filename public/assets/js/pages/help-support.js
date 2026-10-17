import { site } from '../config/site.js';
import { openEmailDraft, escapeHTML, setHTML } from '../lib/ui.js';

// Help & Support JavaScript
class HelpSupport {
    constructor() {
        this.currentUserType = 'seeker';
        this.init();
    }

    init() {
        this.bindEvents();
        this.addTouchEvents();
        this.showUserTypeContent(this.currentUserType);
        const form = document.getElementById('supportForm');
        const notice = document.createElement('p');
        notice.className = 'notice';
        notice.textContent = site.supportEmail
            ? 'This form opens a draft in your email app. Send it there to contact support.'
            : 'Support requests are currently unavailable. You can use the help articles and FAQs below.';
        form.before(notice);
        form.hidden = !site.supportEmail;
    }

    bindEvents() {
        // User type selection
        document.querySelectorAll('.user-type-card').forEach(card => {
            card.addEventListener('click', () => {
                const userType = card.getAttribute('data-user-type');
                this.handleUserTypeSelect(userType, card);
            });
        });

        // FAQ accordion
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', () => {
                this.handleFaqClick(question);
            });
        });

        // Support form submission
        document.getElementById('supportForm').addEventListener('submit', (e) => {
            this.handleSupportFormSubmit(e);
        });

        // Success modal close
        document.getElementById('closeSuccessModal').addEventListener('click', () => {
            this.closeSuccessModal();
        });

        // Close modal when clicking outside
        document.getElementById('successModal').addEventListener('click', (e) => {
            if (e.target.id === 'successModal') {
                this.closeSuccessModal();
            }
        });

        // Help search
        document.getElementById('helpSearch').addEventListener('input', (e) => {
            this.handleHelpSearch(e.target.value);
        });
    }

    addTouchEvents() {
        // Add touch feedback for mobile devices
        document.querySelectorAll('.user-type-card, .faq-question, .btn, .help-card, .contact-method').forEach(element => {
            element.addEventListener('touchstart', () => {
                element.classList.add('touch-active');
            });

            element.addEventListener('touchend', () => {
                setTimeout(() => {
                    element.classList.remove('touch-active');
                }, 150);
            });
        });
    }

    handleUserTypeSelect(userType, card) {
        // Update active state
        document.querySelectorAll('.user-type-card').forEach(c => {
            c.classList.remove('active');
        });
        card.classList.add('active');

        // Show relevant content
        this.currentUserType = userType;
        this.showUserTypeContent(userType);
        this.handleHelpSearch(document.getElementById('helpSearch').value);

        this.addClickFeedback(card);
    }

    showUserTypeContent(userType) {
        // Hide all help content
        document.querySelectorAll('.help-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show selected user type content
        document.getElementById(`${userType}Help`).classList.add('active');
    }

    handleFaqClick(question) {
        const faqItem = question.parentElement;
        const isActive = faqItem.classList.contains('active');

        // Close all FAQ items in the same section
        const faqSection = faqItem.closest('.faq-content');
        faqSection.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });

        // Open clicked item if it wasn't active
        if (!isActive) {
            faqItem.classList.add('active');
        }

        this.addClickFeedback(question);
    }

    handleHelpSearch(query) {
        const term = query.trim().toLowerCase();
        const content = document.getElementById(this.currentUserType + 'Help');
        let visible = 0;
        content.querySelectorAll('.faq-item, .help-card').forEach(item => {
            item.hidden = term.length > 0 && !item.textContent.toLowerCase().includes(term);
            if (!item.hidden) visible++;
        });
        let empty = content.querySelector('.empty-help');
        if (!empty) { empty = document.createElement('p'); empty.className = 'empty-help'; empty.setAttribute('role', 'status'); content.appendChild(empty); }
        empty.textContent = visible ? '' : 'No matching help articles. Try a different search.';
        empty.hidden = visible > 0;
    }

    handleSupportFormSubmit(event) {
        event.preventDefault();
        if (!site.supportEmail) { this.showToast('Support requests are currently unavailable.', 'info'); return; }
        try {
            openEmailDraft(site.supportEmail, {
                subject: document.getElementById('subject').value,
                body: 'Account type: ' + document.getElementById('userType').value + '\n\n' + document.getElementById('description').value
            });
            this.showToast('Email draft opened. Send it from your email app.', 'info');
        } catch (error) { this.showToast(error.message, 'error'); }
    }

    showSuccessModal() {
        document.getElementById('successModal').classList.add('show');
    }

    closeSuccessModal() {
        document.getElementById('successModal').classList.remove('show');
    }

    // Helper methods
    addClickFeedback(element) {
        element.classList.add('click-feedback');
        setTimeout(() => {
            element.classList.remove('click-feedback');
        }, 300);
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        setHTML(toast, `
            <div class="toast-content">
                <i class="fas fa-${escapeHTML(type === 'success' ? 'check-circle' : 
                                 type === 'error' ? 'exclamation-circle' : 
                                 'info-circle')}"></i>
                <span>${escapeHTML(message)}</span>
            </div>
        `);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the help & support page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const helpSupport = new HelpSupport();
});
