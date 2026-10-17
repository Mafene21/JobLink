import { calculateMatchScore, matchReasons } from '../lib/matching.js';
import { jobCard } from '../lib/job-cards.js';
import { escapeHTML, setHTML } from '../lib/ui.js';
import { signOut } from '../lib/supabase-client.js';
import { getAccountUser, getRecord, listRecords, insertRecord, uploadFile } from '../lib/data-service.js';

// Seeker Dashboard JavaScript with Advanced Matching System
class SeekerDashboard {
    constructor() {
        this.userData = null;
        this.userProfile = null;
        this.jobsData = [];
        this.filteredJobs = [];
        this.applicationsData = [];
        this.backendReady = false;
        this.currentUser = null;
        this.currentJobApplication = null;
        this.selectedResumeFile = null;
        this.employersData = new Map();
        this.init().catch(error => {
            console.error('Unable to load this page:', error);
            this.showToast(error.message || 'Unable to load your account. Please try again.', 'error');
        });
    }

    async init() {
        this.currentUser = await getAccountUser('seeker');
        if (!this.currentUser) return;
        this.backendReady = true;
        this.bindEvents();
        await this.loadDashboardData();
        const pendingJob = sessionStorage.getItem('pendingJobApplication');
        if (pendingJob) {
            sessionStorage.removeItem('pendingJobApplication');
            if (this.jobsData.some(job => job.id === pendingJob)) this.showApplicationModal(pendingJob);
            else this.showToast('This job is no longer available.', 'info');
        }
    }

    showLoginPrompt() {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt-overlay';
        setHTML(loginPrompt, `
            <div class="login-prompt">
                <div class="prompt-icon">
                    <i class="fas fa-user-lock"></i>
                </div>
                <h3>Authentication Required</h3>
                <p>Please log in to access your dashboard</p>
                <div class="prompt-actions">
                    <button class="btn btn-primary" data-nav="login.html">
                        <i class="fas fa-sign-in-alt"></i>
                        Go to Login
                    </button>
                    <button class="btn btn-outline" data-nav="index.html">
                        <i class="fas fa-home"></i>
                        Go to Homepage
                    </button>
                </div>
            </div>
        `);
        document.body.appendChild(loginPrompt);
    }

    bindEvents() {
        this.bindMobileNavigation();

        const searchInput = document.getElementById('jobSearch');
        const jobFilter = document.getElementById('jobFilter');
        const refreshMatchesBtn = document.getElementById('refreshMatchesBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        if (jobFilter) jobFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        if (refreshMatchesBtn) refreshMatchesBtn.addEventListener('click', () => this.refreshJobMatches());
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); this.handleLogout(); });

        // Modal events
        const closeModalBtn = document.getElementById('closeApplicationModal');
        const cancelModalBtn = document.getElementById('cancelApplication');
        const submitModalBtn = document.getElementById('submitApplication');
        const closeJobDetailsModalBtn = document.getElementById('closeJobDetailsModal');
        const closeEmployerModalBtn = document.getElementById('closeEmployerModal');

        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.hideApplicationModal());
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => this.hideApplicationModal());
        if (submitModalBtn) submitModalBtn.addEventListener('click', () => this.submitApplication());
        if (closeJobDetailsModalBtn) closeJobDetailsModalBtn.addEventListener('click', () => this.hideJobDetailsModal());
        if (closeEmployerModalBtn) closeEmployerModalBtn.addEventListener('click', () => this.hideEmployerModal());

        this.setupFileUpload();
    }

    bindMobileNavigation() {
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');

        if (hamburger && navLinks) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                navLinks.classList.toggle('active');
                if (navLinks.classList.contains('active')) {
                    this.createMenuOverlay();
                } else {
                    this.removeMenuOverlay();
                }
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                    this.removeMenuOverlay();
                });
            });

            document.addEventListener('click', (e) => {
                if (!navLinks.contains(e.target) && !hamburger.contains(e.target) && navLinks.classList.contains('active')) {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                    this.removeMenuOverlay();
                }
            });
        }
    }

    createMenuOverlay() {
        this.removeMenuOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay active';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', () => {
            const hamburger = document.querySelector('.hamburger');
            const navLinks = document.querySelector('.nav-links');
            if (hamburger && navLinks) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                this.removeMenuOverlay();
            }
        });
    }

    removeMenuOverlay() {
        const overlay = document.querySelector('.menu-overlay');
        if (overlay) overlay.remove();
    }

    setupFileUpload() {
        const resumeUpload = document.getElementById('resumeUpload');
        const resumeUploadArea = document.getElementById('resumeUploadArea');

        if (resumeUpload && resumeUploadArea) {
            resumeUploadArea.addEventListener('click', () => resumeUpload.click());
            resumeUpload.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

            resumeUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                resumeUploadArea.classList.add('dragover');
            });
            resumeUploadArea.addEventListener('dragleave', () => resumeUploadArea.classList.remove('dragover'));
            resumeUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                resumeUploadArea.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }
    }

    handleFileSelect(files) {
        if (files.length === 0) return;
        const file = files[0];

        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('Please upload a PDF, DOC, or DOCX file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        this.selectedResumeFile = file;
        this.showFilePreview(file);
    }

    showFilePreview(file) {
        const resumePreview = document.getElementById('resumePreview');
        const fileSize = this.formatFileSize(file.size);

        if (resumePreview) {
            setHTML(resumePreview, `
                <div class="file-preview-item">
                    <div class="file-info">
                        <i class="fas fa-file-pdf file-icon"></i>
                        <div>
                            <div class="file-name">${escapeHTML(file.name)}</div>
                            <div class="file-size">${escapeHTML(fileSize)}</div>
                        </div>
                    </div>
                    <button class="remove-file" data-controller="dashboard" data-method="removeResumeFile">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);
            resumePreview.classList.add('show');
        }
    }

    removeResumeFile() {
        this.selectedResumeFile = null;
        const resumePreview = document.getElementById('resumePreview');
        const resumeUpload = document.getElementById('resumeUpload');

        if (resumePreview) {
            resumePreview.classList.remove('show');
            setHTML(resumePreview, '');
        }
        if (resumeUpload) resumeUpload.value = '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadDashboardData() {
        try {
            if (this.currentUser) {
                await this.loadUserProfile();
                await this.loadApplications();
                await this.loadJobMatches();
                this.updateGreeting();
            } else {
                this.initializeEmptyData();
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadUserProfile() {
        if (!this.backendReady || !this.currentUser) {
            this.initializeEmptyData();
            return;
        }

        try {

            const userDoc = await getRecord('seekers', this.currentUser.id);

            if (userDoc) {
                this.userProfile = userDoc;
                this.renderUserProfile();
                this.calculateProfileCompletion();
            } else {
                this.showProfileSetupPrompt();
                this.initializeEmptyData();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.initializeEmptyData();
        }
    }

    showProfileSetupPrompt() {
        const existingPrompt = document.querySelector('.profile-setup-prompt');
        if (existingPrompt) return;

        const prompt = document.createElement('div');
        prompt.className = 'profile-setup-prompt';
        setHTML(prompt, `
            <div class="prompt-content">
                <i class="fas fa-user-plus"></i>
                <span>Complete your profile to get better job matches</span>
                <a href="seeker_edit_profile.html" class="btn-setup">Setup Profile</a>
            </div>
        `);

        const dashboardHeader = document.querySelector('.dashboard-header');
        if (dashboardHeader) {
            dashboardHeader.parentNode.insertBefore(prompt, dashboardHeader);
        }
    }

    initializeEmptyData() {
        this.userProfile = {
            fullName: "Guest User",
            professionalTitle: "Update your profile",
            location: "Location not set",
            jobTypes: [],
            categories: [],
            industries: [],
            stats: { applied: 0, matches: 0 }
        };

        this.jobsData = [];
        this.filteredJobs = [];
        this.applicationsData = [];

        this.renderUserProfile();
        this.renderStats();
        this.renderJobsFeed();
        this.renderApplications();
    }

    async loadApplications() {
        if (!this.backendReady || !this.currentUser) {
            this.applicationsData = [];
            this.renderApplications();
            return;
        }

        try {

            let applicationsSnapshot;
            try {
                applicationsSnapshot = await listRecords('applications', { filters: [['seekerId', '==', this.currentUser.id]], orderBy: ['appliedDate', 'desc'], limit: 5 });
            } catch (indexError) {

                applicationsSnapshot = await listRecords('applications', { filters: [['seekerId', '==', this.currentUser.id]], limit: 5 });
            }

            this.applicationsData = [];
            applicationsSnapshot.forEach(doc => {
                const applicationData = doc;
                this.applicationsData.push({ id: doc.id, ...applicationData });
            });

            if (this.applicationsData.length > 0 && this.applicationsData[0].appliedDate) {
                this.applicationsData.sort((a, b) => {
                    const dateA = a.appliedDate?.toDate?.() || new Date(0);
                    const dateB = b.appliedDate?.toDate?.() || new Date(0);
                    return dateB - dateA;
                });
            }

            this.renderApplications();
        } catch (error) {
            console.error('Error loading applications:', error);
            this.applicationsData = [];
            this.renderApplications();
        }
    }

    async loadJobMatches() {
        if (!this.backendReady) {
            this.jobsData = [];
            this.filteredJobs = [];
            this.renderJobsFeed();
            return;
        }

        this.showJobsLoading();

        try {

            const jobsSnapshot = await listRecords('jobs', { filters: [['status', '==', 'active']] });

            this.jobsData = [];
            for (const doc of jobsSnapshot) {
                const jobData = doc;
                let employerData = null;
                if (jobData.employerId) {
                    employerData = await this.loadEmployerData(jobData.employerId);
                }

                this.jobsData.push({
                    id: doc.id,
                    ...jobData,
                    employerData: employerData
                });
            }

            await this.calculateJobMatches();
            this.renderJobsFeed();
        } catch (error) {
            console.error('Error loading jobs:', error);
            this.jobsData = [];
            this.filteredJobs = [];
            this.renderJobsFeed();
        }
    }

    async loadEmployerData(employerId) {
        if (this.employersData.has(employerId)) {
            return this.employersData.get(employerId);
        }

        try {

            let employerDoc = await getRecord('companies', employerId);
            if (employerDoc) {
                const data = employerDoc;
                this.employersData.set(employerId, data);
                return data;
            }

            employerDoc = await getRecord('users', employerId);
            if (employerDoc) {
                const data = employerDoc;
                this.employersData.set(employerId, data);
                return data;
            }


            return null;
        } catch (error) {
            console.error('Error loading employer data:', error);
            return null;
        }
    }

    async calculateJobMatches() {
        if (!this.userProfile) {
            this.filteredJobs = [];
            this.renderStats();
            return;
        }

        this.filteredJobs = this.jobsData.map(job => {
            const companyName = this.getCompanyName(job);
            const companyLogo = this.getCompanyLogo(job);
            const matchScore = this.calculateAdvancedMatchScore(job);

            return {
                ...job,
                company: companyName,
                companyLogo: companyLogo,
                matchScore: matchScore
            };
        }).filter(job => job.matchScore >= 50) // Only show jobs with 50%+ match
          .sort((a, b) => b.matchScore - a.matchScore);

        this.renderStats();
    }

    calculateAdvancedMatchScore(job) { return calculateMatchScore(this.userProfile, job); }

    getCompanyName(job) {
        if (job.employerData) {
            return job.employerData.companyName || 
                   job.employerData.fullName || 
                   'Company not specified';
        }

        return job.company || 
               job.companyName || 
               job.employerName || 
               job.employer || 
               job.postedByCompany ||
               'Company not specified';
    }

    getCompanyLogo(job) {
        if (job.employerData) {
            return job.employerData.logoUrl || 
                   job.employerData.profilePicture ||
                   `assets/images/company.svg`;
        }

        return job.companyLogo || 
               job.logo || 
               job.companyImage || 
               job.employerLogo ||
               `assets/images/company.svg`;
    }

    getEmployerContactInfo(job) {
        if (!job.employerData) {
            return {
                email: 'Not available',
                phone: 'Not available',
                website: 'Not available',
                address: 'Not available',
                description: 'No description available',
                industry: 'Not specified',
                socialMedia: {}
            };
        }

        const employer = job.employerData;
        return {
            email: employer.email || employer.contactEmail || 'Not available',
            phone: employer.phone || employer.contactPhone || 'Not available',
            website: employer.website || employer.companyWebsite || 'Not available',
            address: employer.address || employer.location || employer.companyAddress || 'Not available',
            description: employer.description || employer.about || employer.companyDescription || 'No description available',
            industry: employer.industry || employer.companyIndustry || 'Not specified',
            socialMedia: {
                linkedin: employer.linkedin || employer.linkedIn || '',
                twitter: employer.twitter || '',
                facebook: employer.facebook || '',
                instagram: employer.instagram || ''
            }
        };
    }

    renderUserProfile() {
        if (!this.userProfile) return;

        const userName = document.getElementById('userName');
        const userTitle = document.getElementById('userTitle');
        const userLocation = document.getElementById('userLocation');
        const userJobTypes = document.getElementById('userJobTypes');
        const userCategories = document.getElementById('userCategories');
        const userIndustries = document.getElementById('userIndustries');
        const userLocationPref = document.getElementById('userLocationPref');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) userName.textContent = this.userProfile.fullName || 'Guest User';
        if (userTitle) userTitle.textContent = this.userProfile.professionalTitle || 'Update your profile';
        if (userLocation) userLocation.textContent = this.userProfile.location || 'Location not set';

        if (userJobTypes) {
            const jobTypes = Array.isArray(this.userProfile.jobTypes) ? this.userProfile.jobTypes : [this.userProfile.jobTypes];
            userJobTypes.textContent = jobTypes.filter(Boolean).join(', ') || 'Not specified';
        }

        if (userCategories) {
            const categories = Array.isArray(this.userProfile.categories) ? this.userProfile.categories : [this.userProfile.categories];
            userCategories.textContent = categories.filter(Boolean).join(', ') || 'Not specified';
        }

        if (userIndustries) {
            const industries = Array.isArray(this.userProfile.industries) ? this.userProfile.industries : [this.userProfile.industries];
            userIndustries.textContent = industries.filter(Boolean).join(', ') || 'Not specified';
        }

        if (userLocationPref) userLocationPref.textContent = this.userProfile.location || 'Not specified';

        if (userAvatar && this.userProfile.profilePicture) {
            userAvatar.src = this.userProfile.profilePicture;
        }
    }

    renderStats() {
        const appliedJobs = document.getElementById('appliedJobs');
        const matchedJobs = document.getElementById('matchedJobs');
        const totalMatches = document.getElementById('totalMatches');
        const totalApplications = document.getElementById('totalApplications');
        const matchScore = document.getElementById('matchScore');
        const matchCount = document.getElementById('matchCount');

        if (appliedJobs) appliedJobs.textContent = this.applicationsData.length;
        if (matchedJobs) matchedJobs.textContent = this.filteredJobs.length;
        if (totalMatches) totalMatches.textContent = this.filteredJobs.length;
        if (totalApplications) totalApplications.textContent = this.applicationsData.length;

        const avgMatchScore = this.filteredJobs.length > 0 
            ? Math.round(this.filteredJobs.reduce((sum, job) => sum + job.matchScore, 0) / this.filteredJobs.length)
            : 0;

        if (matchScore) matchScore.textContent = `${avgMatchScore}%`;
        if (matchCount) matchCount.textContent = `${this.filteredJobs.length} matches found`;
        const completion = document.getElementById('profileCompletionSummary');
        if (completion) completion.textContent = `${Math.round(this.calculateProfileCompletion())}%`;
    }

    renderJobsFeed() {
        const feed = document.getElementById('jobsFeed');
        this.hideJobsLoading();
        if (!feed) return;
        setHTML(feed, this.filteredJobs.length
            ? this.filteredJobs.map(job => jobCard({ ...job, companyName: this.getCompanyName(job) }, {
                save: false, reasons: matchReasons(this.userProfile, job)
            })).join('')
            : '<div class="state-card"><h3>Explore more opportunities</h3><p>Add your preferences to see relevant jobs, or browse every current vacancy.</p><a class="button secondary" href="seeker_edit_profile.html">Update profile</a><a class="button" href="jobs.html">Browse all jobs</a></div>');
        const count = document.getElementById('matchCount');
        if (count) count.textContent = `${this.filteredJobs.length} suggested jobs`;
    }

    renderApplications() {
        const applicationsList = document.getElementById('applicationsList');
        this.hideApplicationsLoading();

        if (!applicationsList) return;

        if (this.applicationsData.length === 0) {
            setHTML(applicationsList, `
                <div class="empty-applications">
                    <i class="fas fa-file-alt"></i>
                    <p>No applications yet</p>
                    <small>Start applying to jobs to see your applications here</small>
                </div>
            `);
        } else {
            setHTML(applicationsList, this.applicationsData.map(application => `
                <div class="application-card">
                    <div class="application-header">
                        <div class="application-job-info">
                            <h4>${escapeHTML(application.jobTitle || 'Unknown Job')}</h4>
                            <p class="application-company">${escapeHTML(application.companyName || 'Unknown Company')}</p>
                            <p class="application-date">
                                Applied on ${escapeHTML(application.appliedDate ? new Date(application.appliedDate).toLocaleDateString() : 'Unknown date')}
                            </p>
                        </div>
                        <span class="application-status status-${escapeHTML(application.status || 'pending')}">
                            ${escapeHTML(this.getStatusLabel(application.status))}
                        </span>
                    </div>
                </div>
            `).join(''));
        }
    }

    calculateProfileCompletion() {
        if (!this.userProfile) return 0;

        let completion = 0;
        const fields = [
            'fullName', 'professionalTitle', 'email', 'location', 
            'jobTypes', 'categories', 'industries', 'skills'
        ];

        fields.forEach(field => {
            if (this.userProfile[field]) {
                if (Array.isArray(this.userProfile[field])) {
                    if (this.userProfile[field].length > 0) completion += 12.5;
                } else if (this.userProfile[field].toString().trim() !== '') {
                    completion += 12.5;
                }
            }
        });

        const progressFill = document.getElementById('profileProgressFill');
        const completionPercent = document.getElementById('profileCompletion');

        if (progressFill) progressFill.style.width = `${completion}%`;
        if (completionPercent) completionPercent.textContent = `${Math.round(completion)}%`;

        return completion;
    }

    updateGreeting() {
        const greetingMessage = document.getElementById('greetingMessage');
        const subtitle = document.getElementById('dashboardSubtitle');

        if (!greetingMessage || !subtitle) return;

        const hour = new Date().getHours();
        let greeting = 'Welcome back';

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        greetingMessage.textContent = `${greeting}, ${this.userProfile?.fullName?.split(' ')[0] || 'there'}!`;

        if (this.filteredJobs.length > 0) {
            subtitle.textContent = `We found ${this.filteredJobs.length} jobs matching your profile`;
        }
    }

    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredJobs = [...this.jobsData.map(job => ({
                ...job,
                company: this.getCompanyName(job),
                companyLogo: this.getCompanyLogo(job),
                matchScore: this.calculateAdvancedMatchScore(job)
            })).filter(job => job.matchScore >= 50)];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredJobs = this.jobsData
                .map(job => ({
                    ...job,
                    company: this.getCompanyName(job),
                    companyLogo: this.getCompanyLogo(job),
                    matchScore: this.calculateAdvancedMatchScore(job)
                }))
                .filter(job => 
                    job.matchScore >= 50 &&
                    (job.title?.toLowerCase().includes(term) ||
                     job.company?.toLowerCase().includes(term) ||
                     job.description?.toLowerCase().includes(term) ||
                     job.category?.toString().toLowerCase().includes(term) ||
                     job.industry?.toString().toLowerCase().includes(term) ||
                     (job.requiredSkills && job.requiredSkills.some(skill => 
                         skill.toLowerCase().includes(term)))
                    )
                );
        }
        this.renderJobsFeed();
    }

    handleFilter(filterType) {
        if (filterType === 'all') {
            this.filteredJobs = [...this.jobsData.map(job => ({
                ...job,
                company: this.getCompanyName(job),
                companyLogo: this.getCompanyLogo(job),
                matchScore: this.calculateAdvancedMatchScore(job)
            })).filter(job => job.matchScore >= 50)];
        } else {
            this.filteredJobs = this.jobsData
                .map(job => ({
                    ...job,
                    company: this.getCompanyName(job),
                    companyLogo: this.getCompanyLogo(job),
                    matchScore: this.calculateAdvancedMatchScore(job)
                }))
                .filter(job => job.matchScore >= 50 && job.jobType === filterType);
        }
        this.renderJobsFeed();
    }

    async refreshJobMatches() {
        const refreshBtn = document.getElementById('refreshMatchesBtn');
        if (refreshBtn) {
            setHTML(refreshBtn, '<i class="fas fa-spinner fa-spin"></i> Refreshing...');
            refreshBtn.disabled = true;
        }

        await this.loadJobMatches();

        setTimeout(() => {
            if (refreshBtn) {
                setHTML(refreshBtn, '<i class="fas fa-sync-alt"></i> Refresh Matches');
                refreshBtn.disabled = false;
            }
            this.showToast('Job matches refreshed successfully', 'success');
        }, 1000);
    }

    showJobDetails(jobId) {
        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) return;

        const jobDetailsModal = document.getElementById('jobDetailsModal');
        const jobDetailsContent = document.getElementById('jobDetailsContent');
        const jobDetailsTitle = document.getElementById('jobDetailsTitle');

        const companyName = this.getCompanyName(job);
        const companyLogo = this.getCompanyLogo(job);

        if (jobDetailsTitle) jobDetailsTitle.textContent = job.title || 'Job Details';

        if (jobDetailsContent) {
            setHTML(jobDetailsContent, `
                <div class="job-header-with-logo">
                    <div class="company-logo-large">
                        <img src="${escapeHTML(companyLogo)}" 
                             alt="${escapeHTML(companyName)} Logo">
                    </div>
                    <div class="job-header-info">
                        <h4>${escapeHTML(job.title || 'No Title')}</h4>
                        <p class="company-name-large" data-controller="dashboard" data-method="showEmployerDetails" data-argument="${escapeHTML(job.id)}">
                            ${escapeHTML(companyName)}
                        </p>
                    </div>
                </div>

                <div class="job-details-meta">
                    <div class="job-detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHTML(job.location || 'Location not specified')}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHTML(this.getJobTypeLabel(job.jobType))}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-money-bill-wave"></i>
                        <span>${escapeHTML(job.salary || 'Salary not specified')}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-tags"></i>
                        <span>${escapeHTML(this.formatCategory(job.category))}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-industry"></i>
                        <span>${escapeHTML(this.formatIndustry(job.industry))}</span>
                    </div>
                </div>

                <div class="job-details-section">
                    <h5>Job Description</h5>
                    <p>${escapeHTML(job.description || 'No description available.')}</p>
                </div>

                ${job.responsibilities ? `
                <div class="job-details-section">
                    <h5>Key Responsibilities</h5>
                    <ul class="job-requirements-list">
                        ${job.responsibilities.map(resp => `<li><i class="fas fa-check"></i> ${escapeHTML(resp)}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${job.requiredSkills ? `
                <div class="job-details-section">
                    <h5>Required Skills</h5>
                    <div class="job-skills">
                        ${job.requiredSkills.map(skill => `<span class="job-skill">${escapeHTML(skill)}</span>`).join('')}
                    </div>
                </div>
                ` : ''}

                ${job.benefits ? `
                <div class="job-details-section">
                    <h5>Benefits</h5>
                    <ul class="job-requirements-list">
                        ${job.benefits.map(benefit => `<li><i class="fas fa-check"></i> ${escapeHTML(benefit)}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="job-details-actions">
                    <button class="btn btn-primary" data-controller="dashboard" data-method="showApplicationModal" data-argument="${escapeHTML(job.id)}">
                        Apply Now
                    </button>
                    <button class="btn btn-outline" data-controller="dashboard" data-method="saveJob" data-argument="${escapeHTML(job.id)}">
                        <i class="fas fa-bookmark"></i> Save Job
                    </button>
                    <button class="btn btn-outline" data-controller="dashboard" data-method="showEmployerDetails" data-argument="${escapeHTML(job.id)}">
                        <i class="fas fa-building"></i> View Employer
                    </button>
                </div>
            `);
        }

        if (jobDetailsModal) jobDetailsModal.classList.add('show');
    }

    hideJobDetailsModal() {
        const jobDetailsModal = document.getElementById('jobDetailsModal');
        if (jobDetailsModal) jobDetailsModal.classList.remove('show');
    }

    showEmployerDetails(jobId) {
        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) {
            console.error('Job not found:', jobId);
            return;
        }

        const employerModal = document.getElementById('employerModal');
        const employerContent = document.getElementById('employerContent');
        const employerTitle = document.getElementById('employerTitle');

        const companyName = this.getCompanyName(job);
        const companyLogo = this.getCompanyLogo(job);
        const contactInfo = this.getEmployerContactInfo(job);

        if (employerTitle) employerTitle.textContent = companyName;

        if (employerContent) {
            setHTML(employerContent, `
                <div class="employer-header">
                    <div class="employer-logo-large">
                        <img src="${escapeHTML(companyLogo)}" 
                             alt="${escapeHTML(companyName)} Logo">
                    </div>
                    <div class="employer-header-info">
                        <h4>${escapeHTML(companyName)}</h4>
                        <p class="employer-industry">${escapeHTML(contactInfo.industry)}</p>
                        <p class="employer-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${escapeHTML(contactInfo.address)}
                        </p>
                    </div>
                </div>

                <div class="employer-contact-info">
                    <h5>Contact Information</h5>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <span class="contact-label">Email:</span>
                        <span class="contact-value">
                            ${contactInfo.email !== 'Not available' ? 
                                `<a href="mailto:${escapeHTML(contactInfo.email)}">${escapeHTML(contactInfo.email)}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span class="contact-label">Phone:</span>
                        <span class="contact-value">
                            ${contactInfo.phone !== 'Not available' ? 
                                `<a href="tel:${escapeHTML(contactInfo.phone)}">${escapeHTML(contactInfo.phone)}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-globe"></i>
                        <span class="contact-label">Website:</span>
                        <span class="contact-value">
                            ${contactInfo.website !== 'Not available' ? 
                                `<a href="${escapeHTML(contactInfo.website)}" target="_blank">${escapeHTML(contactInfo.website)}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="contact-label">Address:</span>
                        <span class="contact-value">${escapeHTML(contactInfo.address)}</span>
                    </div>
                </div>

                <div class="employer-description">
                    <h5>About ${escapeHTML(companyName)}</h5>
                    <p>${escapeHTML(contactInfo.description)}</p>
                </div>

                <div class="employer-actions">
                    <button class="btn btn-primary" data-controller="dashboard" data-method="showApplicationModal" data-argument="${escapeHTML(job.id)}">
                        Apply to Job
                    </button>
                    ${contactInfo.email !== 'Not available' ? `
                    <a href="mailto:${escapeHTML(contactInfo.email)}?subject=Regarding ${escapeHTML(job.title || 'Job Application')}" class="btn btn-outline">
                        <i class="fas fa-envelope"></i> Send Email
                    </a>
                    ` : ''}
                    ${contactInfo.phone !== 'Not available' ? `
                    <a href="tel:${escapeHTML(contactInfo.phone)}" class="btn btn-outline">
                        <i class="fas fa-phone"></i> Call Now
                    </a>
                    ` : ''}
                </div>
            `);
        }

        if (employerModal) {
            employerModal.classList.add('show');
            employerModal.style.display = 'flex';
        }
    }

    hideEmployerModal() {
        const employerModal = document.getElementById('employerModal');
        if (employerModal) {
            employerModal.classList.remove('show');
            employerModal.style.display = 'none';
        }
    }

    showApplicationModal(jobId) {
        if (!this.currentUser) {
            this.showToast('Please log in to apply for jobs', 'error');
            return;
        }

        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) return;

        const companyName = this.getCompanyName(job);
        const modalJobTitle = document.getElementById('modalJobTitle');
        const applicationModal = document.getElementById('applicationModal');

        if (modalJobTitle) modalJobTitle.textContent = job.title || 'this position';
        if (applicationModal) applicationModal.classList.add('show');
        this.currentJobApplication = jobId;
    }

    hideApplicationModal() {
        const applicationModal = document.getElementById('applicationModal');
        const applicationMessage = document.getElementById('applicationMessage');

        if (applicationModal) applicationModal.classList.remove('show');
        if (applicationMessage) applicationMessage.value = '';
        this.currentJobApplication = null;
        this.removeResumeFile();
    }

    async submitApplication() {
        if (!this.currentJobApplication || !this.currentUser) return;

        const submitBtn = document.getElementById('submitApplication');
        const applicationMessage = document.getElementById('applicationMessage');

        if (!submitBtn || !applicationMessage) return;

        const message = applicationMessage.value;

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const job = this.jobsData.find(j => j.id === this.currentJobApplication);
            if (!job) {
                throw new Error('Job not found');
            }

            const companyName = this.getCompanyName(job);

            let resumePath = null;
            let resumeFileName = null;

            if (this.selectedResumeFile) {
                const uploaded = await uploadFile('resumes', 'applications', this.selectedResumeFile);
                resumePath = uploaded.path;
                resumeFileName = this.selectedResumeFile.name;
            }

            const applicationData = {
                seekerId: this.currentUser.id,
                jobId: this.currentJobApplication,
                jobTitle: job.title || 'Unknown Position',
                companyName: companyName,
                appliedDate: new Date(),
                status: 'pending',
                coverLetter: message || '',
                hasResume: !!resumePath,
                profileUsed: !resumePath
            };

            if (resumePath) {
                applicationData.resumePath = resumePath;
                applicationData.resumeFileName = resumeFileName;
            }

            await insertRecord('applications', applicationData);

            this.showToast('Application submitted successfully!', 'success');
            this.hideApplicationModal();

            await this.loadApplications();
        } catch (error) {
            console.error('Error submitting application:', error);
            this.showToast(error.message || 'Failed to submit application. Please try again.', 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    async saveJob(jobId) {
        if (!this.currentUser) {
            this.showToast('Please log in to save jobs', 'error');
            return;
        }

        try {

            await insertRecord('savedJobs', {
                seekerId: this.currentUser.id,
                jobId: jobId,
                savedDate: new Date()
            });

            this.showToast('Job saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving job:', error);
            this.showToast('Failed to save job. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            await signOut();
            this.showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
    }

    getJobTypeLabel(jobType) {
        const jobTypeLabels = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'remote': 'Remote',
            'internship': 'Internship'
        };
        return jobTypeLabels[jobType] || jobType;
    }

    formatCategory(category) {
        if (Array.isArray(category)) {
            return category.map(cat => this.capitalizeFirstLetter(cat)).join(', ');
        }
        return this.capitalizeFirstLetter(category) || 'Not specified';
    }

    formatIndustry(industry) {
        if (Array.isArray(industry)) {
            return industry.map(ind => this.capitalizeFirstLetter(ind)).join(', ');
        }
        return this.capitalizeFirstLetter(industry) || 'Not specified';
    }

    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1).replace(/-/g, ' ');
    }

    getStatusLabel(status) {
        const statusLabels = {
            'pending': 'Pending',
            'reviewed': 'Under Review',
            'accepted': 'Accepted',
            'rejected': 'Not Selected'
        };
        return statusLabels[status] || 'Pending';
    }

    showJobsLoading() {
        const jobsLoading = document.getElementById('jobsLoading');
        if (jobsLoading) jobsLoading.style.display = 'block';
    }

    hideJobsLoading() {
        const jobsLoading = document.getElementById('jobsLoading');
        if (jobsLoading) jobsLoading.style.display = 'none';
    }

    hideApplicationsLoading() {
        const applicationsLoading = document.getElementById('applicationsLoading');
        if (applicationsLoading) applicationsLoading.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
        setHTML(toast, `
            <div class="toast-content">
                <i class="fas fa-${escapeHTML(type === 'success' ? 'check-circle' : 'exclamation-circle')}"></i>
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

    showError(message) {
        this.showToast(message, 'error');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SeekerDashboard();
});
