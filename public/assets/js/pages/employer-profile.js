import { escapeHTML, setHTML } from '../lib/ui.js';
import { signOut } from '../lib/supabase-client.js';
import { getAccountUser, getRecord, listRecords, saveRecord, uploadFile } from '../lib/data-service.js';

// Company Profile JavaScript with Supabase Integration
class CompanyProfile {
    constructor() {
        this.currentSection = 'basic';
        this.companyData = {};
        this.featuredImages = [];
        this.backendReady = false;
        this.currentUser = null;
        this.init().catch(error => {
            console.error('Unable to load this page:', error);
            this.showToast(error.message || 'Unable to load your account. Please try again.', 'error');
        });
    }

    async init() {
        this.currentUser = await getAccountUser('employer');
        if (!this.currentUser) return;
        this.backendReady = true;
        this.bindEvents();
        await this.loadCompanyData();
        this.updateProgress();
    }

    bindEvents() {
        // Mobile navigation
        const hamburger = document.querySelector('.hamburger');
        const mobileNav = document.getElementById('mobileNav');
        const overlay = document.getElementById('overlay');

        hamburger.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
        });

        overlay.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });

        // Mobile logout
        document.getElementById('mobileLogoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Section navigation
        document.querySelectorAll('.nav-section').forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.currentTarget.getAttribute('data-section');
                this.switchSection(section);
            });
        });

        // Logo upload
        document.getElementById('logoInput').addEventListener('change', (e) => {
            this.handleLogoUpload(e.target.files[0]);
        });

        document.querySelector('.logo-preview').addEventListener('click', () => {
            document.getElementById('logoInput').click();
        });

        // Banner upload
        document.getElementById('bannerInput').addEventListener('change', (e) => {
            this.handleBannerUpload(e.target.files[0]);
        });

        document.querySelector('.banner-preview').addEventListener('click', () => {
            document.getElementById('bannerInput').click();
        });

        // Gallery upload
        document.getElementById('galleryInput').addEventListener('change', (e) => {
            this.handleGalleryUpload(e.target.files);
        });

        document.getElementById('addImageBox').addEventListener('click', () => {
            document.getElementById('galleryInput').click();
        });

        // Remove buttons
        document.getElementById('removeLogoBtn').addEventListener('click', () => {
            this.removeLogo();
        });

        document.getElementById('removeBannerBtn').addEventListener('click', () => {
            this.removeBanner();
        });

        // Character count
        document.getElementById('companyDescription').addEventListener('input', (e) => {
            document.getElementById('descriptionChars').textContent = e.target.value.length;
        });

        // Color picker
        document.getElementById('primaryColor').addEventListener('input', (e) => {
            document.querySelector('.color-value').textContent = e.target.value;
        });

        // Form submission
        document.getElementById('saveProfile').addEventListener('click', () => {
            this.handleFormSubmit();
        });

        // Preview profile
        document.getElementById('previewProfile').addEventListener('click', () => {
            this.showPreviewModal();
        });

        document.getElementById('closePreviewModal').addEventListener('click', () => {
            this.hidePreviewModal();
        });

        document.getElementById('closePreview').addEventListener('click', () => {
            this.hidePreviewModal();
        });

        // Success modal
        document.getElementById('continueEditing').addEventListener('click', () => {
            this.hideSuccessModal();
        });

        document.getElementById('viewDashboard').addEventListener('click', () => {
            window.location.href = 'employer_dashboard.html';
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Close modals on outside click
        document.getElementById('previewModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('previewModal')) {
                this.hidePreviewModal();
            }
        });

        document.getElementById('successModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('successModal')) {
                this.hideSuccessModal();
            }
        });
    }

    async loadCompanyData() {
        if (!this.backendReady || !this.currentUser) {
            this.initializeEmptyData();
            return;
        }

        try {

            const companyDoc = await getRecord('companies', this.currentUser.id);

            if (companyDoc) {
                this.companyData = companyDoc;
                this.featuredImages = this.companyData.featuredImages || [];
                this.populateForm();
                this.loadCompanyStats();
            } else {
                this.initializeEmptyData();
            }

            this.updateProgress();
        } catch (error) {
            console.error('Error loading company data:', error);
            this.initializeEmptyData();
        }
    }

    async loadCompanyStats() {
        if (!this.backendReady || !this.currentUser) return;

        try {


            // Load active jobs count
            const jobsSnapshot = await listRecords('jobs', { filters: [['employerId', '==', this.currentUser.id], ['status', '==', 'active']] });

            document.getElementById('activeJobs').textContent = jobsSnapshot.length;

            // Load applications count
            const applicationsSnapshot = await listRecords('applications', { filters: [['employerId', '==', this.currentUser.id]] });

            document.getElementById('totalApplications').textContent = applicationsSnapshot.length;

            // Load profile views
            document.getElementById('profileViews').textContent = this.companyData.profileViews || 0;

        } catch (error) {
            console.error('Error loading company stats:', error);
        }
    }

    initializeEmptyData() {
        this.companyData = {
            companyName: '',
            companyTagline: '',
            industry: '',
            companySize: '',
            foundedYear: '',
            website: '',
            companyDescription: '',
            mission: '',
            culture: '',
            benefits: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            country: '',
            postalCode: '',
            hideContact: false,
            linkedin: '',
            twitter: '',
            facebook: '',
            instagram: '',
            youtube: '',
            github: '',
            primaryColor: '#3498db',
            logoUrl: 'assets/images/company.svg',
            bannerUrl: 'assets/images/banner.svg',
            featuredImages: []
        };
        this.featuredImages = [];
        this.populateForm();
    }

    populateForm() {
        // Populate all form fields
        Object.keys(this.companyData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = !!this.companyData[key];
                } else if (element.type === 'color') {
                    element.value = this.companyData[key] || '#3498db';
                    document.querySelector('.color-value').textContent = this.companyData[key] || '#3498db';
                } else {
                    element.value = this.companyData[key] || '';
                }
            }
        });

        // Update preview images
        document.getElementById('logoPreview').src = this.companyData.logoUrl;
        document.getElementById('bannerPreview').src = this.companyData.bannerUrl;

        // Update featured images gallery
        this.renderFeaturedImages();

        // Update character count
        const description = document.getElementById('companyDescription');
        document.getElementById('descriptionChars').textContent = description.value.length;
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-section').forEach(btn => {
            btn.classList.remove('active');
        });

        const targetButton = document.querySelector(`[data-section="${section}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        // Update form sections
        document.querySelectorAll('.form-section').forEach(sectionEl => {
            sectionEl.classList.remove('active');
        });

        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        this.currentSection = section;
    }

    async handleLogoUpload(file) {
        if (!file) return;

        if (!this.currentUser) {
            this.showToast('Please log in to upload images', 'error');
            return;
        }

        try {
            // Show loading state
            const logoPreview = document.getElementById('logoPreview');
            logoPreview.style.opacity = '0.5';

            // Upload to Supabase Storage
            const { url: downloadURL } = await uploadFile('company-assets', 'logo', file);

            // Update preview and data
            logoPreview.src = downloadURL;
            logoPreview.style.opacity = '1';
            this.companyData.logoUrl = downloadURL;

            this.showToast('Logo uploaded successfully', 'success');
        } catch (error) {
            console.error('Error uploading logo:', error);
            this.showToast('Error uploading logo. Please try again.', 'error');
        }
    }

    async handleBannerUpload(file) {
        if (!file) return;

        if (!this.currentUser) {
            this.showToast('Please log in to upload images', 'error');
            return;
        }

        try {
            // Show loading state
            const bannerPreview = document.getElementById('bannerPreview');
            bannerPreview.style.opacity = '0.5';

            // Upload to Supabase Storage
            const { url: downloadURL } = await uploadFile('company-assets', 'banner', file);

            // Update preview and data
            bannerPreview.src = downloadURL;
            bannerPreview.style.opacity = '1';
            this.companyData.bannerUrl = downloadURL;

            this.showToast('Banner uploaded successfully', 'success');
        } catch (error) {
            console.error('Error uploading banner:', error);
            this.showToast('Error uploading banner. Please try again.', 'error');
        }
    }

    async handleGalleryUpload(files) {
        if (!files || files.length === 0) return;

        if (!this.currentUser) {
            this.showToast('Please log in to upload images', 'error');
            return;
        }

        // Check if we have space for new images
        const remainingSlots = 6 - this.featuredImages.length;
        if (remainingSlots <= 0) {
            this.showToast('Maximum 6 images allowed in gallery', 'error');
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);

        for (const file of filesToUpload) {
            try {
                // Upload to Supabase Storage
                const { url: downloadURL } = await uploadFile('company-assets', 'gallery', file);

                // Add to featured images
                this.featuredImages.push(downloadURL);

            } catch (error) {
                console.error('Error uploading image:', error);
                this.showToast('Error uploading some images', 'error');
            }
        }

        this.renderFeaturedImages();
        this.showToast(`${filesToUpload.length} images added to gallery`, 'success');
    }

    renderFeaturedImages() {
        const gallery = document.querySelector('.image-gallery');
        const addImageBox = document.getElementById('addImageBox');

        // Clear existing images (except add button)
        setHTML(gallery, '');
        gallery.appendChild(addImageBox);

        // Add featured images
        this.featuredImages.forEach((imageUrl, index) => {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'gallery-image';
            setHTML(imageDiv, `
                <img src="${escapeHTML(imageUrl)}" alt="Featured image ${escapeHTML(index + 1)}">
                <button type="button" class="remove-image" data-index="${escapeHTML(index)}">
                    <i class="fas fa-times"></i>
                </button>
            `);
            gallery.insertBefore(imageDiv, addImageBox);

            // Add event listener to remove button
            imageDiv.querySelector('.remove-image').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFeaturedImage(index);
            });
        });
    }

    removeLogo() {
        const defaultLogo = 'assets/images/company.svg';
        document.getElementById('logoPreview').src = defaultLogo;
        this.companyData.logoUrl = defaultLogo;
        this.showToast('Logo removed', 'info');
    }

    removeBanner() {
        const defaultBanner = 'assets/images/banner.svg';
        document.getElementById('bannerPreview').src = defaultBanner;
        this.companyData.bannerUrl = defaultBanner;
        this.showToast('Banner removed', 'info');
    }

    removeFeaturedImage(index) {
        this.featuredImages.splice(index, 1);
        this.renderFeaturedImages();
        this.showToast('Image removed from gallery', 'info');
    }

    collectFormData() {
        const formData = {
            companyName: document.getElementById('companyName').value,
            companyTagline: document.getElementById('companyTagline').value,
            industry: document.getElementById('industry').value,
            companySize: document.getElementById('companySize').value,
            foundedYear: document.getElementById('foundedYear').value,
            website: document.getElementById('website').value,
            companyDescription: document.getElementById('companyDescription').value,
            mission: document.getElementById('mission').value,
            culture: document.getElementById('culture').value,
            benefits: document.getElementById('benefits').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            country: document.getElementById('country').value,
            postalCode: document.getElementById('postalCode').value,
            hideContact: document.getElementById('hideContact').checked,
            linkedin: document.getElementById('linkedin').value,
            twitter: document.getElementById('twitter').value,
            facebook: document.getElementById('facebook').value,
            instagram: document.getElementById('instagram').value,
            youtube: document.getElementById('youtube').value,
            github: document.getElementById('github').value,
            primaryColor: document.getElementById('primaryColor').value,
            logoUrl: this.companyData.logoUrl,
            bannerUrl: this.companyData.bannerUrl,
            featuredImages: this.featuredImages,
            lastUpdated: new Date()
        };

        return formData;
    }

    async handleFormSubmit() {
        const saveBtn = document.getElementById('saveProfile');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            const formData = this.collectFormData();

            // Validate required fields
            if (!formData.companyName || !formData.industry || !formData.companySize || !formData.companyDescription || !formData.email) {
                this.showToast('Please fill in all required fields', 'error');
                return;
            }

            if (!this.currentUser) {
                this.showToast('Please log in to save your profile', 'error');
                return;
            }

            // Save to Supabase
            await this.saveCompanyData(formData);

            this.showSuccessModal();
        } catch (error) {
            console.error('Error saving company profile:', error);
            this.showToast('Error saving profile. Please try again.', 'error');
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    async saveCompanyData(formData) {
        if (!this.backendReady || !this.currentUser) {
            throw new Error('Not authenticated or Supabase not initialized');
        }

        await saveRecord('companies', this.currentUser.id, formData);


    }

    updateProgress() {
        const completeness = this.calculateCompleteness();
        const progressFill = document.getElementById('profileProgressFill');
        const completionPercent = document.getElementById('profileCompletion');

        if (progressFill) progressFill.style.width = `${completeness}%`;
        if (completionPercent) completionPercent.textContent = `${completeness}%`;
    }

    calculateCompleteness() {
        let score = 0;
        const maxScore = 100;

        const requiredFields = [
            'companyName', 'industry', 'companySize', 'companyDescription', 'email'
        ];

        const optionalFields = [
            'companyTagline', 'website', 'mission', 'culture', 'benefits',
            'phone', 'address', 'logoUrl', 'bannerUrl'
        ];

        // Required fields (60%)
        requiredFields.forEach(field => {
            if (this.companyData[field] && this.companyData[field].toString().trim() !== '') {
                score += 12;
            }
        });

        // Optional fields (30%)
        const filledOptional = optionalFields.filter(field => 
            this.companyData[field] && this.companyData[field].toString().trim() !== ''
        ).length;

        score += (filledOptional / optionalFields.length) * 30;

        // Featured images (10%)
        if (this.featuredImages.length >= 3) {
            score += 10;
        } else if (this.featuredImages.length > 0) {
            score += 5;
        }

        return Math.min(Math.round(score), maxScore);
    }

    showPreviewModal() {
        const formData = this.collectFormData();
        const previewContent = document.getElementById('companyPreview');

        setHTML(previewContent, this.generatePreviewHTML(formData));
        document.getElementById('previewModal').classList.add('show');
    }

    hidePreviewModal() {
        document.getElementById('previewModal').classList.remove('show');
    }

    generatePreviewHTML(data) {
        return `
            <div class="preview-header">
                <img src="${escapeHTML(data.bannerUrl)}" alt="Company Banner" class="preview-banner">
                <div class="preview-logo">
                    <img src="${escapeHTML(data.logoUrl)}" alt="Company Logo">
                </div>
            </div>
            <div class="preview-content">
                <div class="preview-main">
                    <div class="preview-info">
                        <h1>${escapeHTML(data.companyName)}</h1>
                        ${data.companyTagline ? `<p class="preview-tagline">${escapeHTML(data.companyTagline)}</p>` : ''}
                        <p class="preview-description">${escapeHTML(data.companyDescription)}</p>

                        ${data.mission ? `
                        <div class="preview-section">
                            <h3>Mission & Values</h3>
                            <p>${escapeHTML(data.mission)}</p>
                        </div>
                        ` : ''}

                        ${data.culture ? `
                        <div class="preview-section">
                            <h3>Company Culture</h3>
                            <p>${escapeHTML(data.culture)}</p>
                        </div>
                        ` : ''}

                        ${data.benefits ? `
                        <div class="preview-section">
                            <h3>Employee Benefits</h3>
                            <p>${escapeHTML(data.benefits)}</p>
                        </div>
                        ` : ''}
                    </div>

                    <div class="preview-details">
                        <div class="detail-item">
                            <span class="detail-label">Industry</span>
                            <span class="detail-value">${escapeHTML(this.formatIndustry(data.industry))}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Company Size</span>
                            <span class="detail-value">${escapeHTML(data.companySize)}</span>
                        </div>
                        ${data.foundedYear ? `
                        <div class="detail-item">
                            <span class="detail-label">Founded</span>
                            <span class="detail-value">${escapeHTML(data.foundedYear)}</span>
                        </div>
                        ` : ''}
                        ${data.website ? `
                        <div class="detail-item">
                            <span class="detail-label">Website</span>
                            <span class="detail-value">
                                <a href="${escapeHTML(data.website)}" target="_blank">Visit Website</a>
                            </span>
                        </div>
                        ` : ''}

                        ${!data.hideContact ? `
                        <div class="detail-item">
                            <span class="detail-label">Contact Email</span>
                            <span class="detail-value">${escapeHTML(data.email)}</span>
                        </div>
                        ${data.phone ? `
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${escapeHTML(data.phone)}</span>
                        </div>
                        ` : ''}
                        ${data.address ? `
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${escapeHTML(data.address)}, ${escapeHTML(data.city)} ${escapeHTML(data.country ? ', ' + this.formatCountry(data.country) : '')}</span>
                        </div>
                        ` : ''}
                        ` : '<div class="detail-item"><span class="detail-label">Contact</span><span class="detail-value">Contact information hidden</span></div>'}
                    </div>
                </div>

                ${this.hasSocialLinks(data) ? `
                <div class="preview-section">
                    <h3>Follow Us</h3>
                    <div class="social-links">
                        ${data.linkedin ? `<a href="${escapeHTML(data.linkedin)}" class="social-link" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>` : ''}
                        ${data.twitter ? `<a href="${escapeHTML(data.twitter)}" class="social-link" target="_blank"><i class="fab fa-twitter"></i> Twitter</a>` : ''}
                        ${data.facebook ? `<a href="${escapeHTML(data.facebook)}" class="social-link" target="_blank"><i class="fab fa-facebook"></i> Facebook</a>` : ''}
                        ${data.instagram ? `<a href="${escapeHTML(data.instagram)}" class="social-link" target="_blank"><i class="fab fa-instagram"></i> Instagram</a>` : ''}
                        ${data.youtube ? `<a href="${escapeHTML(data.youtube)}" class="social-link" target="_blank"><i class="fab fa-youtube"></i> YouTube</a>` : ''}
                        ${data.github ? `<a href="${escapeHTML(data.github)}" class="social-link" target="_blank"><i class="fab fa-github"></i> GitHub</a>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    hasSocialLinks(data) {
        return data.linkedin || data.twitter || data.facebook || data.instagram || data.youtube || data.github;
    }

    formatIndustry(industry) {
        const industries = {
            'technology': 'Technology',
            'healthcare': 'Healthcare',
            'education': 'Education',
            'finance': 'Finance & Banking',
            'manufacturing': 'Manufacturing',
            'retail': 'Retail',
            'hospitality': 'Hospitality',
            'construction': 'Construction',
            'transportation': 'Transportation',
            'energy': 'Energy',
            'telecommunications': 'Telecommunications',
            'other': 'Other'
        };
        return industries[industry] || industry;
    }

    formatCountry(country) {
        const countries = {
            'uganda': 'Uganda',
            'kenya': 'Kenya',
            'tanzania': 'Tanzania',
            'rwanda': 'Rwanda',
            'other': 'Other'
        };
        return countries[country] || country;
    }

    showSuccessModal() {
        document.getElementById('successModal').classList.add('show');
    }

    hideSuccessModal() {
        document.getElementById('successModal').classList.remove('show');
    }

    async handleLogout() {
        try {
            await signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        }
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
        }, 4000);
    }
}

// Initialize the company profile
document.addEventListener('DOMContentLoaded', () => {
    window.companyProfile = new CompanyProfile();
});