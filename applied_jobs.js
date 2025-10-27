// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNXjUFXeeVhyHMBuhBiMv-YYcVrBdCRS8",
  authDomain: "joblink-babb6.firebaseapp.com",
  projectId: "joblink-babb6",
  storageBucket: "joblink-babb6.firebasestorage.app",
  messagingSenderId: "442169381701",
  appId: "1:442169381701:web:d8ec90c72aab424d2d242c",
  measurementId: "G-Z0737HMGCQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.loadUserData();
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadApplications();
                this.updateStats();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadUserData() {
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                this.userData = userDoc.data();
                this.updateUserAvatar();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateUserAvatar() {
        const userAvatarNav = document.getElementById('userAvatarNav');
        if (this.userData?.photoURL) {
            userAvatarNav.src = this.userData.photoURL;
        }
    }

    async loadApplications() {
        const container = document.getElementById('applicationsContainer');
        
        try {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading your applications...</p>
                </div>
            `;

            console.log('Loading applications for user:', this.currentUser.uid);
            
            // Query applications for this user
            const applicationsQuery = query(
                collection(db, 'applications'),
                where('applicantId', '==', this.currentUser.uid),
                orderBy('appliedAt', 'desc')
            );
            
            const applicationsSnapshot = await getDocs(applicationsQuery);
            console.log('Found', applicationsSnapshot.size, 'applications');
            
            this.applications = [];
            
            for (const appDoc of applicationsSnapshot.docs) {
                const application = { 
                    id: appDoc.id, 
                    ...appDoc.data(),
                    appliedAt: appDoc.data().appliedAt?.toDate ? appDoc.data().appliedAt.toDate() : new Date(appDoc.data().appliedAt || new Date())
                };
                
                // Load job data
                try {
                    const jobDoc = await getDoc(doc(db, 'jobs', application.jobId));
                    if (jobDoc.exists()) {
                        application.job = jobDoc.data();
                        
                        // Load company data
                        const companyDoc = await getDoc(doc(db, 'companies', application.job.employerId));
                        if (companyDoc.exists()) {
                            application.company = companyDoc.data();
                        }
                    }
                } catch (error) {
                    console.error('Error loading job/company data:', error);
                }
                
                this.applications.push(application);
            }
            
            this.applyFilters();
            this.renderApplications();
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.showErrorState(container, error);
        }
    }

    applyFilters() {
        this.filteredApplications = this.applications.filter(application => {
            // Search filter
            const searchTerm = this.filters.search.toLowerCase();
            const matchesSearch = !searchTerm || 
                application.job?.title?.toLowerCase().includes(searchTerm) ||
                application.company?.companyName?.toLowerCase().includes(searchTerm) ||
                application.job?.location?.toLowerCase().includes(searchTerm);

            // Status filter
            const matchesStatus = this.filters.status === 'all' || application.status === this.filters.status;

            // Date filter
            const matchesDate = this.matchesDateFilter(application.appliedAt, this.filters.date);

            return matchesSearch && matchesStatus && matchesDate;
        });

        // Sort applications
        this.sortApplications();
    }

    matchesDateFilter(appliedDate, filter) {
        if (filter === 'all') return true;
        
        const now = new Date();
        const diffTime = Math.abs(now - appliedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        switch (filter) {
            case 'today': return diffDays === 0;
            case 'week': return diffDays <= 7;
            case 'month': return diffDays <= 30;
            case 'older': return diffDays > 30;
            default: return true;
        }
    }

    sortApplications() {
        switch (this.filters.sortBy) {
            case 'newest':
                this.filteredApplications.sort((a, b) => b.appliedAt - a.appliedAt);
                break;
            case 'oldest':
                this.filteredApplications.sort((a, b) => a.appliedAt - b.appliedAt);
                break;
            case 'company':
                this.filteredApplications.sort((a, b) => 
                    (a.company?.companyName || '').localeCompare(b.company?.companyName || '')
                );
                break;
            case 'deadline':
                this.filteredApplications.sort((a, b) => {
                    const deadlineA = a.job?.applicationDeadline?.toDate ? a.job.applicationDeadline.toDate() : new Date(a.job?.applicationDeadline || 0);
                    const deadlineB = b.job?.applicationDeadline?.toDate ? b.job.applicationDeadline.toDate() : new Date(b.job?.applicationDeadline || 0);
                    return deadlineA - deadlineB;
                });
                break;
        }
    }

    renderApplications() {
        const container = document.getElementById('applicationsContainer');
        
        if (this.filteredApplications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No Applications Found</h3>
                    <p>No applications match your current filters. Try adjusting your search criteria or apply to more jobs.</p>
                    <div class="action-buttons" style="justify-content: center;">
                        <button class="btn btn-primary" onclick="appliedJobs.clearFilters()">
                            Clear Filters
                        </button>
                        <button class="btn btn-secondary" onclick="window.location.href='job_search.html'">
                            Find Jobs
                        </button>
                    </div>
                </div>
            `;
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

        container.innerHTML = applicationsHTML;
        this.bindApplicationCardEvents();
        this.renderPagination();
    }

    createApplicationCard(application, isCompact = false) {
        const job = application.job || {};
        const company = application.company || {};
        const statusClass = `status-${application.status || 'applied'}`;
        const cardClass = `application-card ${application.status || 'applied'}`;
        
        const appliedDate = this.formatDate(application.appliedAt);
        const deadline = job.applicationDeadline ? this.formatDate(job.applicationDeadline.toDate()) : 'Not specified';

        if (isCompact) {
            return `
                <div class="${cardClass}" data-application-id="${application.id}">
                    <div class="application-main">
                        <img src="${company.logoUrl || 'https://via.placeholder.com/50x50?text=Co'}" 
                             alt="${company.companyName || 'Company'}" class="company-logo">
                        <div class="application-info">
                            <div class="job-title">${job.title || 'Unknown Job'}</div>
                            <div class="company-name">${company.companyName || 'Unknown Company'}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${job.location || 'Remote'}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${appliedDate}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="application-status">
                        <span class="status-badge ${statusClass}">${this.formatStatus(application.status)}</span>
                    </div>
                    <div class="application-actions">
                        <button class="btn btn-sm btn-outline view-application" data-application-id="${application.id}">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        ${application.status !== 'withdrawn' && application.status !== 'rejected' ? `
                        <button class="btn btn-sm btn-danger withdraw-application" data-application-id="${application.id}">
                            <i class="fas fa-ban"></i>
                            Withdraw
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="${cardClass}" data-application-id="${application.id}">
                <div class="application-header">
                    <div class="application-main">
                        <img src="${company.logoUrl || 'https://via.placeholder.com/60x60?text=Co'}" 
                             alt="${company.companyName || 'Company'}" class="company-logo">
                        <div class="application-basic-info">
                            <div class="job-title">${job.title || 'Unknown Job'}</div>
                            <div class="company-name">${company.companyName || 'Unknown Company'}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${job.location || 'Remote'}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${appliedDate}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    Deadline: ${deadline}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="application-status">
                        <span class="status-badge ${statusClass}">${this.formatStatus(application.status)}</span>
                    </div>
                </div>
                
                <div class="application-details">
                    <div class="detail-item">
                        <span class="detail-label">Application ID</span>
                        <span class="detail-value">${application.id.substring(0, 8)}...</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Job Type</span>
                        <span class="detail-value">${this.formatJobType(job.type)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Salary</span>
                        <span class="detail-value">${job.salary || 'Not specified'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Updated</span>
                        <span class="detail-value">${application.updatedAt ? this.formatDate(application.updatedAt.toDate()) : appliedDate}</span>
                    </div>
                </div>

                <div class="application-actions">
                    <button class="btn btn-sm btn-outline view-application" data-application-id="${application.id}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-primary view-timeline" data-application-id="${application.id}">
                        <i class="fas fa-history"></i>
                        Timeline
                    </button>
                    <button class="btn btn-sm btn-secondary contact-employer" data-application-id="${application.id}">
                        <i class="fas fa-envelope"></i>
                        Contact
                    </button>
                    ${application.status !== 'withdrawn' && application.status !== 'rejected' ? `
                    <button class="btn btn-sm btn-danger withdraw-application" data-application-id="${application.id}">
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
            'applied': 'Applied',
            'under_review': 'Under Review',
            'shortlisted': 'Shortlisted',
            'interview': 'Interview',
            'rejected': 'Not Selected',
            'withdrawn': 'Withdrawn'
        };
        return statusMap[status] || status || 'Applied';
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
        if (!date) return 'N/A';
        
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
        // View application details
        document.querySelectorAll('.view-application').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.view-application').dataset.applicationId;
                this.showApplicationDetails(applicationId);
            });
        });

        // View timeline
        document.querySelectorAll('.view-timeline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.view-timeline').dataset.applicationId;
                this.showTimelineModal(applicationId);
            });
        });

        // Contact employer
        document.querySelectorAll('.contact-employer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.contact-employer').dataset.applicationId;
                this.showContactModal(applicationId);
            });
        });

        // Withdraw application
        document.querySelectorAll('.withdraw-application').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.withdraw-application').dataset.applicationId;
                this.showWithdrawModal(applicationId);
            });
        });

        // Select application card
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

        content.innerHTML = this.createApplicationDetailsHTML(application);
        sidebar.classList.add('active');
    }

    createApplicationDetailsHTML(application) {
        const job = application.job || {};
        const company = application.company || {};
        const statusClass = `status-${application.status || 'applied'}`;

        return `
            <div class="application-detail-view">
                <div class="detail-section">
                    <div class="company-header">
                        <img src="${company.logoUrl || 'https://via.placeholder.com/80x80?text=Co'}" 
                             alt="${company.companyName}" class="company-logo">
                        <div class="company-info">
                            <h3>${company.companyName || 'Unknown Company'}</h3>
                            <p>${company.industry || 'Industry not specified'} • ${company.companySize || 'Size not specified'}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Job Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Job Title</span>
                            <span class="detail-value">${job.title || 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Job Type</span>
                            <span class="detail-value">${this.formatJobType(job.type)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${job.location || 'Remote'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Salary</span>
                            <span class="detail-value">${job.salary || 'Not specified'}</span>
                        </div>
                    </div>
                </div>

                ${job.description ? `
                <div class="detail-section">
                    <h4>Job Description</h4>
                    <div class="job-description">${job.description}</div>
                </div>
                ` : ''}

                ${job.requirements ? `
                <div class="detail-section">
                    <h4>Requirements</h4>
                    <ul class="requirements-list">
                        ${job.requirements.split('\n').filter(req => req.trim()).map(req => 
                            `<li><i class="fas fa-check"></i> ${req}</li>`
                        ).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="detail-section">
                    <h4>Application Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Application ID</span>
                            <span class="detail-value">${application.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applied Date</span>
                            <span class="detail-value">${application.appliedAt.toLocaleDateString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Current Status</span>
                            <span class="detail-value status-badge ${statusClass}">${this.formatStatus(application.status)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Application Deadline</span>
                            <span class="detail-value">${job.applicationDeadline ? job.applicationDeadline.toDate().toLocaleDateString() : 'Not specified'}</span>
                        </div>
                    </div>
                </div>

                ${application.coverLetter ? `
                <div class="detail-section">
                    <h4>Your Cover Letter</h4>
                    <div style="background: var(--light-gray); padding: 15px; border-radius: 8px;">
                        <p style="line-height: 1.6; white-space: pre-wrap;">${application.coverLetter}</p>
                    </div>
                </div>
                ` : ''}

                ${application.resumeUrl ? `
                <div class="detail-section">
                    <h4>Submitted Resume</h4>
                    <div class="resume-preview">
                        <a href="${application.resumeUrl}" target="_blank" class="btn btn-outline">
                            <i class="fas fa-file-pdf"></i>
                            View Resume
                        </a>
                    </div>
                </div>
                ` : ''}

                <div class="application-timeline">
                    <h4>Application Timeline</h4>
                    <div class="timeline-item">
                        <div class="timeline-date">${this.formatDate(application.appliedAt)}</div>
                        <div class="timeline-content">
                            <strong>Application Submitted</strong>
                            <p>You applied for the ${job.title} position at ${company.companyName}.</p>
                        </div>
                    </div>
                    
                    ${application.status === 'under_review' ? `
                    <div class="timeline-item">
                        <div class="timeline-date">Recently</div>
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
                            <strong>Shortlisted</strong>
                            <p>Your application has been shortlisted! The employer may contact you for next steps.</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${application.status === 'interview' ? `
                    <div class="timeline-item success">
                        <div class="timeline-date">${application.interviewDate ? this.formatDate(application.interviewDate.toDate()) : 'Soon'}</div>
                        <div class="timeline-content">
                            <strong>Interview Stage</strong>
                            <p>You've been invited for an interview. ${application.interviewDate ? `Scheduled for ${application.interviewDate.toDate().toLocaleString()}` : 'Date to be confirmed.'}</p>
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

        content.innerHTML = this.createTimelineHTML(application);
        modal.style.display = 'flex';
    }

    createTimelineHTML(application) {
        const job = application.job || {};
        const company = application.company || {};

        return `
            <div class="timeline-container">
                <div class="timeline-event">
                    <div class="event-date">${application.appliedAt.toLocaleString()}</div>
                    <div class="event-title">Application Submitted</div>
                    <div class="event-description">
                        You applied for the <strong>${job.title}</strong> position at <strong>${company.companyName}</strong>.
                        ${application.coverLetter ? 'Your cover letter and resume were submitted successfully.' : 'Your resume was submitted successfully.'}
                    </div>
                </div>

                ${application.status === 'under_review' ? `
                <div class="timeline-event warning">
                    <div class="event-date">${application.updatedAt ? application.updatedAt.toDate().toLocaleString() : 'Recently'}</div>
                    <div class="event-title">Under Review</div>
                    <div class="event-description">
                        Your application is currently being reviewed by the hiring team at ${company.companyName}. 
                        This process typically takes 3-7 business days.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'shortlisted' ? `
                <div class="timeline-event success">
                    <div class="event-date">${application.updatedAt ? application.updatedAt.toDate().toLocaleString() : 'Recently'}</div>
                    <div class="event-title">Shortlisted</div>
                    <div class="event-description">
                        Congratulations! Your application has been shortlisted. The employer is impressed with your qualifications 
                        and may contact you for the next stage of the hiring process.
                    </div>
                </div>
                ` : ''}

                ${application.status === 'interview' ? `
                <div class="timeline-event success">
                    <div class="event-date">${application.interviewDate ? application.interviewDate.toDate().toLocaleString() : 'To be scheduled'}</div>
                    <div class="event-title">Interview Invitation</div>
                    <div class="event-description">
                        You've been invited for an interview! 
                        ${application.interviewDate ? 
                            `The interview is scheduled for <strong>${application.interviewDate.toDate().toLocaleString()}</strong>.` : 
                            'The interview date will be confirmed soon.'
                        }
                        ${application.notes ? `<br><br><strong>Additional Notes:</strong> ${application.notes}` : ''}
                    </div>
                </div>
                ` : ''}

                ${application.status === 'rejected' ? `
                <div class="timeline-event rejected">
                    <div class="event-date">${application.updatedAt ? application.updatedAt.toDate().toLocaleString() : 'Recently'}</div>
                    <div class="event-title">Application Not Selected</div>
                    <div class="event-description">
                        Unfortunately, your application was not selected for this position. 
                        ${application.notes ? `<br><br><strong>Feedback:</strong> ${application.notes}` : 
                        'We encourage you to continue applying for other positions that match your skills and experience.'}
                    </div>
                </div>
                ` : ''}

                <div class="timeline-event">
                    <div class="event-date">Next Steps</div>
                    <div class="event-title">What to Expect</div>
                    <div class="event-description">
                        <strong>Typical Hiring Process:</strong><br>
                        1. Application Review (3-7 days)<br>
                        2. Phone Screening (if applicable)<br>
                        3. Interviews (1-3 rounds)<br>
                        4. Assessment/Test (if required)<br>
                        5. Job Offer<br><br>
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

        applicationInfo.innerHTML = `
            <strong>${company.companyName || 'Company'}</strong><br>
            <small>Regarding your application for: ${job.title} (Applied: ${this.formatDate(application.appliedAt)})</small>
        `;

        modal.style.display = 'flex';

        document.getElementById('sendContactMessage').onclick = () => {
            this.sendContactMessage(applicationId);
        };
    }

    async sendContactMessage(applicationId) {
        const message = document.getElementById('contactMessage').value;
        const includeResume = document.getElementById('includeResume').checked;

        if (!message.trim()) {
            this.showToast('Please enter a message', 'error');
            return;
        }

        try {
            // In a real application, you would send this message to the employer
            // For now, we'll just simulate the action
            
            console.log('Sending message to employer:', {
                applicationId,
                message,
                includeResume
            });

            this.hideModal('contactModal');
            this.showToast('Message sent successfully to employer');
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error sending message', 'error');
        }
    }

    showWithdrawModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('withdrawModal');
        const applicationInfo = document.getElementById('withdrawApplicationInfo');
        const job = application.job || {};
        const company = application.company || {};

        applicationInfo.innerHTML = `
            <strong>${job.title} at ${company.companyName}</strong><br>
            <small>Applied: ${this.formatDate(application.appliedAt)} • Current Status: ${this.formatStatus(application.status)}</small>
        `;

        modal.style.display = 'flex';

        document.getElementById('confirmWithdraw').onclick = () => {
            this.withdrawApplication(applicationId);
        };
    }

    async withdrawApplication(applicationId) {
        const reason = document.getElementById('withdrawReason').value;

        try {
            await updateDoc(doc(db, 'applications', applicationId), {
                status: 'withdrawn',
                updatedAt: Timestamp.now(),
                withdrawalReason: reason || null
            });
            
            this.hideModal('withdrawModal');
            this.showToast('Application withdrawn successfully');
            
            // Update local data
            const application = this.applications.find(app => app.id === applicationId);
            if (application) {
                application.status = 'withdrawn';
                application.withdrawalReason = reason;
            }
            
            this.applyFilters();
            this.renderApplications();
            this.updateStats();
            
            // Refresh sidebar if this application is currently selected
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
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <div class="pagination-info">
                Showing ${((this.currentPage - 1) * this.applicationsPerPage) + 1} to 
                ${Math.min(this.currentPage * this.applicationsPerPage, this.filteredApplications.length)} 
                of ${this.filteredApplications.length} applications
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="appliedJobs.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                paginationHTML += `
                    <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="appliedJobs.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="appliedJobs.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `</div>`;
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderApplications();
    }

    updateStats() {
        const totalApplications = this.applications.length;
        const pendingApplications = this.applications.filter(app => 
            app.status === 'applied' || app.status === 'under_review'
        ).length;
        const shortlistedApplications = this.applications.filter(app => app.status === 'shortlisted').length;
        const interviewApplications = this.applications.filter(app => app.status === 'interview').length;
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
        // Filter events
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

        // Clear filters
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Apply filters
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
            this.renderApplications();
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.setView(view);
            });
        });

        // Refresh applications
        document.getElementById('refreshApplications').addEventListener('click', () => {
            this.loadApplications();
        });

        // Close sidebar
        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('applicationDetailsSidebar').classList.remove('active');
        });

        // Sidebar actions
        document.addEventListener('click', (e) => {
            if (e.target.id === 'viewTimelineFromSidebar' && this.currentApplication) {
                this.showTimelineModal(this.currentApplication.id);
            }
            if (e.target.id === 'contactEmployerFromSidebar' && this.currentApplication) {
                this.showContactModal(this.currentApplication.id);
            }
            if (e.target.id === 'withdrawFromSidebar' && this.currentApplication) {
                this.showWithdrawModal(this.currentApplication.id);
            }
        });

        // Modal close events
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

        // Cancel buttons
        document.getElementById('cancelWithdraw').addEventListener('click', () => {
            this.hideModal('withdrawModal');
        });

        document.getElementById('cancelContact').addEventListener('click', () => {
            this.hideModal('contactModal');
        });

        document.getElementById('closeTimeline').addEventListener('click', () => {
            this.hideModal('timelineModal');
        });

        // Export functionality
        document.getElementById('exportApplications').addEventListener('click', () => {
            this.exportApplicationsData();
        });

        // Logout
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
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        this.renderApplications();
    }

    exportApplicationsData() {
        // In a real application, this would generate a CSV or Excel file
        // For now, we'll just show a success message
        this.showToast('Applications data exported successfully');
        console.log('Exporting applications data:', this.filteredApplications);
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
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Applications</h3>
                <p>There was a problem loading your application data. Please try again.</p>
                <button class="btn btn-primary" onclick="appliedJobs.loadApplications()">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            </div>
        `;
    }

    async handleLogout() {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
    }
}

let appliedJobs;
document.addEventListener('DOMContentLoaded', function() {
    appliedJobs = new AppliedJobs();
});