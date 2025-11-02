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
        this.initMobileMenu();
    }

    initMobileMenu() {
        const hamburger = document.getElementById('hamburgerMenu');
        const navLinks = document.getElementById('navLinks');

        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                hamburger.classList.toggle('active');
            });

            // Close menu when clicking on a link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                }
            });
        }
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadUserData();
                await this.loadAllApplications();
                this.updateStats();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadUserData() {
        try {
            const userDoc = await getDoc(doc(db, 'seekers', this.currentUser.uid));
            if (userDoc.exists()) {
                this.userData = userDoc.data();
                console.log('User data loaded:', this.userData);
                this.updateUserAvatar();
            } else {
                console.log('No user data found for seeker:', this.currentUser.uid);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateUserAvatar() {
        const userAvatarNav = document.getElementById('userAvatarNav');
        if (this.userData?.profilePicture) {
            userAvatarNav.src = this.userData.profilePicture;
            console.log('Profile picture updated');
        } else {
            userAvatarNav.src = 'https://via.placeholder.com/32x32?text=U';
        }
    }

    async loadAllApplications() {
        const container = document.getElementById('applicationsContainer');
        
        try {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading your applications...</p>
                </div>
            `;

            console.log('=== LOADING APPLICATIONS FOR USER:', this.currentUser.uid, '===');
            
            this.applications = [];
            
            // Try multiple methods to find applications
            await this.tryApplicationsCollection();
            
            if (this.applications.length === 0) {
                await this.tryJobsCollection();
            }
            
            if (this.applications.length === 0) {
                await this.tryAllCollections();
            }
            
            console.log('Final applications found:', this.applications.length);
            console.log('Applications data:', this.applications);
            
            if (this.applications.length === 0) {
                this.showNoApplicationsState();
                return;
            }
            
            this.applyFilters();
            this.renderApplications();
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.showErrorState(container, error);
        }
    }

    async tryApplicationsCollection() {
        console.log('=== METHOD 1: Checking applications collection ===');
        try {
            const applicationsQuery = query(
                collection(db, 'applications'),
                where('seekerId', '==', this.currentUser.uid)
            );
            const snapshot = await getDocs(applicationsQuery);
            console.log('Found', snapshot.size, 'documents in applications collection');
            
            for (const doc of snapshot.docs) {
                const appData = doc.data();
                console.log('Application document:', appData);
                
                const application = await this.createApplicationFromData(doc.id, appData);
                if (application) {
                    this.applications.push(application);
                }
            }
        } catch (error) {
            console.error('Error querying applications collection:', error);
        }
    }

    async tryJobsCollection() {
        console.log('=== METHOD 2: Checking jobs collection for applicants ===');
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('applicants', 'array-contains', this.currentUser.uid)
            );
            const snapshot = await getDocs(jobsQuery);
            console.log('Found', snapshot.size, 'jobs where user is an applicant');
            
            for (const doc of snapshot.docs) {
                const jobData = doc.data();
                console.log('Job with applicant:', jobData);
                
                const application = await this.createApplicationFromJob(doc.id, jobData);
                if (application) {
                    this.applications.push(application);
                }
            }
        } catch (error) {
            console.error('Error querying jobs collection:', error);
        }
    }

    async tryAllCollections() {
        console.log('=== METHOD 3: Checking all documents across collections ===');
        
        // Check applications collection (all documents)
        try {
            const applicationsSnapshot = await getDocs(collection(db, 'applications'));
            console.log('Total applications in database:', applicationsSnapshot.size);
            
            for (const doc of applicationsSnapshot.docs) {
                const appData = doc.data();
                // Check if this application belongs to current user by any field
                if (appData.seekerId === this.currentUser.uid || 
                    appData.userId === this.currentUser.uid ||
                    appData.applicantId === this.currentUser.uid) {
                    
                    console.log('Found application for user:', appData);
                    const application = await this.createApplicationFromData(doc.id, appData);
                    if (application) {
                        this.applications.push(application);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning applications:', error);
        }
        
        // Check jobs collection (all documents)
        try {
            const jobsSnapshot = await getDocs(collection(db, 'jobs'));
            console.log('Total jobs in database:', jobsSnapshot.size);
            
            for (const doc of jobsSnapshot.docs) {
                const jobData = doc.data();
                // Check if user is in applicants array or similar field
                if (jobData.applicants && Array.isArray(jobData.applicants) && 
                    jobData.applicants.includes(this.currentUser.uid)) {
                    
                    console.log('Found job application for user:', jobData);
                    const application = await this.createApplicationFromJob(doc.id, jobData);
                    if (application) {
                        this.applications.push(application);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning jobs:', error);
        }
    }

    async createApplicationFromData(appId, appData) {
        console.log('Creating application from data:', appData);
        
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

        console.log('Final application:', application);
        return application;
    }

    async createApplicationFromJob(jobId, jobData) {
        console.log('Creating application from job:', jobData);
        
        const application = {
            id: jobId,
            jobId: jobId,
            job: {
                title: jobData.jobTitle || jobData.title || 'Unknown Position',
                company: jobData.companyName || jobData.company || 'Unknown Company',
                location: jobData.location || 'Not specified',
                type: jobData.jobType || jobData.type || 'Not specified',
                salary: jobData.salary || 'Not specified',
                description: jobData.jobDescription || jobData.description || '',
                requirements: jobData.requirements || []
            },
            company: {
                companyName: jobData.companyName || jobData.company || 'Unknown Company',
                logoUrl: this.findLogoUrl(jobData)
            },
            status: 'pending',
            appliedAt: new Date(),
            coverLetter: '',
            resumeUrl: null,
            resumeFileName: null
        };

        console.log('Final application from job:', application);
        return application;
    }

    async enrichApplicationWithJobData(application) {
        try {
            const jobDoc = await getDoc(doc(db, 'jobs', application.jobId));
            if (jobDoc.exists()) {
                const jobData = jobDoc.data();
                console.log('Enriched with job data:', jobData);
                
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
                console.log(`🎯 Found logo in field "${field}":`, data[field]);
                return data[field];
            }
        }
        
        console.log('❌ No logo found in data');
        return null;
    }

    showNoApplicationsState() {
        const container = document.getElementById('applicationsContainer');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No Job Applications Found</h3>
                <p>You haven't applied to any jobs yet. Start your job search and apply to see your applications here!</p>
                <div class="action-buttons" style="justify-content: center;">
                    <button class="btn btn-primary" onclick="window.location.href='browse_jobs.html'">
                        <i class="fas fa-search"></i>
                        Browse Jobs
                    </button>
                    <button class="btn btn-secondary" onclick="appliedJobs.loadAllApplications()">
                        <i class="fas fa-refresh"></i>
                        Refresh
                    </button>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: var(--light-gray); border-radius: 8px;">
                    <h4>Debug Information</h4>
                    <p><strong>User ID:</strong> ${this.currentUser?.uid}</p>
                    <p><strong>Applications Found:</strong> 0</p>
                    <p><strong>Note:</strong> If you have applied to jobs but don't see them here, 
                    please check that your applications are stored in the database.</p>
                </div>
            </div>
        `;
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
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No Applications Match Your Filters</h3>
                    <p>Try adjusting your search criteria or clear the filters to see all applications.</p>
                    <div class="action-buttons" style="justify-content: center;">
                        <button class="btn btn-primary" onclick="appliedJobs.clearFilters()">
                            Clear Filters
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
        const statusClass = `status-${application.status || 'pending'}`;
        const cardClass = `application-card ${application.status || 'pending'}`;
        
        const appliedDate = application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently';

        const companyName = company.companyName || job.company || 'Unknown Company';
        const logoUrl = company.logoUrl;
        const jobTitle = job.title || 'Unknown Position';
        const jobLocation = job.location || 'Remote';

        console.log(`Rendering card for ${companyName} - Logo URL:`, logoUrl);

        // Simple logo HTML - only use actual logo URLs
        const logoHTML = logoUrl ? 
            `<img src="${logoUrl}" 
                  alt="${companyName}" 
                  class="company-logo"
                  onerror="console.log('Logo failed to load for ${companyName}:', this.src); this.style.display='none'">` :
            `<div class="company-logo no-logo" title="${companyName}">
                <i class="fas fa-building"></i>
             </div>`;

        if (isCompact) {
            return `
                <div class="${cardClass}" data-application-id="${application.id}">
                    <div class="application-main">
                        ${logoHTML}
                        <div class="application-info">
                            <div class="job-title">${jobTitle}</div>
                            <div class="company-name">${companyName}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${jobLocation}
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
                        ${logoHTML}
                        <div class="application-basic-info">
                            <div class="job-title">${jobTitle}</div>
                            <div class="company-name">${companyName}</div>
                            <div class="application-meta">
                                <div class="application-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${jobLocation}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${appliedDate}
                                </div>
                                <div class="application-meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    Status: ${this.formatStatus(application.status)}
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
                        <span class="detail-label">Applied Date</span>
                        <span class="detail-value">${application.appliedAt ? application.appliedAt.toLocaleDateString() : 'Not specified'}</span>
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
            'pending': 'Applied',
            'reviewed': 'Under Review',
            'shortlisted': 'Shortlisted',
            'interview': 'Interview Stage',
            'accepted': 'Accepted',
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

        content.innerHTML = this.createApplicationDetailsHTML(application);
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
            `<img src="${logoUrl}" 
                  alt="${companyName}" 
                  class="company-logo"
                  onerror="console.log('Logo failed to load in sidebar for ${companyName}:', this.src); this.style.display='none'">` :
            `<div class="company-logo no-logo" title="${companyName}">
                <i class="fas fa-building"></i>
             </div>`;

        return `
            <div class="application-detail-view">
                <div class="detail-section">
                    <div class="company-header">
                        ${logoHTML}
                        <div class="company-info">
                            <h3>${companyName}</h3>
                            <p>${jobLocation}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Job Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Job Title</span>
                            <span class="detail-value">${jobTitle}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Job Type</span>
                            <span class="detail-value">${this.formatJobType(job.type)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${jobLocation}</span>
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

                <div class="detail-section">
                    <h4>Application Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Application ID</span>
                            <span class="detail-value">${application.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applied Date</span>
                            <span class="detail-value">${application.appliedAt ? application.appliedAt.toLocaleDateString() : 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Current Status</span>
                            <span class="detail-value status-badge ${statusClass}">${this.formatStatus(application.status)}</span>
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
                        <div class="timeline-date">${application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently'}</div>
                        <div class="timeline-content">
                            <strong>Application Submitted</strong>
                            <p>You applied for the ${jobTitle} position at ${companyName}.</p>
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

        content.innerHTML = this.createTimelineHTML(application);
        modal.style.display = 'flex';
    }

    createTimelineHTML(application) {
        const job = application.job || {};
        const company = application.company || {};
        const companyName = company.companyName || job.company || 'Unknown Company';

        return `
            <div class="timeline-container">
                <div class="timeline-event">
                    <div class="event-date">${application.appliedAt ? application.appliedAt.toLocaleString() : 'Recently'}</div>
                    <div class="event-title">Application Submitted</div>
                    <div class="event-description">
                        You applied for the <strong>${job.title}</strong> position at <strong>${companyName}</strong>.
                        ${application.coverLetter ? 'Your cover letter and resume were submitted successfully.' : 'Your application was submitted successfully.'}
                    </div>
                </div>

                ${application.status === 'pending' || application.status === 'reviewed' ? `
                <div class="timeline-event warning">
                    <div class="event-date">Currently</div>
                    <div class="event-title">Under Review</div>
                    <div class="event-description">
                        Your application is currently being reviewed by the hiring team at ${companyName}. 
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

        applicationInfo.innerHTML = `
            <strong>${companyName}</strong><br>
            <small>Regarding your application for: ${job.title} (Applied: ${application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently'})</small>
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
        const companyName = company.companyName || job.company || 'Company';

        applicationInfo.innerHTML = `
            <strong>${job.title} at ${companyName}</strong><br>
            <small>Applied: ${application.appliedAt ? this.formatDate(application.appliedAt) : 'Recently'} • Current Status: ${this.formatStatus(application.status)}</small>
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

        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="appliedJobs.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

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

        console.log('Stats updated:', {
            total: totalApplications,
            pending: pendingApplications,
            shortlisted: shortlistedApplications,
            interview: interviewApplications,
            rejected: rejectedApplications
        });
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
                <button class="btn btn-primary" onclick="appliedJobs.loadAllApplications()">
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