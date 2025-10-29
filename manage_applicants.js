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

class ManageApplicants {
    constructor() {
        this.currentUser = null;
        this.companyData = null;
        this.applications = [];
        this.jobs = [];
        this.filteredApplications = [];
        this.selectedApplicants = new Set();
        this.currentView = 'grid';
        this.currentPage = 1;
        this.applicantsPerPage = 12;
        this.filters = {
            search: '',
            job: 'all',
            status: 'all',
            experience: 'all'
        };
        this.currentApplicant = null;
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.loadCompanyData();
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadJobs();
                await this.loadApplications();
                this.updateStats();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadCompanyData() {
        try {
            const companyDoc = await getDoc(doc(db, 'companies', this.currentUser.uid));
            if (companyDoc.exists()) {
                this.companyData = companyDoc.data();
                this.updateCompanyLogo();
            }
        } catch (error) {
            console.error('Error loading company data:', error);
        }
    }

    updateCompanyLogo() {
        const companyLogoNav = document.getElementById('companyLogoNav');
        if (this.companyData?.logoUrl && this.companyData.logoUrl !== 'https://via.placeholder.com/150x150?text=Company+Logo') {
            companyLogoNav.src = this.companyData.logoUrl;
        }
    }

    async loadJobs() {
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('employerId', '==', this.currentUser.uid)
            );
            
            const querySnapshot = await getDocs(jobsQuery);
            this.jobs = [];
            querySnapshot.forEach((doc) => {
                this.jobs.push({ id: doc.id, ...doc.data() });
            });
            
            this.populateJobFilter();
        } catch (error) {
            console.error('Error loading jobs:', error);
        }
    }

    populateJobFilter() {
        const jobFilter = document.getElementById('jobFilter');
        let options = '<option value="all">All Jobs</option>';
        
        this.jobs.forEach(job => {
            options += `<option value="${job.id}">${job.title}</option>`;
        });
        
        jobFilter.innerHTML = options;
    }

    async loadApplications() {
        const container = document.getElementById('applicantsContainer');
        
        try {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading applicants...</p>
                </div>
            `;

            // Load applications for all jobs of this employer
            const applications = [];
            
            for (const job of this.jobs) {
                const applicationsQuery = query(
                    collection(db, 'applications'),
                    where('jobId', '==', job.id)
                );
                
                const applicationsSnapshot = await getDocs(applicationsQuery);
                
                for (const appDoc of applicationsSnapshot.docs) {
                    const applicationData = appDoc.data();
                    console.log('Raw application data:', applicationData);
                    
                    const application = { 
                        id: appDoc.id, 
                        ...applicationData,
                        jobTitle: job.title,
                        jobType: job.jobType,
                        jobLocation: job.location,
                        appliedAt: applicationData.appliedDate?.toDate ? applicationData.appliedDate.toDate() : new Date(applicationData.appliedDate || new Date())
                    };
                    
                    // Load applicant data - try multiple collection names
                    application.applicant = await this.loadApplicantData(application.seekerId || application.applicantId);
                    
                    applications.push(application);
                }
            }
            
            this.applications = applications;
            console.log('All loaded applications:', this.applications);
            this.applyFilters();
            this.renderApplicants();
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.showErrorState(container, error);
        }
    }

    async loadApplicantData(applicantId) {
        if (!applicantId) {
            console.log('No applicant ID provided');
            return null;
        }

        try {
            console.log('Loading applicant data for ID:', applicantId);
            
            // Try different collection names
            const collections = ['seekers', 'users', 'applicants'];
            let applicantData = null;
            
            for (const collectionName of collections) {
                try {
                    const applicantDoc = await getDoc(doc(db, collectionName, applicantId));
                    if (applicantDoc.exists()) {
                        applicantData = applicantDoc.data();
                        console.log(`Found applicant in ${collectionName}:`, applicantData);
                        break;
                    }
                } catch (error) {
                    console.log(`No applicant found in ${collectionName}:`, error.message);
                }
            }
            
            if (!applicantData) {
                console.log('Applicant not found in any collection');
                // Create a fallback applicant object
                applicantData = {
                    fullName: 'Unknown Applicant',
                    email: 'No email available',
                    title: 'Not specified',
                    location: 'Not specified',
                    experience: 'Not specified',
                    skills: [],
                    bio: 'No information available'
                };
            }
            
            return applicantData;
            
        } catch (error) {
            console.error('Error loading applicant data:', error);
            return {
                fullName: 'Error Loading Applicant',
                email: 'Error',
                title: 'Error',
                location: 'Error',
                experience: 'Error',
                skills: [],
                bio: 'Error loading applicant information'
            };
        }
    }

    applyFilters() {
        this.filteredApplications = this.applications.filter(application => {
            const applicant = application.applicant || {};
            
            // Search filter
            const searchTerm = this.filters.search.toLowerCase();
            const matchesSearch = !searchTerm || 
                applicant.fullName?.toLowerCase().includes(searchTerm) ||
                applicant.email?.toLowerCase().includes(searchTerm) ||
                (applicant.skills && applicant.skills.some(skill => skill.toLowerCase().includes(searchTerm))) ||
                application.jobTitle?.toLowerCase().includes(searchTerm);

            // Job filter
            const matchesJob = this.filters.job === 'all' || application.jobId === this.filters.job;

            // Status filter
            const matchesStatus = this.filters.status === 'all' || application.status === this.filters.status;

            // Experience filter
            const matchesExperience = this.filters.experience === 'all' || 
                this.matchesExperienceLevel(applicant.experience, this.filters.experience);

            return matchesSearch && matchesJob && matchesStatus && matchesExperience;
        });

        // Sort by application date (newest first)
        this.filteredApplications.sort((a, b) => b.appliedAt - a.appliedAt);
    }

    matchesExperienceLevel(experience, level) {
        if (!experience || experience === 'Not specified') return false;
        
        // Try to extract years from experience string
        let years = 0;
        if (typeof experience === 'number') {
            years = experience;
        } else if (typeof experience === 'string') {
            const yearMatch = experience.match(/(\d+)/);
            years = yearMatch ? parseInt(yearMatch[1]) : 0;
        }
        
        switch (level) {
            case 'entry': return years <= 2;
            case 'mid': return years > 2 && years <= 5;
            case 'senior': return years > 5;
            default: return true;
        }
    }

    renderApplicants() {
        const container = document.getElementById('applicantsContainer');
        
        if (this.filteredApplications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>No Applicants Found</h3>
                    <p>No applicants match your current filters. Try adjusting your search criteria.</p>
                    <button class="btn btn-primary" onclick="manageApplicants.clearFilters()">
                        Clear Filters
                    </button>
                </div>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.applicantsPerPage;
        const endIndex = startIndex + this.applicantsPerPage;
        const paginatedApplications = this.filteredApplications.slice(startIndex, endIndex);

        let applicantsHTML = '';
        
        if (this.currentView === 'grid') {
            applicantsHTML = '<div class="applicants-grid">';
            paginatedApplications.forEach(application => {
                applicantsHTML += this.createApplicantCard(application);
            });
            applicantsHTML += '</div>';
        } else {
            applicantsHTML = '<div class="applicants-list">';
            paginatedApplications.forEach(application => {
                applicantsHTML += this.createApplicantCard(application, true);
            });
            applicantsHTML += '</div>';
        }

        container.innerHTML = applicantsHTML;
        this.bindApplicantCardEvents();
        this.renderPagination();
    }

    createApplicantCard(application, isList = false) {
        const applicant = application.applicant || {};
        const isSelected = this.selectedApplicants.has(application.id);
        const statusClass = `status-${application.status || 'new'}`;
        const cardClass = `applicant-card ${application.status || 'new'} ${isSelected ? 'selected' : ''}`;
        
        const appliedDate = this.formatDate(application.appliedAt);
        const experience = this.getExperienceDisplay(applicant.experience);
        const applicantName = applicant.fullName || 'Unknown Applicant';
        const applicantTitle = applicant.title || applicant.professionalTitle || 'No title specified';
        const applicantEmail = applicant.email || 'No email available';
        const applicantLocation = applicant.location || 'Not specified';
        const applicantSkills = applicant.skills || [];

        if (isList) {
            return `
                <div class="${cardClass}" data-application-id="${application.id}">
                    <div class="applicant-main">
                        <img src="${applicant.profilePicture || applicant.photoURL || 'https://via.placeholder.com/50x50?text=U'}" 
                             alt="${applicantName}" class="applicant-avatar">
                        <div class="applicant-info">
                            <div class="applicant-name">${applicantName}</div>
                            <div class="applicant-title">${applicantTitle}</div>
                            <div class="applicant-meta">
                                <div class="applicant-meta-item">
                                    <i class="fas fa-briefcase"></i>
                                    ${application.jobTitle}
                                </div>
                                <div class="applicant-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${applicantLocation}
                                </div>
                                <div class="applicant-meta-item">
                                    <i class="fas fa-clock"></i>
                                    ${appliedDate}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="applicant-status">
                        <span class="status-badge ${statusClass}">${application.status || 'new'}</span>
                    </div>
                    <div class="applicant-actions">
                        <button class="btn btn-sm btn-outline view-applicant" data-application-id="${application.id}">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        <button class="btn btn-sm btn-primary update-status" data-application-id="${application.id}">
                            <i class="fas fa-edit"></i>
                            Status
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="${cardClass}" data-application-id="${application.id}">
                <div class="applicant-header">
                    <div class="applicant-main">
                        <img src="${applicant.profilePicture || applicant.photoURL || 'https://via.placeholder.com/60x60?text=U'}" 
                             alt="${applicantName}" class="applicant-avatar">
                        <div class="applicant-basic-info">
                            <div class="applicant-name">${applicantName}</div>
                            <div class="applicant-title">${applicantTitle}</div>
                            <div class="applicant-meta">
                                <div class="applicant-meta-item">
                                    <i class="fas fa-envelope"></i>
                                    ${applicantEmail}
                                </div>
                                <div class="applicant-meta-item">
                                    <i class="fas fa-briefcase"></i>
                                    ${experience}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="applicant-status">
                        <span class="status-badge ${statusClass}">${application.status || 'new'}</span>
                    </div>
                </div>
                
                <div class="applicant-meta">
                    <div class="applicant-meta-item">
                        <i class="fas fa-briefcase"></i>
                        Applied for: ${application.jobTitle}
                    </div>
                    <div class="applicant-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        ${applicantLocation}
                    </div>
                    <div class="applicant-meta-item">
                        <i class="fas fa-clock"></i>
                        ${appliedDate}
                    </div>
                </div>

                ${applicantSkills.length > 0 ? `
                <div class="applicant-skills">
                    ${applicantSkills.slice(0, 4).map(skill => 
                        `<span class="skill-tag">${skill}</span>`
                    ).join('')}
                    ${applicantSkills.length > 4 ? `<span class="skill-tag">+${applicantSkills.length - 4} more</span>` : ''}
                </div>
                ` : ''}

                <div class="applicant-actions">
                    <button class="btn btn-sm btn-outline view-applicant" data-application-id="${application.id}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-primary update-status" data-application-id="${application.id}">
                        <i class="fas fa-edit"></i>
                        Update Status
                    </button>
                    <button class="btn btn-sm btn-secondary send-message" data-application-id="${application.id}">
                        <i class="fas fa-envelope"></i>
                        Message
                    </button>
                </div>
            </div>
        `;
    }

    getExperienceDisplay(experience) {
        if (!experience || experience === 'Not specified') return 'Not specified';
        if (typeof experience === 'number') return `${experience} years`;
        if (typeof experience === 'string') {
            if (experience.includes('years')) return experience;
            return `${experience} years`;
        }
        return 'Not specified';
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

    bindApplicantCardEvents() {
        // View applicant details
        document.querySelectorAll('.view-applicant').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.view-applicant').dataset.applicationId;
                this.showApplicantDetails(applicationId);
            });
        });

        // Update status
        document.querySelectorAll('.update-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.update-status').dataset.applicationId;
                this.showStatusModal(applicationId);
            });
        });

        // Send message
        document.querySelectorAll('.send-message').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const applicationId = e.target.closest('.send-message').dataset.applicationId;
                this.showMessageModal(applicationId);
            });
        });

        // Select applicant card
        document.querySelectorAll('.applicant-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const applicationId = card.dataset.applicationId;
                    this.showApplicantDetails(applicationId);
                }
            });
        });
    }

    showApplicantDetails(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        this.currentApplicant = application;
        const sidebar = document.getElementById('applicantDetailsSidebar');
        const content = document.getElementById('sidebarContent');

        content.innerHTML = this.createApplicantDetailsHTML(application);
        sidebar.classList.add('active');
    }

    createApplicantDetailsHTML(application) {
        const applicant = application.applicant || {};
        const statusClass = `status-${application.status || 'new'}`;
        
        const applicantName = applicant.fullName || 'Unknown Applicant';
        const applicantTitle = applicant.title || applicant.professionalTitle || 'No title specified';
        const applicantEmail = applicant.email || 'Not specified';
        const applicantPhone = applicant.phone || applicant.phoneNumber || 'Not specified';
        const applicantLocation = applicant.location || 'Not specified';
        const applicantExperience = this.getExperienceDisplay(applicant.experience);
        const applicantEducation = applicant.education || applicant.highestEducation || 'Not specified';
        const applicantBio = applicant.bio || applicant.about || 'No information available';
        const applicantSkills = applicant.skills || [];
        const applicantCurrentStatus = applicant.currentStatus || applicant.employmentStatus || 'Not specified';

        return `
            <div class="applicant-details">
                <div class="detail-section">
                    <div class="applicant-header" style="border: none; margin: 0;">
                        <div class="applicant-main">
                            <img src="${applicant.profilePicture || applicant.photoURL || 'https://via.placeholder.com/80x80?text=U'}" 
                                 alt="${applicantName}" class="applicant-avatar">
                            <div class="applicant-basic-info">
                                <div class="applicant-name">${applicantName}</div>
                                <div class="applicant-title">${applicantTitle}</div>
                                <span class="status-badge ${statusClass}">${application.status || 'new'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Contact Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${applicantEmail}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${applicantPhone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${applicantLocation}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Professional Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Experience</span>
                            <span class="detail-value">${applicantExperience}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Education</span>
                            <span class="detail-value">${applicantEducation}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Current Status</span>
                            <span class="detail-value">${applicantCurrentStatus}</span>
                        </div>
                    </div>
                </div>

                ${applicantSkills.length > 0 ? `
                <div class="detail-section">
                    <h4>Skills</h4>
                    <div class="skills-container">
                        ${applicantSkills.map(skill => 
                            `<span class="skill-tag">${skill}</span>`
                        ).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="detail-section">
                    <h4>About</h4>
                    <p style="line-height: 1.6; white-space: pre-wrap;">${applicantBio}</p>
                </div>

                <div class="detail-section">
                    <h4>Application Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Job Applied</span>
                            <span class="detail-value">${application.jobTitle}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applied Date</span>
                            <span class="detail-value">${application.appliedAt.toLocaleDateString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Application Status</span>
                            <span class="detail-value status-badge ${statusClass}">${application.status || 'new'}</span>
                        </div>
                    </div>
                </div>

                ${application.resumeUrl ? `
                <div class="detail-section">
                    <h4>Resume</h4>
                    <div class="resume-preview">
                        <a href="${application.resumeUrl}" target="_blank" class="resume-link">
                            <i class="fas fa-file-pdf"></i>
                            View Resume
                        </a>
                    </div>
                </div>
                ` : ''}

                ${application.coverLetter || application.applicationMessage ? `
                <div class="detail-section">
                    <h4>Cover Letter</h4>
                    <div style="background: var(--light-gray); padding: 15px; border-radius: 8px;">
                        <p style="line-height: 1.6; white-space: pre-wrap;">${application.coverLetter || application.applicationMessage}</p>
                    </div>
                </div>
                ` : ''}

                <div class="action-buttons">
                    <button class="btn btn-primary" id="updateStatusFromSidebar">
                        <i class="fas fa-edit"></i>
                        Update Status
                    </button>
                    <button class="btn btn-secondary" id="sendMessageFromSidebar">
                        <i class="fas fa-envelope"></i>
                        Send Message
                    </button>
                    <button class="btn btn-outline" onclick="window.open('${application.resumeUrl}', '_blank')" 
                            ${!application.resumeUrl ? 'disabled' : ''}>
                        <i class="fas fa-download"></i>
                        Download Resume
                    </button>
                </div>
            </div>
        `;
    }

    showStatusModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('statusModal');
        const applicantInfo = document.getElementById('statusApplicantInfo');
        const applicant = application.applicant || {};

        applicantInfo.innerHTML = `
            <strong>${applicant.fullName || 'Unknown Applicant'}</strong><br>
            <small>Applied for: ${application.jobTitle} | Current Status: ${application.status || 'new'}</small>
        `;

        document.getElementById('newStatus').value = application.status || 'new';
        document.getElementById('statusNotes').value = '';
        
        modal.style.display = 'flex';

        // Show/hide interview date field
        document.getElementById('newStatus').addEventListener('change', (e) => {
            const interviewSection = document.getElementById('interviewSection');
            interviewSection.style.display = e.target.value === 'interview' ? 'block' : 'none';
        });

        document.getElementById('saveStatusUpdate').onclick = () => {
            this.updateApplicationStatus(applicationId);
        };
    }

    async updateApplicationStatus(applicationId) {
        const newStatus = document.getElementById('newStatus').value;
        const notes = document.getElementById('statusNotes').value;
        const interviewDate = document.getElementById('interviewDate').value;

        try {
            const updateData = {
                status: newStatus,
                updatedAt: Timestamp.now()
            };

            if (notes) {
                updateData.notes = notes;
            }

            if (newStatus === 'interview' && interviewDate) {
                updateData.interviewDate = Timestamp.fromDate(new Date(interviewDate));
            }

            await updateDoc(doc(db, 'applications', applicationId), updateData);
            
            this.hideModal('statusModal');
            this.showToast('Application status updated successfully');
            
            // Update local data
            const application = this.applications.find(app => app.id === applicationId);
            if (application) {
                application.status = newStatus;
                if (notes) {
                    application.notes = notes;
                }
                if (interviewDate) {
                    application.interviewDate = new Date(interviewDate);
                }
            }
            
            this.applyFilters();
            this.renderApplicants();
            this.updateStats();
            
            // Refresh sidebar if this applicant is currently selected
            if (this.currentApplicant && this.currentApplicant.id === applicationId) {
                this.showApplicantDetails(applicationId);
            }
            
        } catch (error) {
            console.error('Error updating application status:', error);
            this.showToast('Error updating status', 'error');
        }
    }

    showMessageModal(applicationId) {
        const application = this.filteredApplications.find(app => app.id === applicationId);
        if (!application) return;

        const modal = document.getElementById('messageModal');
        const applicantInfo = document.getElementById('messageApplicantInfo');
        const applicant = application.applicant || {};

        applicantInfo.innerHTML = `
            <strong>${applicant.fullName || 'Unknown Applicant'}</strong><br>
            <small>Email: ${applicant.email || 'Not specified'} | Job: ${application.jobTitle}</small>
        `;

        document.getElementById('messageSubject').value = `Regarding your application for ${application.jobTitle}`;
        document.getElementById('messageContent').value = '';
        
        modal.style.display = 'flex';

        document.getElementById('sendMessage').onclick = () => {
            this.sendMessageToApplicant(applicationId);
        };
    }

    async sendMessageToApplicant(applicationId) {
        const subject = document.getElementById('messageSubject').value;
        const content = document.getElementById('messageContent').value;
        const sendCopy = document.getElementById('sendCopy').checked;

        if (!subject || !content) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            // In a real application, you would integrate with an email service here
            // For now, we'll just simulate the action
            
            console.log('Sending message to applicant:', {
                applicationId,
                subject,
                content,
                sendCopy
            });

            this.hideModal('messageModal');
            this.showToast('Message sent successfully to applicant');
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error sending message', 'error');
        }
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredApplications.length / this.applicantsPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <div class="pagination-info">
                Showing ${((this.currentPage - 1) * this.applicantsPerPage) + 1} to 
                ${Math.min(this.currentPage * this.applicantsPerPage, this.filteredApplications.length)} 
                of ${this.filteredApplications.length} applicants
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="manageApplicants.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                paginationHTML += `
                    <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="manageApplicants.goToPage(${i})">
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
                    onclick="manageApplicants.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `</div>`;
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderApplicants();
    }

    updateStats() {
        const totalApplicants = this.applications.length;
        const newApplicants = this.applications.filter(app => app.status === 'new' || !app.status).length;
        const reviewedApplicants = this.applications.filter(app => app.status === 'reviewed').length;
        const shortlistedApplicants = this.applications.filter(app => app.status === 'shortlisted').length;
        const rejectedApplicants = this.applications.filter(app => app.status === 'rejected').length;

        document.getElementById('totalApplicantsCount').textContent = totalApplicants;
        document.getElementById('newApplicantsCount').textContent = newApplicants;
        document.getElementById('reviewedApplicantsCount').textContent = reviewedApplicants;
        document.getElementById('shortlistedApplicantsCount').textContent = shortlistedApplicants;
        document.getElementById('rejectedApplicantsCount').textContent = rejectedApplicants;
    }

    bindEvents() {
        // Filter events
        document.getElementById('applicantSearch').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplicants();
        });

        document.getElementById('jobFilter').addEventListener('change', (e) => {
            this.filters.job = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplicants();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplicants();
        });

        document.getElementById('experienceFilter').addEventListener('change', (e) => {
            this.filters.experience = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderApplicants();
        });

        // Clear filters
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.setView(view);
            });
        });

        // Refresh applicants
        document.getElementById('refreshApplicants').addEventListener('click', () => {
            this.loadApplications();
        });

        // Close sidebar
        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('applicantDetailsSidebar').classList.remove('active');
        });

        // Sidebar actions
        document.addEventListener('click', (e) => {
            if (e.target.id === 'updateStatusFromSidebar' && this.currentApplicant) {
                this.showStatusModal(this.currentApplicant.id);
            }
            if (e.target.id === 'sendMessageFromSidebar' && this.currentApplicant) {
                this.showMessageModal(this.currentApplicant.id);
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
        document.getElementById('cancelStatusUpdate').addEventListener('click', () => {
            this.hideModal('statusModal');
        });

        document.getElementById('cancelMessage').addEventListener('click', () => {
            this.hideModal('messageModal');
        });

        // Export functionality
        document.getElementById('exportApplicants').addEventListener('click', () => {
            this.exportApplicantsData();
        });

        // Logout
        document.querySelector('.logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
    }

    clearFilters() {
        document.getElementById('applicantSearch').value = '';
        document.getElementById('jobFilter').value = 'all';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('experienceFilter').value = 'all';
        
        this.filters = {
            search: '',
            job: 'all',
            status: 'all',
            experience: 'all'
        };
        
        this.currentPage = 1;
        this.applyFilters();
        this.renderApplicants();
    }

    setView(view) {
        this.currentView = view;
        this.currentPage = 1;
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        this.renderApplicants();
    }

    exportApplicantsData() {
        // In a real application, this would generate a CSV or Excel file
        // For now, we'll just show a success message
        this.showToast('Applicant data exported successfully');
        console.log('Exporting applicants data:', this.filteredApplications);
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
                <h3>Error Loading Applicants</h3>
                <p>There was a problem loading applicant data. Please try again.</p>
                <button class="btn btn-primary" onclick="manageApplicants.loadApplications()">
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

let manageApplicants;
document.addEventListener('DOMContentLoaded', function() {
    manageApplicants = new ManageApplicants();
});