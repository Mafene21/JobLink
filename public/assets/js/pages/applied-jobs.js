import { openEmailDraft, escapeHTML, setHTML } from '../lib/ui.js';
import { downloadCSV } from '../lib/csv.js';

import { signOut } from '../lib/supabase-client.js';
import { getAccountUser, getRecord, listRecords, updateRecord } from '../lib/data-service.js';

class AppliedJobs {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.applications = [];
        this.filteredApplications = [];
        this.currentView = 'detailed';
        this.currentPage = 1;
        this.applicationsPerPage = 10;
        this.filters = {
            search: '',
            status: 'all',
            date: 'all',
            sortBy: 'newest'
        };
        this.currentApplication = null;
        this.init().catch(error => {
            console.error('Unable to load this page:', error);
            this.showToast(error.message || 'Unable to load your account. Please try again.', 'error');
        });
    }

    async init() {
        this.currentUser = await getAccountUser('seeker');
        if (!this.currentUser) return;
        this.bindEvents();
        await this.loadUserData();
        await this.loadAllApplications();
    }

    async loadUserData() {
        try {
            const userDoc = await getRecord('seekers', this.currentUser.id);
            if (userDoc) {
                this.userData = userDoc;

                this.updateUserAvatar();
            } else {

            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateUserAvatar() {
        const userAvatarNav = document.getElementById('userAvatarNav');
        if (this.userData?.profilePicture) {
            userAvatarNav.src = this.userData.profilePicture;

        } else {
            userAvatarNav.src = 'assets/images/avatar.svg';
        }
    }

    async loadAllApplications() {
        const container = document.getElementById('applicationsContainer');
        try {
            const records = await listRecords('applications', {
                filters: [['seekerId', '==', this.currentUser.id]], orderBy: ['appliedDate', 'desc']
            });
            this.applications = await Promise.all(records.map(record => this.createApplicationFromData(record.id, record)));
            this.applyFilters();
            this.updateStats();
            if (!this.applications.length) this.showNoApplicationsState();
            else this.renderApplications();
        } catch (error) {
            console.error('Unable to load applications:', error);
            this.showErrorState(container, error);
        }
    }

    async createApplicationFromData(appId, appData) {


        const application = {
            id: appId,
            ...appData,
            appliedAt: appData.appliedDate?.toDate ? appData.appliedDate.toDate() : 
                      appData.appliedAt?.toDate ? appData.appliedAt.toDate() : 
                      new Date(appData.appliedDate || appData.appliedAt || new Date()),
            status: appData.status || 'pending',
            coverLetter: appData.coverLetter || '',
            resumeUrl: appData.resumeUrl || null,
            resumeFileName: appData.resumeFileName || null
        };

        // If we have a jobId, load the job data
        if (application.jobId) {
            await this.enrichApplicationWithJobData(application);
        } else {
            // Create basic job info from application data
            application.job = {
                title: application.jobTitle || 'Unknown Position',
                company: application.companyName || 'Unknown Company',
                location: application.location || 'Not specified',
                type: application.jobType || 'Not specified',
                salary: application.salary || 'Not specified',
                description: application.jobDescription || '',
                requirements: []
            };

            application.company = {
                companyName: application.companyName || 'Unknown Company',
                logoUrl: application.companyLogo || null
            };
        }


        return application;
    }

    async enrichApplicationWithJobData(application) {
        try {
            const jobDoc = await getRecord('jobs', application.jobId);
            if (jobDoc) {
                const jobData = jobDoc;


                application.job = {
                    title: jobData.jobTitle || jobData.title || 'Unknown Position',
                    company: jobData.companyName || jobData.company || 'Unknown Company',
                    location: jobData.location || 'Not specified',
                    type: jobData.jobType || jobData.type || 'Not specified',
                    salary: jobData.salary || 'Not specified',
                    description: jobData.jobDescription || jobData.description || '',
                    requirements: jobData.requirements || []
                };

                application.company = {
                    companyName: jobData.companyName || jobData.company || 'Unknown Company',
                    logoUrl: this.findLogoUrl(jobData)
                };
            }
        } catch (error) {
            console.error('Error enriching application with job data:', error);
        }
    }

    findLogoUrl(data) {
        if (!data) return null;

        const possibleLogoFields = [
            'companyLogo', 'logoUrl', 'companyLogoUrl', 'logo', 
            'companyImage', 'imageUrl', 'companyLogoURL', 'company_logo',
            'logoURL', 'companyLogoImage', 'companyLogoUrl', 'image',
            'companyLogoImageUrl', 'brandLogo', 'companyBrandLogo'
        ];

        for (const field of possibleLogoFields) {
            if (data[field]) {

                return data[field];
            }
        }


        return null;
    }

    showNoApplicationsState() {
        const container = document.getElementById('applicationsContainer');
        setHTML(container, `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No Job Applications Found</h3>
                <p>You haven't applied to any jobs yet. Start your job search and apply to see your applications here!</p>
                <div class="action-buttons" style="justify-content: center;">
                    <button class="btn btn-primary" data-nav="browse_jobs.html">
                        <i class="fas fa-search"></i>
                        Browse Jobs
                    </button>
                    <button class="btn btn-secondary" data-controller="appliedJobs" data-method="loadAllApplications">
                        <i class="fas fa-refresh"></i>
                        Refresh
                    </button>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: var(--light-gray); border-radius: 8px;">
                    <h4>Debug Information</h4>
                    <p><strong>User ID:</strong> ${escapeHTML(this.currentUser?.id)}</p>
                    <p><strong>Applications Found:</strong> 0</p>
                    <p><strong>Note:</strong> If you have applied to jobs but don't see them here, 
                    please check that your applications are stored in the database.</p>
                </div>
            </div>
        `);
    }

    applyFilters() {
        this.filteredApplications = this.applications.filter(application => {
            const searchTerm = this.filters.search.toLowerCase();
            const matchesSearch = !searchTerm || 
                application.job?.title?.toLowerCase().includes(searchTerm) ||
                application.company?.companyName?.toLowerCase().includes(searchTerm) ||
                application.job?.location?.toLowerCase().includes(searchTerm);

            const matchesStatus = this.filters.status === 'all' || application.status === this.filters.status;

            const matchesDate = this.matchesDateFilter(application.appliedAt, this.filters.date);

            return matchesSearch && matchesStatus && matchesDate;
        });

        this.sortApplications();
    }

    matchesDateFilter(appliedDate, filter) {
        if (filter === 'all') return true;
        if (!appliedDate) return true;

        const now = new Date();
        switch (filter) {
            case 'today': 
                return appliedDate.toDateString() === now.toDateString();
            case 'week': 
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return appliedDate >= weekAgo;
            case 'month': 
                const monthAgo = new Date(now);
                monthAgo.setDate(monthAgo.getDate() - 30);
                return appliedDate >= monthAgo;
            case 'older': 
                const monthAgoOlder = new Date(now);
                monthAgoOlder.setDate(monthAgoOlder.getDate() - 30);
                return appliedDate < monthAgoOlder;
            default: return true;
        }
    }

    sortApplications() {
        switch (this.filters.sortBy) {
            case 'newest':
                this.filteredApplications.sort((a, b) => (b.appliedAt || new Date(0)) - (a.appliedAt || new Date(0)));
                break;
            case 'oldest':
                this.filteredApplications.sort((a, b) => (a.appliedAt || new Date(0)) - (b.appliedAt || new Date(0)));
                break;
            case 'company':
                this.filteredApplications.sort((a, b) => 
                    (a.company?.companyName || '').localeCompare(b.company?.companyName || '')
                );
                break;
            case 'deadline':
                this.filteredApplications.sort((a, b) => (b.appliedAt || new Date(0)) - (a.appliedAt || new Date(0)));
                break;
        }
    }

    renderApplications() {
        const container = document.getElementById('applicationsContainer');

        if (this.filteredApplications.length === 0) {
            setHTML(container, `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No Applications Match Your Filters</h3>
                    <p>Try adjusting your search criteria or clear the filters to see all applications.</p>
                    <div class="action-buttons" style="justify-content: center;">
                        <button class="btn btn-primary" data-controller="appliedJobs" data-method="clearFilters">
                            Clear Filters
                        </button>
                    </div>
                </div>
            `);
            return;
        }

        const startIndex = (this.currentPage - 1) * this.applicationsPerPage;
        const endIndex = startIndex + this.applicationsPerPage;
        const paginatedApplications = this.filteredApplications.slice(startIndex, endIndex);

        let applicationsHTML = '';

        if (this.currentView === 'detailed') {
            applicationsHTML = '<div class="applications-detailed">';
            paginatedApplications.forEach(application => {
                applicationsHTML += this.createApplicationCard(application);
            });
            applicationsHTML += '</div>';
        } else {
            applicationsHTML = '<div class="applications-compact">';
            paginatedApplications.forEach(application => {
                applicationsHTML += this.createApplicationCard(application, true);
            });
            applicationsHTML += '</div>';
        }

        setHTML(container, applicationsHTML);
        this.bindApplicationCardEvents();
        this.renderPagination();
    }

    createApplicationCard(application, isCompact = false) {
        const job = application.job || {};
        const company = application.company || {};
        const statusClass = `status-${application.status || 'pending'}`;
        const cardClass = `application-card ${application.status || 'pending'}`;

        const appliedDate = application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently';

        const companyName = company.companyName || job.company || 'Unknown Company';
        const logoUrl = company.logoUrl;
        const jobTitle = job.title || 'Unknown Position';
        const jobLocation = job.location || 'Remote';

        // Simple logo HTML - only use actual logo URLs
        const logoHTML = logoUrl ? 
            `<img src="${escapeHTML(logoUrl)}" 
                  alt="${escapeHTML(companyName)}" 
                  class="company-logo">` :
            `<div class="company-logo no-logo" title="${escapeHTML(companyName)}">
                <i class="fas fa-building"></i>
             </div>`;

        if (isCompact) {
            return `
                <div class="${escapeHTML(cardClass)}" data-application-id="${escapeHTML(application.id)}">
                    <div class="application-main">
                        ${logoHTML}
                        <div class="application-info">
                            <div class="job-title">${escapeHTML(jobTitle)}</div>
                            <div class="company-name">${escapeHTML(companyName)}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${escapeHTML(jobLocation)}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${escapeHTML(appliedDate)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="application-status">
                        <span class="status-badge ${escapeHTML(statusClass)}">${escapeHTML(this.formatStatus(application.status))}</span>
                    </div>
                    <div class="application-actions">
                        <button class="btn btn-sm btn-outline view-application" data-application-id="${escapeHTML(application.id)}">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        ${application.status !== 'withdrawn' && application.status !== 'rejected' ? `
                        <button class="btn btn-sm btn-danger withdraw-application" data-application-id="${escapeHTML(application.id)}">
                            <i class="fas fa-ban"></i>
                            Withdraw
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="${escapeHTML(cardClass)}" data-application-id="${escapeHTML(application.id)}">
                <div class="application-header">
                    <div class="application-main">
                        ${logoHTML}
                        <div class="application-basic-info">
                            <div class="job-title">${escapeHTML(jobTitle)}</div>
                            <div class="company-name">${escapeHTML(companyName)}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${escapeHTML(jobLocation)}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${escapeHTML(appliedDate)}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    Status: ${escapeHTML(this.formatStatus(application.status))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="application-status">
                        <span class="status-badge ${escapeHTML(statusClass)}">${escapeHTML(this.formatStatus(application.status))}</span>
                    </div>
                </div>

                <div class="application-details">
                    <div class="detail-item">
                        <span class="detail-label">Application ID</span>
                        <span class="detail-value">${escapeHTML(application.id.substring(0, 8))}...</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Job Type</span>
                        <span class="detail-value">${escapeHTML(this.formatJobType(job.type))}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Salary</span>
                        <span class="detail-value">${escapeHTML(job.salary || 'Not specified')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Applied Date</span>
                        <span class="detail-value">${escapeHTML(application.appliedAt ? application.appliedAt.toLocaleDateString() : 'Not specified')}</span>
                    </div>
                </div>

                <div class="application-actions">
                    <button class="btn btn-sm btn-outline view-application" data-application-id="${escapeHTML(application.id)}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-primary view-timeline" data-application-id="${escapeHTML(application.id)}">
                        <i class="fas fa-history"></i>
                        Timeline
                    </button>
                    <button class="btn btn-sm btn-secondary contact-employer" data-application-id="${escapeHTML(application.id)}">
                        <i class="fas fa-envelope"></i>
                        Contact
                    </button>
                    ${application.status !== 'withdrawn' && application.status !== 'rejected' ? `
                    <button class="btn btn-sm btn-danger withdraw-application" data-application-id="${escapeHTML(application.id)}">
                        <i class="fas fa-ban"></i>
                        Withdraw
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    formatStatus(status) {
        const statusMap = {
            'pending': 'Under Review',
            'reviewed': 'Under Review',
            'shortlisted': 'Shortlisted',
            'interview': 'Interview Stage',
            'accepted': 'Accepted',
            'rejected': 'Not Selected',
            'withdrawn': 'Withdrawn'
        };
        return statusMap[status] || status || 'Under Review';
    }

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'internship': 'Internship',
            'remote': 'Remote'
        };
        return types[jobType] || jobType || 'Not specified';
    }

    formatDate(date) {
        if (!date) return 'Recently';

        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }

    bindApplicationCardEvents() {
        document.querySelectorAll('.view-application').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.view-application').dataset.applicationId;
                this.showApplicationDetails(applicationId);
            });
        });

        document.querySelectorAll('.view-timeline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.view-timeline').dataset.applicationId;
                this.showTimelineModal(applicationId);
            });
        });

        document.querySelectorAll('.contact-employer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.contact-employer').dataset.applicationId;
                this.showContactModal(applicationId);
            });
        });

        document.querySelectorAll('.withdraw-application').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.withdraw-application').dataset.applicationId;
                this.showWithdrawModal(applicationId);
            });
        });

        document.querySelectorAll('.application-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const applicationId = card.dataset.applicationId;
                    this.showApplicationDetails(applicationId);
                }
            });
        });
    }

    showApplicationDetails(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        this.currentApplication = application;
        const sidebar = document.getElementById('applicationDetailsSidebar');
        const content = document.getElementById('sidebarContent');

        setHTML(content, this.createApplicationDetailsHTML(application));
        sidebar.classList.add('active');

        setTimeout(() => {
            document.getElementById('viewTimelineFromSidebar')?.addEventListener('click', () => {
                this.showTimelineModal(applicationId);
            });
            document.getElementById('contactEmployerFromSidebar')?.addEventListener('click', () => {
                this.showContactModal(applicationId);
            });
            document.getElementById('withdrawFromSidebar')?.addEventListener('click', () => {
                this.showWithdrawModal(applicationId);
            });
        }, 100);
    }

    createApplicationDetailsHTML(application) {
        const job = application.job || {};
        const company = application.company || {};
        const statusClass = `status-${application.status || 'pending'}`;

        const companyName = company.companyName || job.company || 'Unknown Company';
        const logoUrl = company.logoUrl;
        const jobTitle = job.title || 'Unknown Position';
        const jobLocation = job.location || 'Location not specified';

        const logoHTML = logoUrl ? 
            `<img src="${escapeHTML(logoUrl)}" 
                  alt="${escapeHTML(companyName)}" 
                  class="company-logo">` :
            `<div class="company-logo no-logo" title="${escapeHTML(companyName)}">
                <i class="fas fa-building"></i>
             </div>`;

        return `
            <div class="application-detail-view">
                <div class="detail-section">
                    <div class="company-header">
                        ${logoHTML}
                        <div class="company-info">
                            <h3>${escapeHTML(companyName)}</h3>
                            <p>${escapeHTML(jobLocation)}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Job Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Job Title</span>
                            <span class="detail-value">${escapeHTML(jobTitle)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Job Type</span>
                            <span class="detail-value">${escapeHTML(this.formatJobType(job.type))}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${escapeHTML(jobLocation)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Salary</span>
                            <span class="detail-value">${escapeHTML(job.salary || 'Not specified')}</span>
                        </div>
                    </div>
                </div>

                ${job.description ? `
                <div class="detail-section">
                    <h4>Job Description</h4>
                    <div class="job-description">${escapeHTML(job.description)}</div>
                </div>
                ` : ''}

                <div class="detail-section">
                    <h4>Application Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Application ID</span>
                            <span class="detail-value">${escapeHTML(application.id)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applied Date</span>
                            <span class="detail-value">${escapeHTML(application.appliedAt ? application.appliedAt.toLocaleDateString() : 'Not specified')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Current Status</span>
                            <span class="detail-value status-badge ${escapeHTML(statusClass)}">${escapeHTML(this.formatStatus(application.status))}</span>
                        </div>
                    </div>
                </div>

                ${application.coverLetter ? `
                <div class="detail-section">
                    <h4>Your Cover Letter</h4>
                    <div style="background: var(--light-gray); padding: 15px; border-radius: 8px;">
                        <p style="line-height: 1.6; white-space: pre-wrap;">${escapeHTML(application.coverLetter)}</p>
                    </div>
                </div>
                ` : ''}

                ${application.resumeUrl ? `
                <div class="detail-section">
                    <h4>Submitted Resume</h4>
                    <div class="resume-preview">
                        <a href="${escapeHTML(application.resumeUrl)}" target="_blank" class="btn btn-outline">
                            <i class="fas fa-file-pdf"></i>
                            View Resume
                        </a>
                    </div>
                </div>
                ` : ''}

                <div class="application-timeline">
                    <h4>Application Timeline</h4>
                    <div class="timeline-item">
                        <div class="timeline-date">${escapeHTML(application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently')}</div>
                        <div class="timeline-content">
                            <strong>Application Submitted</strong>
                            <p>You applied for the ${escapeHTML(jobTitle)} position at ${escapeHTML(companyName)}.</p>
                        </div>
                    </div>

                    ${application.status === 'reviewed' || application.status === 'pending' ? `
                    <div class="timeline-item">
                        <div class="timeline-date">Currently</div>
                        <div class="timeline-content">
                            <strong>Under Review</strong>
                            <p>Your application is being reviewed by the hiring team.</p>
                        </div>
                    </div>
                    ` : ''}

                    ${application.status === 'shortlisted' ? `
                    <div class="timeline-item success">
                        <div class="timeline-date">Recently</div>
                        <div class="timeline-content">
                            <strong>Application Shortlisted</strong>
                            <p>Great news! Your application has been shortlisted by the employer.</p>
                        </div>
                    </div>
                    ` : ''}

                    ${application.status === 'interview' ? `
                    <div class="timeline-item success">
                        <div class="timeline-date">Recently</div>
                        <div class="timeline-content">
                            <strong>Interview Stage</strong>
                            <p>Your application has progressed to the interview stage.</p>
                        </div>
                    </div>
                    ` : ''}

                    ${application.status === 'accepted' ? `
                    <div class="timeline-item success">
                        <div class="timeline-date">Recently</div>
                        <div class="timeline-content">
                            <strong>Application Accepted</strong>
                            <p>Congratulations! Your application has been accepted.</p>
                        </div>
                    </div>
                    ` : ''}

                    ${application.status === 'rejected' ? `
                    <div class="timeline-item rejected">
                        <div class="timeline-date">Recently</div>
                        <div class="timeline-content">
                            <strong>Application Not Selected</strong>
                            <p>Unfortunately, your application was not selected for this position.</p>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary" id="viewTimelineFromSidebar">
                        <i class="fas fa-history"></i>
                        Full Timeline
                    </button>
                    <button class="btn btn-secondary" id="contactEmployerFromSidebar">
                        <i class="fas fa-envelope"></i>
                        Contact Employer
                    </button>
                    ${application.status !== 'withdrawn' && application.status !== 'rejected' ? `
                    <button class="btn btn-danger" id="withdrawFromSidebar">
                        <i class="fas fa-ban"></i>
                        Withdraw Application
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    showTimelineModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('timelineModal');
        const content = document.getElementById('timelineContent');

        setHTML(content, this.createTimelineHTML(application));
        modal.style.display = 'flex';
    }

    createTimelineHTML(application) {
        const job = application.job || {};
        const company = application.company || {};
        const companyName = company.companyName || job.company || 'Unknown Company';

        return `
            <div class="timeline-container">
                <div class="timeline-event">
                    <div class="event-date">${escapeHTML(application.appliedAt ? application.appliedAt.toLocaleString() : 'Recently')}</div>
                    <div class="event-title">Application Submitted</div>
                    <div class="event-description">
                        You applied for the <strong>${escapeHTML(job.title)}</strong> position at <strong>${escapeHTML(companyName)}</strong>.
                        ${escapeHTML(application.coverLetter ? 'Your cover letter and resume were submitted successfully.' : 'Your application was submitted successfully.')}
                    </div>
                </div>

                ${application.status === 'pending' || application.status === 'reviewed' ? `
                <div class="timeline-event warning">
                    <div class="event-date">Currently</div>
                    <div class="event-title">Under Review</div>
                    <div class="event-description">
                        Your application is currently being reviewed by the hiring team at ${escapeHTML(companyName)}. 
                        This process typically takes 3-7 business days.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'shortlisted' ? `
                <div class="timeline-event success">
                    <div class="event-date">Recently</div>
                    <div class="event-title">Application Shortlisted</div>
                    <div class="event-description">
                        Great news! Your application has been shortlisted. The employer is interested in your profile and may contact you for next steps.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'interview' ? `
                <div class="timeline-event success">
                    <div class="event-date">Recently</div>
                    <div class="event-title">Interview Stage</div>
                    <div class="event-description">
                        Your application has progressed to the interview stage. The employer will contact you to schedule an interview.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'accepted' ? `
                <div class="timeline-event success">
                    <div class="event-date">Recently</div>
                    <div class="event-title">Application Accepted</div>
                    <div class="event-description">
                        Congratulations! Your application has been accepted. The employer may contact you for next steps.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'rejected' ? `
                <div class="timeline-event rejected">
                    <div class="event-date">Recently</div>
                    <div class="event-title">Application Not Selected</div>
                    <div class="event-description">
                        Unfortunately, your application was not selected for this position. 
                        We encourage you to continue applying for other positions that match your skills and experience.
                    </div>
                </div>
                ` : ''}

                <div class="timeline-event">
                    <div class="event-date">Next Steps</div>
                    <div class="event-title">What to Expect</div>
                    <div class="event-description">
                        <strong>Typical Hiring Process:</strong><br>
                        1. Application Review (3-7 days)<br>
                        2. Shortlisting<br>
                        3. Phone Screening (if applicable)<br>
                        4. Interviews (1-3 rounds)<br>
                        5. Assessment/Test (if required)<br>
                        6. Job Offer<br><br>
                        If you don't hear back within 2 weeks, consider following up with the employer.
                    </div>
                </div>
            </div>
        `;
    }

    showContactModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('contactModal');
        const applicationInfo = document.getElementById('contactApplicationInfo');
        const job = application.job || {};
        const company = application.company || {};
        const companyName = company.companyName || job.company || 'Company';

        setHTML(applicationInfo, `
            <strong>${escapeHTML(companyName)}</strong><br>
            <small>Regarding your application for: ${escapeHTML(job.title)} (Applied: ${escapeHTML(application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently')})</small>
        `);

        modal.style.display = 'flex';

        document.getElementById('sendContactMessage').onclick = () => {
            this.sendContactMessage(applicationId);
        };
    }

    async sendContactMessage(applicationId) {
        const application = this.applications.find(item => item.id === applicationId);
        const message = document.getElementById('contactMessage').value.trim();
        if (!message) { this.showToast('Please enter a message.', 'error'); return; }
        try {
            const company = application?.employerId ? await getRecord('companies', application.employerId) : null;
            if (!company?.email || company.hideContact) throw new Error('This employer has not published a contact email.');
            openEmailDraft(company.email, { subject: 'Application for ' + (application.job?.title || application.jobTitle || 'your job'), body: message });
            this.hideModal('contactModal');
            this.showToast('Email draft opened. Attach any files and send it from your email app.', 'info');
        } catch (error) { this.showToast(error.message, 'error'); }
    }

    showWithdrawModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('withdrawModal');
        const applicationInfo = document.getElementById('withdrawApplicationInfo');
        const job = application.job || {};
        const company = application.company || {};
        const companyName = company.companyName || job.company || 'Company';

        setHTML(applicationInfo, `
            <strong>${escapeHTML(job.title)} at ${escapeHTML(companyName)}</strong><br>
            <small>Applied: ${escapeHTML(application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently')} • Current Status: ${escapeHTML(this.formatStatus(application.status))}</small>
        `);

        modal.style.display = 'flex';

        document.getElementById('confirmWithdraw').onclick = () => {
            this.withdrawApplication(applicationId);
        };
    }

    async withdrawApplication(applicationId) {
        const reason = document.getElementById('withdrawReason').value;

        try {
            await updateRecord('applications', applicationId, {
                status: 'withdrawn',
                updatedAt: new Date(),
                withdrawalReason: reason || null
            });

            this.hideModal('withdrawModal');
            this.showToast('Application withdrawn successfully');

            const application = this.applications.find(app => app.id === applicationId);
            if (application) {
                application.status = 'withdrawn';
                application.withdrawalReason = reason;
            }

            this.applyFilters();
            this.renderApplications();
            this.updateStats();

            if (this.currentApplication && this.currentApplication.id === applicationId) {
                this.showApplicationDetails(applicationId);
            }

        } catch (error) {
            console.error('Error withdrawing application:', error);
            this.showToast('Error withdrawing application', 'error');
        }
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredApplications.length / this.applicationsPerPage);

        if (totalPages <= 1) {
            setHTML(pagination, '');
            return;
        }

        let paginationHTML = `
            <div class="pagination-info">
                Showing ${escapeHTML(((this.currentPage - 1) * this.applicationsPerPage) + 1)} to 
                ${escapeHTML(Math.min(this.currentPage * this.applicationsPerPage, this.filteredApplications.length))} 
                of ${escapeHTML(this.filteredApplications.length)} applications
            </div>
            <div class="pagination-controls">
        `;

        paginationHTML += `
            <button class="pagination-btn" ${escapeHTML(this.currentPage === 1 ? 'disabled' : '')} 
                    data-controller="appliedJobs" data-method="goToPage" data-argument="${escapeHTML(this.currentPage - 1)}">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                paginationHTML += `
                    <button class="pagination-btn ${escapeHTML(i === this.currentPage ? 'active' : '')}" 
                            data-controller="appliedJobs" data-method="goToPage" data-argument="${escapeHTML(i)}">
                        ${escapeHTML(i)}
                    </button>
                `;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }

        paginationHTML += `
            <button class="pagination-btn" ${escapeHTML(this.currentPage === totalPages ? 'disabled' : '')} 
                    data-controller="appliedJobs" data-method="goToPage" data-argument="${escapeHTML(this.currentPage + 1)}">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `</div>`;
        setHTML(pagination, paginationHTML);
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderApplications();
    }

    updateStats() {
        const totalApplications = this.applications.length;
        const pendingApplications = this.applications.filter(app => 
            app.status === 'pending' || app.status === 'reviewed'
        ).length;
        const shortlistedApplications = this.applications.filter(app => 
            app.status === 'shortlisted'
        ).length;
        const interviewApplications = this.applications.filter(app => 
            app.status === 'interview'
        ).length;
        const rejectedApplications = this.applications.filter(app => 
            app.status === 'rejected' || app.status === 'withdrawn'
        ).length;

        document.getElementById('totalApplicationsCount').textContent = totalApplications;
        document.getElementById('pendingApplicationsCount').textContent = pendingApplications;
        document.getElementById('shortlistedApplicationsCount').textContent = shortlistedApplications;
        document.getElementById('interviewApplicationsCount').textContent = interviewApplications;
        document.getElementById('rejectedApplicationsCount').textContent = rejectedApplications;


    }

    bindEvents() {
        document.getElementById('applicationSearch').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplications();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplications();
        });

        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.filters.date = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplications();
        });

        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.filters.sortBy = e.target.value;
            this.applyFilters();
            this.renderApplications();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.setView(view);
            });
        });

        document.getElementById('refreshApplications').addEventListener('click', () => {
            this.loadAllApplications();
        });

        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('applicationDetailsSidebar').classList.remove('active');
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                modal.style.display = 'none';
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        document.getElementById('cancelWithdraw').addEventListener('click', () => {
            this.hideModal('withdrawModal');
        });

        document.getElementById('cancelContact').addEventListener('click', () => {
            this.hideModal('contactModal');
        });

        document.getElementById('closeTimeline').addEventListener('click', () => {
            this.hideModal('timelineModal');
        });

        document.getElementById('exportApplications').addEventListener('click', () => {
            this.exportApplicationsData();
        });

        document.querySelector('.logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
    }

    clearFilters() {
        document.getElementById('applicationSearch').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('dateFilter').value = 'all';
        document.getElementById('sortBy').value = 'newest';

        this.filters = {
            search: '',
            status: 'all',
            date: 'all',
            sortBy: 'newest'
        };

        this.currentPage = 1;
        this.applyFilters();
        this.renderApplications();
    }

    setView(view) {
        this.currentView = view;
        this.currentPage = 1;

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        this.renderApplications();
    }

    exportApplicationsData() {
        downloadCSV('joblink-applications.csv', ['Job', 'Company', 'Status', 'Applied'],
            this.filteredApplications.map(item => [item.job?.title || item.jobTitle,
                item.company?.companyName || item.companyName, item.status, item.appliedDate]));
        this.showToast('Application CSV downloaded.');
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('successToast');
        const messageElement = document.getElementById('toastMessage');

        messageElement.textContent = message;

        if (type === 'error') {
            toast.style.borderLeftColor = 'var(--accent)';
            toast.querySelector('i').className = 'fas fa-exclamation-circle';
            toast.querySelector('i').style.color = 'var(--accent)';
        } else {
            toast.style.borderLeftColor = 'var(--success)';
            toast.querySelector('i').className = 'fas fa-check-circle';
            toast.querySelector('i').style.color = 'var(--success)';
        }

        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                toast.style.display = 'none';
                toast.style.animation = '';
            }, 300);
        }, 3000);
    }

    showErrorState(container, error) {
        setHTML(container, `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Applications</h3>
                <p>There was a problem loading your application data. Please try again.</p>
                <button class="btn btn-primary" data-controller="appliedJobs" data-method="loadAllApplications">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            </div>
        `);
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
}

let appliedJobs;
document.addEventListener('DOMContentLoaded', function() {
    window.appliedJobs = appliedJobs = new AppliedJobs();
});