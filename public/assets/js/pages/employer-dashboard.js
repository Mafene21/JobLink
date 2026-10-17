import { openEmailDraft, escapeHTML, setHTML, safeURL } from '../lib/ui.js';
import { calculateMatchScore } from '../lib/matching.js';

import { signOut } from '../lib/supabase-client.js';
import { getAccountUser, getRecord, listRecords } from '../lib/data-service.js';

// Employer Dashboard JavaScript with Advanced Applicant Tracking
class EmployerDashboard {
    constructor() {
        this.currentUser = null;
        this.companyData = null;
        this.jobs = [];
        this.applications = [];
        this.potentialCandidatesCount = 0;
        this.totalApplicantsCount = 0;
        this.init().catch(error => {
            console.error('Unable to load this page:', error);
            this.showToast(error.message || 'Unable to load your account. Please try again.', 'error');
        });
    }

    async init() {
        this.currentUser = await getAccountUser('employer');
        if (!this.currentUser) return;
        await this.loadCompanyData();
        await this.loadApplications();
        await this.loadJobPostings();
        await this.calculatePotentialCandidatesCount();
        this.updateStats();
        this.bindEvents();
        this.addTouchEvents();
        window.employerDashboard = this;
    }

    async loadCompanyData() {
        try {

            // Try to get company data from companies collection first
            const companyDoc = await getRecord('companies', this.currentUser.id);
            if (companyDoc) {
                this.companyData = companyDoc;

                this.updateCompanyUI();
            } else {

                // Fallback to user data
                const userDoc = await getRecord('users', this.currentUser.id);
                if (userDoc) {
                    this.companyData = userDoc;

                    this.updateCompanyUI();
                } else {

                    this.companyData = {};
                    this.updateCompanyUI();
                }
            }
        } catch (error) {
            console.error('Error loading company data:', error);
            this.showToast('Error loading company data', 'error');
            this.companyData = {};
            this.updateCompanyUI();
        }
    }

    updateCompanyUI() {
        // Update company name
        const companyName = this.companyData?.companyName || this.companyData?.fullName || 'Employer';
        document.getElementById('companyName').textContent = `Welcome back, ${companyName}!`;

        // Update company logo
        const companyLogo = document.getElementById('companyLogo');
        const companyLogoNav = document.getElementById('companyLogoNav');

        const logoUrl = this.companyData?.logoUrl;


        if (logoUrl && logoUrl.trim() !== '' && logoUrl !== 'assets/images/company.svg') {
            companyLogo.src = logoUrl;
            companyLogoNav.src = logoUrl;

        } else {
            // Use default logo if no logo is set
            companyLogo.src = 'assets/images/company.svg';
            companyLogoNav.src = 'assets/images/company.svg';

        }

        // Add error handling for images
        companyLogo.onerror = () => {

            companyLogo.src = 'assets/images/company.svg';
        };

        companyLogoNav.onerror = () => {

            companyLogoNav.src = 'assets/images/company.svg';
        };
    }

    async loadApplications() {
        try {

            const jobsQuery = listRecords('jobs', { filters: [['employerId', '==', this.currentUser.id]] });

            const jobsSnapshot = await jobsQuery;
            const jobIds = jobsSnapshot.map(doc => doc.id);

            this.applications = [];
            this.totalApplicantsCount = 0;

            for (const jobId of jobIds) {
                const applicationsQuery = listRecords('applications', { filters: [['jobId', '==', jobId]] });
                const applicationsSnapshot = await applicationsQuery;

                applicationsSnapshot.forEach(doc => {
                    this.applications.push({ id: doc.id, ...doc });
                });
            }

            this.totalApplicantsCount = this.applications.length;


        } catch (error) {
            console.error('Error loading applications:', error);
            this.applications = [];
            this.totalApplicantsCount = 0;
        }
    }

    async loadJobPostings() {
        const jobsList = document.getElementById('jobsList');

        try {
            // Show loading state
            setHTML(jobsList, `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading job postings...</p>
                </div>
            `);

            const jobsQuery = listRecords('jobs', { filters: [['employerId', '==', this.currentUser.id]] });

            const querySnapshot = await jobsQuery;


            if ((querySnapshot.length === 0)) {
                this.showNoJobsState(jobsList);
                this.jobs = [];
                return;
            }

            this.jobs = [];
            let jobsData = [];

            querySnapshot.forEach((doc) => {
                const job = { id: doc.id, ...doc };
                jobsData.push(job);
            });

            // Calculate applicant counts for each job
            for (let job of jobsData) {
                job.applicantCount = await this.getApplicantCountForJob(job.id);
            }

            // Sort manually by createdAt date (newest first)
            jobsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA; // Descending order (newest first)
            });

            this.jobs = jobsData;
            this.displayJobs(jobsList, jobsData);

        } catch (error) {
            console.error('Error loading job postings:', error);
            this.showJobsErrorState(jobsList, error);
        }
    }

    async getApplicantCountForJob(jobId) {
        try {

            const applicationsQuery = listRecords('applications', { filters: [['jobId', '==', jobId]] });
            const applicationsSnapshot = await applicationsQuery;
            return applicationsSnapshot.length;
        } catch (error) {
            console.error('Error getting applicant count for job:', jobId, error);
            return 0;
        }
    }

    async calculatePotentialCandidatesCount() {
        try {
            let totalPotentialCandidates = 0;


            for (const job of this.jobs) {
                const seekersQuery = listRecords('seekers');
                const seekersSnapshot = await seekersQuery;

                let jobPotentialCandidates = 0;

                seekersSnapshot.forEach(seekerDoc => {
                    const seeker = { id: seekerDoc.id, ...seekerDoc };
                    const matchScore = this.calculateAdvancedMatchScore(job, seeker);

                    if (matchScore >= 50) { // 50% match threshold
                        jobPotentialCandidates++;
                    }
                });

                totalPotentialCandidates += jobPotentialCandidates;
            }

            this.potentialCandidatesCount = totalPotentialCandidates;


        } catch (error) {
            console.error('Error calculating potential candidates:', error);
            this.potentialCandidatesCount = 0;
        }
    }

    calculateAdvancedMatchScore(job, seeker) { return calculateMatchScore(seeker, job); }

    displayJobs(jobsList, jobsData) {
        let jobsHTML = '';
        jobsData.forEach((job) => {
            jobsHTML += this.createJobCardHTML(job);
        });

        setHTML(jobsList, jobsHTML);
        this.bindJobCardEvents();
    }

    createJobCardHTML(job) {
        const createdAt = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt || new Date());
        const formattedDate = this.formatDate(createdAt);

        // Get company logo for job card - handle both company data and job-specific data
        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'assets/images/company.svg';
        const companyName = job.companyName || this.companyData?.companyName || 'Your Company';

        // Create job poster HTML
        const jobPosterHTML = this.createJobPosterHTML(job);

        // Get applicant count for this job
        const applicantCount = job.applicantCount || 0;

        return `
            <div class="job-card" data-job-id="${escapeHTML(job.id)}">
                <div class="job-card-header">
                    <div class="job-header-content">
                        <img src="${escapeHTML(companyLogo)}" alt="Company Logo" class="job-company-logo">
                        <div class="job-title-section">
                            <div class="job-title">${escapeHTML(job.title || 'Untitled Job')}</div>
                            <div class="job-company">${escapeHTML(companyName)}</div>
                        </div>
                    </div>
                    <div class="job-type">${escapeHTML(this.formatJobType(job.jobType) || 'Full-time')}</div>
                </div>

                ${jobPosterHTML}

                <div class="job-meta">
                    <div class="job-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHTML(job.location || 'Remote')}</span>
                    </div>
                    <div class="job-meta-item">
                        <i class="fas fa-money-bill-wave"></i>
                        <span>${escapeHTML(job.salary ? job.salary : 'Salary not specified')}</span>
                    </div>
                    <div class="job-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHTML(formattedDate)}</span>
                    </div>
                </div>
                <div class="job-description">
                    ${escapeHTML(job.description || 'No description provided.')}
                </div>
                <div class="job-footer">
                    <div class="job-applicants">
                        <i class="fas fa-users"></i>
                        ${escapeHTML(applicantCount)} applicant${escapeHTML(applicantCount !== 1 ? 's' : '')}
                    </div>
                    <button class="view-candidates-btn" data-job-id="${escapeHTML(job.id)}">
                        View Potential Candidates
                    </button>
                </div>
            </div>
        `;
    }

    createJobPosterHTML(job) {
        const posterUrl = job.posterUrl;


        if (posterUrl && posterUrl.trim() !== '' && posterUrl !== 'assets/images/company.svg') {
            return `
                <div class="job-poster-container" data-job-id="${escapeHTML(job.id)}">
                    <img src="${escapeHTML(posterUrl)}" 
                         alt="${escapeHTML(job.title || 'Job Poster')}" 
                         class="job-poster-image">
                    <div class="poster-overlay">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
            `;
        } else {
            return this.createNoPosterHTML(job.id);
        }
    }

    createNoPosterHTML(jobId) {
        return `
            <div class="no-poster" data-job-id="${escapeHTML(jobId)}">
                <i class="fas fa-image"></i>
                <span>No job poster image</span>
                <button class="add-poster-btn" data-job-id="${escapeHTML(jobId)}">
                    <i class="fas fa-plus"></i>
                    Add Poster
                </button>
            </div>
        `;
    }

    async showPotentialCandidates(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('jobModal');
        const candidatesList = document.getElementById('candidatesList');
        const modalJobTitle = document.getElementById('modalJobTitle');

        modalJobTitle.textContent = `Potential Candidates - ${job.title}`;

        setHTML(candidatesList, `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Finding potential candidates...</p>
            </div>
        `);

        modal.style.display = 'block';

        try {

            const seekersQuery = listRecords('seekers');
            const seekersSnapshot = await seekersQuery;

            const potentialCandidates = [];

            seekersSnapshot.forEach(seekerDoc => {
                const seeker = { id: seekerDoc.id, ...seekerDoc };
                const matchScore = this.calculateAdvancedMatchScore(job, seeker);

                if (matchScore >= 50) { // 50% match threshold
                    potentialCandidates.push({
                        ...seeker,
                        matchScore: matchScore
                    });
                }
            });

            potentialCandidates.sort((a, b) => b.matchScore - a.matchScore);

            if (potentialCandidates.length === 0) {
                setHTML(candidatesList, `
                    <div class="no-candidates-state">
                        <i class="fas fa-user-slash"></i>
                        <h4>No Potential Candidates Found</h4>
                        <p>Try adjusting your job requirements to find better matches.</p>
                    </div>
                `);
                return;
            }

            let candidatesHTML = '';
            potentialCandidates.forEach(candidate => {
                candidatesHTML += this.createCandidateCardHTML(candidate);
            });

            setHTML(candidatesList, candidatesHTML);

        } catch (error) {
            console.error('Error loading candidates:', error);
            setHTML(candidatesList, `
                <div class="no-candidates-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h4>Error Loading Candidates</h4>
                    <p>Please try again later.</p>
                </div>
            `);
        }
    }

    createCandidateCardHTML(candidate) {
        const skills = candidate.skills || [];
        const displaySkills = skills.length > 0 ? skills.slice(0, 5) : ['No skills listed'];

        return `
            <div class="candidate-card">
                <div class="candidate-header">
                    <div class="candidate-name">${escapeHTML(candidate.fullName || 'Anonymous Candidate')}</div>
                    <div class="match-score">Suggested candidate</div>
                </div>
                <div class="candidate-skills">
                    ${displaySkills.map(skill => 
                        `<span class="skill-tag">${escapeHTML(skill)}</span>`
                    ).join('')}
                    ${skills.length > 5 ? `<span class="skill-tag">+${escapeHTML(skills.length - 5)} more</span>` : ''}
                </div>
                <div class="candidate-meta">
                    <div><i class="fas fa-map-marker-alt"></i> ${escapeHTML(candidate.location || 'Not specified')}</div>
                    <div><i class="fas fa-money-bill-wave"></i> ${escapeHTML(candidate.desiredSalary || 'Not specified')}</div>
                    <div><i class="fas fa-briefcase"></i> ${escapeHTML(this.formatJobTypes(candidate.jobTypes) || 'Not specified')}</div>
                </div>
                <div class="candidate-actions">
                    <button class="btn-view-profile" data-candidate-id="${escapeHTML(candidate.id)}">
                        <i class="fas fa-eye"></i> View Profile
                    </button>
                    <button class="btn-contact" data-candidate-id="${escapeHTML(candidate.id)}">
                        <i class="fas fa-envelope"></i> Contact
                    </button>
                </div>
            </div>
        `;
    }

    formatJobTypes(jobTypes) {
        if (!jobTypes) return '';
        if (Array.isArray(jobTypes)) {
            return jobTypes.map(type => this.formatJobType(type)).join(', ');
        }
        return this.formatJobType(jobTypes);
    }

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'remote': 'Remote',
            'internship': 'Internship'
        };
        return types[jobType] || jobType;
    }

    formatDate(date) {
        if (!date) return 'Recently';

        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    bindEvents() {
        // Mobile navigation
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');

        if (hamburger) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navLinks.classList.toggle('active');

                // Add overlay when menu is open
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
        }

        document.querySelectorAll('.stat-card').forEach((card) => {
            card.addEventListener('click', () => {
                this.handleStatCardClick(card);
            });
        });

        document.getElementById('postJobBtn').addEventListener('click', () => {
            this.handlePostJobClick();
        });

        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('jobModal').style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('jobModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        document.querySelector('.logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        document.getElementById('viewAllApplicants').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleViewAllApplicants();
        });

        this.bindCandidateActions();
        this.bindJobCardEvents();
    }

    bindJobCardEvents() {
        document.querySelectorAll('.view-candidates-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.jobId;
                this.showPotentialCandidates(jobId);
            });
        });

        document.querySelectorAll('.job-poster-container').forEach(container => {
            container.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = container.dataset.jobId;
                this.showJobImageModal(jobId);
            });
        });

        document.querySelectorAll('.add-poster-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const jobId = btn.dataset.jobId;
                this.editJobPoster(jobId);
            });
        });
    }

    bindCandidateActions() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-view-profile') || e.target.closest('.btn-view-profile')) {
                const btn = e.target.classList.contains('btn-view-profile') ? e.target : e.target.closest('.btn-view-profile');
                const candidateId = btn.dataset.candidateId;
                this.viewCandidateProfile(candidateId);
            }

            if (e.target.classList.contains('btn-contact') || e.target.closest('.btn-contact')) {
                const btn = e.target.classList.contains('btn-contact') ? e.target : e.target.closest('.btn-contact');
                const candidateId = btn.dataset.candidateId;
                this.contactCandidate(candidateId);
            }
        });
    }

    createMenuOverlay() {
        // Remove existing overlay if any
        this.removeMenuOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay active';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', () => {
            const hamburger = document.querySelector('.hamburger');
            const navLinks = document.querySelector('.nav-links');

            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            this.removeMenuOverlay();
        });
    }

    removeMenuOverlay() {
        const overlay = document.querySelector('.menu-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    async viewCandidateProfile(candidateId) {
        try {
            const candidate = await getRecord('seekers', candidateId);
            if (!candidate) throw new Error('This candidate profile is unavailable.');
            const modal = document.createElement('div');
            modal.className = 'modal'; modal.style.display = 'flex';
            modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-label', 'Candidate profile');
            setHTML(modal, '<div class="modal-content candidate-summary"><button type="button" class="close-modal" aria-label="Close profile">×</button>'
                + '<h2>' + escapeHTML(candidate.fullName || 'Candidate') + '</h2><p>' + escapeHTML(candidate.professionalTitle || '') + '</p>'
                + '<p>' + escapeHTML(candidate.location || '') + '</p><h3>About</h3><p>' + escapeHTML(candidate.professionalSummary || 'No summary provided.')
                + '</p><h3>Skills</h3><p>' + escapeHTML((candidate.skills || []).join(', ')) + '</p></div>');
            document.body.appendChild(modal);
            modal.querySelector('button').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
            modal.querySelector('button').focus();
        } catch (error) { this.showToast(error.message, 'error'); }
    }

    async contactCandidate(candidateId) {
        try {
            const candidate = await getRecord('seekers', candidateId);
            openEmailDraft(candidate?.email, { subject: 'Job opportunity at ' + (this.companyData?.companyName || 'our company'),
                body: 'Hello ' + (candidate?.fullName || '') + ',\n\nI would like to discuss a job opportunity with you.' });
            this.showToast('Email draft opened. Send it from your email app.', 'info');
        } catch (error) { this.showToast(error.message, 'error'); }
    }

    showJobImageModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job || !job.posterUrl) return;

        const modal = document.createElement('div');
        modal.className = 'modal job-image-modal';
        modal.style.display = 'block';

        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'assets/images/company.svg';
        const companyName = job.companyName || this.companyData?.companyName || 'Your Company';

        setHTML(modal, `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${escapeHTML(job.title || 'Job Poster')}</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body" style="padding: 0;">
                    <img src="${escapeHTML(job.posterUrl)}" 
                         alt="${escapeHTML(job.title || 'Job Poster')}" 
                         style="width: 100%; display: block;">
                </div>
                <div class="job-image-info" style="padding: 20px; border-top: 1px solid #f1f5f9;">
                    <h4 style="margin: 0 0 10px 0; color: #1e293b;">${escapeHTML(job.title || 'Untitled Job')}</h4>
                    <div class="job-image-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; color: #64748b; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center;">
                            <img src="${escapeHTML(companyLogo)}" alt="Company Logo" style="width: 16px; height: 16px; border-radius: 3px; margin-right: 5px;">
                            <span>${escapeHTML(companyName)}</span>
                        </div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-map-marker-alt" style="margin-right: 5px;"></i> ${escapeHTML(job.location || 'Remote')}</div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-money-bill-wave" style="margin-right: 5px;"></i> ${escapeHTML(job.salary || 'Salary not specified')}</div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-clock" style="margin-right: 5px;"></i> ${escapeHTML(this.formatDate(job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt || new Date())))}</div>
                    </div>
                </div>
            </div>
        `);

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    editJobPoster(jobId) {
        this.showToast('Redirecting to edit job page...', 'info');
        setTimeout(() => {
            window.location.href = `job_posting.html?edit=${jobId}`;
        }, 1000);
    }

    updateStats() {
        document.getElementById('activeJobsCount').textContent = this.jobs.length;
        document.getElementById('totalApplicantsCount').textContent = this.totalApplicantsCount;
        document.getElementById('potentialMatchesCount').textContent = this.potentialCandidatesCount;
    }

    addTouchEvents() {
        document.querySelectorAll('.stat-card, .action-btn, .btn, .job-card').forEach(element => {
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

    handleStatCardClick(card) {
        this.addClickFeedback(card);
        const statType = card.querySelector('p').textContent;

        if (statType === 'Potential Matches') {
            this.showToast(`You have ${this.potentialCandidatesCount} potential candidates across all jobs`, 'info');
        } else if (statType === 'Total Applicants') {
            this.showToast(`You have ${this.totalApplicantsCount} total applicants across all jobs`, 'info');
        } else {
            this.showToast(`You have ${this.jobs.length} active job postings`, 'info');
        }
    }

    handlePostJobClick() {
        const btn = document.getElementById('postJobBtn');
        this.addClickFeedback(btn);
        window.location.href = 'job_posting.html';
    }

    handleCreateFirstJob() {
        const btn = document.getElementById('createFirstJob');
        this.addClickFeedback(btn);
        window.location.href = 'job_posting.html';
    }

    async handleLogout() {
        try {
            await signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
    }

    async handleViewAllApplicants() {
        try {
            this.showToast('Loading applicants...', 'info');

            const jobsQuery = listRecords('jobs', { filters: [['employerId', '==', this.currentUser.id]] });

            const jobsSnapshot = await jobsQuery;
            const jobIds = jobsSnapshot.map(doc => doc.id);

            if (jobIds.length === 0) {
                this.showToast('No jobs found', 'info');
                return;
            }

            const applications = [];
            for (const jobId of jobIds) {
                const applicationsQuery = listRecords('applications', { filters: [['jobId', '==', jobId]] });
                const applicationsSnapshot = await applicationsQuery;

                applicationsSnapshot.forEach(doc => {
                    applications.push({ id: doc.id, ...doc, jobId });
                });
            }

            if (applications.length === 0) {
                this.showToast('No applicants found', 'info');
                return;
            }

            const applicantsWithDetails = [];

            for (const application of applications) {
                const jobDoc = await getRecord('jobs', application.jobId);
                const job = jobDoc ? jobDoc : { title: 'Unknown Job' };

                const seekerDoc = await getRecord('seekers', application.seekerId);
                const seeker = seekerDoc ? seekerDoc : { fullName: 'Unknown Seeker' };

                applicantsWithDetails.push({
                    ...application,
                    jobTitle: job.title,
                    seekerName: seeker.fullName,
                    seekerEmail: seeker.email,
                    seekerPhone: seeker.phone,
                    seekerResume: application.resumeUrl,
                    seekerSkills: seeker.skills || []
                });
            }

            this.showApplicantsModal(applicantsWithDetails);

        } catch (error) {
            console.error('Error loading applicants:', error);
            this.showToast('Error loading applicants', 'error');
        }
    }

    showApplicantsModal(applicants) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';

        let applicantsHTML = '';
        applicants.forEach(applicant => {
            applicantsHTML += `
                <div class="applicant-card" style="border: 1px solid #f1f5f9; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: white;">
                    <div class="applicant-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <h4 style="margin: 0; color: #1e293b;">${escapeHTML(applicant.seekerName || 'Unknown Seeker')}</h4>
                            <p style="margin: 5px 0; color: #2563eb; font-weight: 500;">Applied for: ${escapeHTML(applicant.jobTitle)}</p>
                        </div>
                        <div style="color: #64748b; font-size: 0.9rem;">
                            ${escapeHTML(applicant.appliedDate ? new Date(applicant.appliedDate).toLocaleDateString() : 'Unknown date')}
                        </div>
                    </div>

                    <div class="applicant-contact" style="margin-bottom: 10px;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            ${applicant.seekerEmail ? `<div><i class="fas fa-envelope"></i> ${escapeHTML(applicant.seekerEmail)}</div>` : ''}
                            ${applicant.seekerPhone ? `<div><i class="fas fa-phone"></i> ${escapeHTML(applicant.seekerPhone)}</div>` : ''}
                        </div>
                    </div>

                    ${applicant.coverLetter ? `
                    <div class="cover-letter" style="margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #1e293b;">Cover Letter</h5>
                        <div style="background: #f8fafc; padding: 10px; border-radius: 5px; border-left: 3px solid #2563eb;">
                            ${escapeHTML(applicant.coverLetter)}
                        </div>
                    </div>
                    ` : ''}

                    ${applicant.seekerSkills.length > 0 ? `
                    <div class="applicant-skills" style="margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #1e293b;">Skills</h5>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${applicant.seekerSkills.map(skill => 
                                `<span style="background: #2563eb; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.8rem;">${escapeHTML(skill)}</span>`
                            ).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <div class="applicant-actions" style="display: flex; gap: 10px;">
                        ${applicant.seekerResume ? `
                        <button class="btn-view-resume" data-resume-url="${escapeHTML(applicant.seekerResume)}" 
                                style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-file-pdf"></i> View Resume
                        </button>
                        ` : ''}

                        <button class="btn-contact-applicant" data-applicant-email="${escapeHTML(applicant.seekerEmail)}"
                                style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-envelope"></i> Contact
                        </button>
                    </div>
                </div>
            `;
        });

        setHTML(modal, `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>All Applicants (${escapeHTML(applicants.length)})</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    ${applicants.length > 0 ? applicantsHTML : `
                        <div style="text-align: center; padding: 40px; color: #64748b;">
                            <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 15px;"></i>
                            <h4>No Applicants Found</h4>
                            <p>No one has applied to your jobs yet.</p>
                        </div>
                    `}
                </div>
            </div>
        `);

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        modal.querySelectorAll('.btn-view-resume').forEach(btn => {
            btn.addEventListener('click', () => {
                this.viewResume(btn.dataset.resumeUrl);
            });
        });

        modal.querySelectorAll('.btn-contact-applicant').forEach(btn => {
            btn.addEventListener('click', () => {
                this.contactApplicant(btn.dataset.applicantEmail);
            });
        });
    }

    viewResume(resumeUrl) {
        const url = safeURL(resumeUrl);
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            this.showToast('Resume not available', 'error');
        }
    }

    contactApplicant(email) {
        try {
            openEmailDraft(email, { subject: 'Regarding your job application' });
            this.showToast('Email draft opened. Send it from your email app.', 'info');
        } catch (error) { this.showToast(error.message, 'error'); }
    }

    addClickFeedback(element) {
        element.classList.add('click-feedback');
        setTimeout(() => {
            element.classList.remove('click-feedback');
        }, 300);
    }

    showToast(message, type = 'info') {
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

    showError(message) {
        this.showToast(message, 'error');
    }

    showNoJobsState(jobsList) {
        setHTML(jobsList, `
            <div class="no-jobs-state">
                <i class="fas fa-briefcase"></i>
                <h3>No Job Postings Yet</h3>
                <p>Get started by creating your first job posting</p>
                <button class="btn btn-primary" id="createFirstJob">
                    <i class="fas fa-plus"></i>
                    Create Your First Job
                </button>
            </div>
        `);

        document.getElementById('createFirstJob').addEventListener('click', () => {
            this.handleCreateFirstJob();
        });
    }

    showJobsErrorState(jobsList, error) {
        console.error('Jobs loading error:', error);

        let errorMessage = 'Error loading jobs. Please try refreshing the page.';

        if (error.message.includes('index')) {
            errorMessage = `
                <h3>Setting Up Database</h3>
                <p>We're optimizing the database for better performance. This should be ready soon.</p>
                <p><small>Technical: ${escapeHTML(error.message)}</small></p>
                <button class="btn btn-secondary" data-action="reload">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            `;
        }

        setHTML(jobsList, `
            <div class="no-jobs-state">
                <i class="fas fa-exclamation-triangle"></i>
                ${escapeHTML(errorMessage)}
            </div>
        `);
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new EmployerDashboard();
});
