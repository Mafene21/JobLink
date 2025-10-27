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
  getDoc
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

class EmployerDashboard {
    constructor() {
        this.currentUser = null;
        this.companyData = null;
        this.jobs = [];
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.addTouchEvents();
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadCompanyData();
                await this.loadJobPostings();
                this.updateStats();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadCompanyData() {
        try {
            console.log('Loading company data for user:', this.currentUser.uid);
            
            // Try to get company data from companies collection first
            const companyDoc = await getDoc(doc(db, 'companies', this.currentUser.uid));
            if (companyDoc.exists()) {
                this.companyData = companyDoc.data();
                console.log('Company data loaded from companies collection:', this.companyData);
                this.updateCompanyUI();
            } else {
                console.log('No company data found in companies collection, trying users collection...');
                // Fallback to user data
                const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
                if (userDoc.exists()) {
                    this.companyData = userDoc.data();
                    console.log('Company data loaded from users collection:', this.companyData);
                    this.updateCompanyUI();
                } else {
                    console.log('No user data found either');
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
        console.log('Logo URL:', logoUrl);
        
        if (logoUrl && logoUrl !== 'https://via.placeholder.com/150x150?text=Company+Logo') {
            companyLogo.src = logoUrl;
            companyLogoNav.src = logoUrl;
            console.log('Company logo updated');
        } else {
            // Use default logo if no logo is set
            companyLogo.src = 'https://via.placeholder.com/60x60?text=LOGO';
            companyLogoNav.src = 'https://via.placeholder.com/32x32?text=LOGO';
            console.log('Using default logo');
        }

        // Add error handling for images
        companyLogo.onerror = () => {
            console.log('Company logo failed to load, using default');
            companyLogo.src = 'https://via.placeholder.com/60x60?text=LOGO';
        };
        
        companyLogoNav.onerror = () => {
            console.log('Nav logo failed to load, using default');
            companyLogoNav.src = 'https://via.placeholder.com/32x32?text=LOGO';
        };
    }

    async loadJobPostings() {
        const jobsList = document.getElementById('jobsList');
        
        try {
            // Show loading state
            jobsList.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading job postings...</p>
                </div>
            `;

            console.log('Loading jobs for employer:', this.currentUser.uid);
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('employerId', '==', this.currentUser.uid)
            );
            
            const querySnapshot = await getDocs(jobsQuery);
            console.log('Found', querySnapshot.size, 'jobs');
            
            if (querySnapshot.empty) {
                this.showNoJobsState(jobsList);
                return;
            }

            this.jobs = [];
            let jobsData = [];
            
            querySnapshot.forEach((doc) => {
                const job = { id: doc.id, ...doc.data() };
                jobsData.push(job);
            });
            
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

    displayJobs(jobsList, jobsData) {
        let jobsHTML = '';
        jobsData.forEach((job) => {
            jobsHTML += this.createJobCardHTML(job);
        });
        
        jobsList.innerHTML = jobsHTML;
        this.bindJobCardEvents();
    }

    createJobCardHTML(job) {
        const createdAt = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt || new Date());
        const formattedDate = this.formatDate(createdAt);
        
        // Get company logo for job card - handle both company data and job-specific data
        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'https://via.placeholder.com/24x24?text=LOGO';
        const companyName = job.companyName || this.companyData?.companyName || 'Your Company';
        
        return `
            <div class="job-card" data-job-id="${job.id}">
                <div class="job-card-header">
                    <div class="job-header-content">
                        <img src="${companyLogo}" alt="Company Logo" class="job-company-logo" onerror="this.src='https://via.placeholder.com/24x24?text=LOGO'">
                        <div class="job-title-section">
                            <div class="job-title">${job.title || 'Untitled Job'}</div>
                            <div class="job-company">${companyName}</div>
                        </div>
                    </div>
                    <div class="job-type">${this.formatJobType(job.type) || 'Full-time'}</div>
                </div>
                
                ${job.jobImageUrl ? `
                <div class="job-poster-preview">
                    <img src="${job.jobImageUrl}" alt="${job.title || 'Job Image'}" 
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-poster\\'><i class=\\'fas fa-image\\'></i><span>Job Image Failed to Load</span></div>';">
                    <div class="poster-overlay">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
                ` : `
                <div class="no-poster">
                    <i class="fas fa-image"></i>
                    <span>No job image uploaded</span>
                </div>
                `}
                
                <div class="job-meta">
                    <div class="job-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${job.location || 'Remote'}</span>
                    </div>
                    <div class="job-meta-item">
                        <i class="fas fa-money-bill-wave"></i>
                        <span>${job.salary ? job.salary : 'Salary not specified'}</span>
                    </div>
                    <div class="job-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="job-description">
                    ${job.description || 'No description provided.'}
                </div>
                <div class="job-footer">
                    <div class="job-applicants">
                        <i class="fas fa-users"></i>
                        ${job.applicantCount || 0} applicants
                    </div>
                    <button class="view-candidates-btn" data-job-id="${job.id}">
                        View Potential Candidates
                    </button>
                </div>
            </div>
        `;
    }

    showNoJobsState(jobsList) {
        jobsList.innerHTML = `
            <div class="no-jobs-state">
                <i class="fas fa-briefcase"></i>
                <h3>No Job Postings Yet</h3>
                <p>Get started by creating your first job posting</p>
                <button class="btn btn-primary" id="createFirstJob">
                    <i class="fas fa-plus"></i>
                    Create Your First Job
                </button>
            </div>
        `;
        
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
                <p><small>Technical: ${error.message}</small></p>
                <button class="btn btn-secondary" onclick="location.reload()">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            `;
        }
        
        jobsList.innerHTML = `
            <div class="no-jobs-state">
                <i class="fas fa-exclamation-triangle"></i>
                ${errorMessage}
            </div>
        `;
    }

    bindJobCardEvents() {
        document.querySelectorAll('.job-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('view-candidates-btn') && 
                    !e.target.classList.contains('job-poster-preview') &&
                    !e.target.closest('.job-poster-preview')) {
                    const jobId = card.dataset.jobId;
                    this.showJobDetails(jobId);
                }
            });
        });
        
        document.querySelectorAll('.view-candidates-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.jobId;
                this.showPotentialCandidates(jobId);
            });
        });

        // Add click event for job poster previews
        document.querySelectorAll('.job-poster-preview').forEach(preview => {
            preview.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobCard = preview.closest('.job-card');
                const jobId = jobCard.dataset.jobId;
                this.showJobImageModal(jobId);
            });
        });
    }

    showJobImageModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job || !job.jobImageUrl) return;

        // Create modal for job image
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>${job.title || 'Job Image'}</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body" style="text-align: center; padding: 0;">
                    <img src="${job.jobImageUrl}" alt="${job.title || 'Job Image'}" style="width: 100%; max-height: 70vh; object-fit: contain;" 
                         onerror="this.parentElement.innerHTML='<div style=\\'padding: 40px; text-align: center; color: #95a5a6;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size: 3rem; margin-bottom: 15px;\\'></i><h4>Image Failed to Load</h4></div>'">
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal events
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

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'internship': 'Internship',
            'remote': 'Remote'
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

    async showPotentialCandidates(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('jobModal');
        const candidatesList = document.getElementById('candidatesList');
        const modalJobTitle = document.getElementById('modalJobTitle');

        modalJobTitle.textContent = `Potential Candidates - ${job.title}`;
        
        candidatesList.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Finding potential candidates...</p>
            </div>
        `;

        modal.style.display = 'block';

        try {
            const seekersQuery = query(collection(db, 'users'), where('userType', '==', 'seeker'));
            const seekersSnapshot = await getDocs(seekersQuery);
            
            const potentialCandidates = [];
            
            for (const seekerDoc of seekersSnapshot.docs) {
                const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
                const matchScore = this.calculateMatchScore(job, seeker);
                
                if (matchScore > 0.3) {
                    potentialCandidates.push({
                        ...seeker,
                        matchScore: Math.round(matchScore * 100)
                    });
                }
            }
            
            potentialCandidates.sort((a, b) => b.matchScore - a.matchScore);
            
            if (potentialCandidates.length === 0) {
                candidatesList.innerHTML = `
                    <div class="no-candidates-state">
                        <i class="fas fa-user-slash"></i>
                        <h4>No Potential Candidates Found</h4>
                        <p>Try adjusting your job requirements to find better matches.</p>
                    </div>
                `;
                return;
            }
            
            let candidatesHTML = '';
            potentialCandidates.forEach(candidate => {
                candidatesHTML += this.createCandidateCardHTML(candidate);
            });
            
            candidatesList.innerHTML = candidatesHTML;
            
        } catch (error) {
            console.error('Error loading candidates:', error);
            candidatesList.innerHTML = `
                <div class="no-candidates-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h4>Error Loading Candidates</h4>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }

    calculateMatchScore(job, seeker) {
        let score = 0;
        let totalFactors = 0;

        if (job.location && seeker.preferredLocation) {
            totalFactors++;
            if (job.location.toLowerCase().includes(seeker.preferredLocation.toLowerCase()) || 
                seeker.preferredLocation.toLowerCase().includes(job.location.toLowerCase())) {
                score += 0.3;
            }
        }

        if (job.salary && seeker.desiredSalary) {
            totalFactors++;
            const jobSalary = this.extractSalary(job.salary);
            if (jobSalary && seeker.desiredSalary >= jobSalary.min && seeker.desiredSalary <= jobSalary.max) {
                score += 0.3;
            }
        }

        if (job.type && seeker.preferredJobType) {
            totalFactors++;
            if (job.type === seeker.preferredJobType) {
                score += 0.2;
            }
        }

        if (job.category && seeker.preferredIndustry) {
            totalFactors++;
            if (job.category === seeker.preferredIndustry) {
                score += 0.2;
            }
        }

        return totalFactors > 0 ? score / totalFactors : 0;
    }

    extractSalary(salaryString) {
        const numbers = salaryString.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
            return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
        }
        return null;
    }

    createCandidateCardHTML(candidate) {
        return `
            <div class="candidate-card">
                <div class="candidate-header">
                    <div class="candidate-name">${candidate.fullName || 'Anonymous Candidate'}</div>
                    <div class="match-score">${candidate.matchScore}% Match</div>
                </div>
                <div class="candidate-skills">
                    ${(candidate.skills || []).slice(0, 5).map(skill => 
                        `<span class="skill-tag">${skill}</span>`
                    ).join('')}
                </div>
                <div class="candidate-meta">
                    <div><i class="fas fa-map-marker-alt"></i> ${candidate.preferredLocation || 'Not specified'}</div>
                    <div><i class="fas fa-money-bill-wave"></i> $${candidate.desiredSalary || 'Not specified'}</div>
                    <div><i class="fas fa-briefcase"></i> ${candidate.preferredJobType || 'Not specified'}</div>
                </div>
                <div class="candidate-actions">
                    <button class="btn-view-profile" onclick="employerDashboard.viewCandidateProfile('${candidate.id}')">
                        View Profile
                    </button>
                    <button class="btn-contact" onclick="employerDashboard.contactCandidate('${candidate.id}')">
                        Contact
                    </button>
                </div>
            </div>
        `;
    }

    viewCandidateProfile(candidateId) {
        window.open(`candidate_profile.html?id=${candidateId}`, '_blank');
    }

    contactCandidate(candidateId) {
        this.showToast('Contact feature will be implemented soon!', 'info');
    }

    updateStats() {
        document.getElementById('activeJobsCount').textContent = this.jobs.length;
        
        const totalApplicants = this.jobs.reduce((sum, job) => sum + (job.applicantCount || 0), 0);
        document.getElementById('totalApplicantsCount').textContent = totalApplicants;
        
        document.getElementById('potentialMatchesCount').textContent = this.jobs.length * 3;
    }

    bindEvents() {
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
        this.showToast(`No ${statType.toLowerCase()} data available yet`, 'info');
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
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
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

let employerDashboard;
document.addEventListener('DOMContentLoaded', function() {
    employerDashboard = new EmployerDashboard();
});