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
        this.showUserTypeContent(userType);
        this.currentUserType = userType;
        
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
        if (query.length > 2) {
            // Simulate search functionality
            this.showToast(`Searching for: "${query}"`, 'info');
        }
    }

    handleSupportFormSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const userType = document.getElementById('userType').value;
        
        if (!userType) {
            this.showToast('Please select whether you are a Job Seeker or Employer', 'error');
            return;
        }
        
        // Simulate form submission
        this.addClickFeedback(form.querySelector('button[type="submit"]'));
        
        // Show success modal after a short delay
        setTimeout(() => {
            this.showSuccessModal();
            form.reset();
        }, 1000);
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
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                 type === 'error' ? 'exclamation-circle' : 
                                 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
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