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
        this.potentialCandidatesCount = 0;
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.addTouchEvents();
        
        // Make instance globally available after initialization
        window.employerDashboard = this;
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadCompanyData();
                await this.loadJobPostings();
                await this.calculatePotentialCandidatesCount();
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

    async calculatePotentialCandidatesCount() {
        try {
            let totalPotentialCandidates = 0;
            
            for (const job of this.jobs) {
                const seekersQuery = query(collection(db, 'users'), where('userType', '==', 'seeker'));
                const seekersSnapshot = await getDocs(seekersQuery);
                
                let jobPotentialCandidates = 0;
                
                for (const seekerDoc of seekersSnapshot.docs) {
                    const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
                    const matchScore = this.calculateMatchScore(job, seeker);
                    
                    if (matchScore > 0.3) {
                        jobPotentialCandidates++;
                    }
                }
                
                totalPotentialCandidates += jobPotentialCandidates;
            }
            
            this.potentialCandidatesCount = totalPotentialCandidates;
            this.updateStats();
            
        } catch (error) {
            console.error('Error calculating potential candidates:', error);
            this.potentialCandidatesCount = 0;
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
        
        // Create job poster HTML - FIXED: Use posterUrl instead of jobImageUrl
        const jobPosterHTML = this.createJobPosterHTML(job);
        
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
                
                ${jobPosterHTML}
                
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
                        ${job.applications || 0} applicants
                    </div>
                    <button class="view-candidates-btn" data-job-id="${job.id}">
                        View Potential Candidates
                    </button>
                </div>
            </div>
        `;
    }

    createJobPosterHTML(job) {
        // FIXED: Use posterUrl instead of jobImageUrl to match the job posting data structure
        const posterUrl = job.posterUrl;
        console.log('Job poster URL for job', job.id, ':', posterUrl);
        
        if (posterUrl && posterUrl.trim() !== '' && posterUrl !== 'https://via.placeholder.com/150x150?text=Job+Image') {
            return `
                <div class="job-poster-container" data-job-id="${job.id}">
                    <img src="${posterUrl}" 
                         alt="${job.title || 'Job Poster'}" 
                         class="job-poster-image"
                         onerror="this.onerror=null; this.parentElement.outerHTML=window.employerDashboard.createNoPosterHTML('${job.id}');">
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
            <div class="no-poster" data-job-id="${jobId}">
                <i class="fas fa-image"></i>
                <span>No job poster image</span>
                <button class="add-poster-btn" data-job-id="${jobId}">
                    <i class="fas fa-plus"></i>
                    Add Poster
                </button>
            </div>
        `;
    }

    showJobDetails(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (job) {
            this.showToast(`Showing details for: ${job.title}`, 'info');
        }
    }

    editJobPoster(jobId) {
        this.showToast('Redirecting to edit job page...', 'info');
        setTimeout(() => {
            window.location.href = `job_posting.html?edit=${jobId}`;
        }, 1000);
    }

    showJobImageModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job || !job.posterUrl) return;

        const modal = document.createElement('div');
        modal.className = 'modal job-image-modal';
        modal.style.display = 'block';
        
        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'https://via.placeholder.com/40x40?text=LOGO';
        const companyName = job.companyName || this.companyData?.companyName || 'Your Company';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${job.title || 'Job Poster'}</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body" style="padding: 0;">
                    <img src="${job.posterUrl}" 
                         alt="${job.title || 'Job Poster'}" 
                         style="width: 100%; display: block;"
                         onerror="this.parentElement.innerHTML='<div style=\\'padding: 40px; text-align: center; color: #64748b;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size: 3rem; margin-bottom: 15px;\\'></i><h4>Image Failed to Load</h4><p>The job poster image could not be loaded.</p></div>'">
                </div>
                <div class="job-image-info" style="padding: 20px; border-top: 1px solid #f1f5f9;">
                    <h4 style="margin: 0 0 10px 0; color: #1e293b;">${job.title || 'Untitled Job'}</h4>
                    <div class="job-image-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; color: #64748b; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center;">
                            <img src="${companyLogo}" alt="Company Logo" style="width: 16px; height: 16px; border-radius: 3px; margin-right: 5px;" onerror="this.src='https://via.placeholder.com/16x16?text=LOGO'">
                            <span>${companyName}</span>
                        </div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-map-marker-alt" style="margin-right: 5px;"></i> ${job.location || 'Remote'}</div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-money-bill-wave" style="margin-right: 5px;"></i> ${job.salary || 'Salary not specified'}</div>
                        <div style="display: flex; align-items: center;"><i class="fas fa-clock" style="margin-right: 5px;"></i> ${this.formatDate(job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt || new Date()))}</div>
                    </div>
                </div>
            </div>
        `;

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

    bindJobCardEvents() {
        document.querySelectorAll('.job-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('view-candidates-btn') && 
                    !e.target.classList.contains('job-poster-container') &&
                    !e.target.classList.contains('job-poster-image') &&
                    !e.target.classList.contains('poster-overlay') &&
                    !e.target.classList.contains('add-poster-btn') &&
                    !e.target.closest('.job-poster-container') &&
                    !e.target.closest('.no-poster')) {
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

        document.querySelectorAll('.no-poster').forEach(noPoster => {
            noPoster.addEventListener('click', (e) => {
                if (!e.target.classList.contains('add-poster-btn') && !e.target.closest('.add-poster-btn')) {
                    e.stopPropagation();
                    const jobId = noPoster.dataset.jobId;
                    this.showJobDetails(jobId);
                }
            });
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

        // Location match
        if (job.location && seeker.preferredLocation) {
            totalFactors++;
            if (job.location.toLowerCase().includes(seeker.preferredLocation.toLowerCase()) || 
                seeker.preferredLocation.toLowerCase().includes(job.location.toLowerCase())) {
                score += 0.3;
            }
        }

        // Salary match
        if (job.salary && seeker.desiredSalary) {
            totalFactors++;
            const jobSalary = this.extractSalary(job.salary);
            const desiredSalary = parseInt(seeker.desiredSalary) || 0;
            
            if (jobSalary && desiredSalary >= jobSalary.min && desiredSalary <= jobSalary.max) {
                score += 0.3;
            }
        }

        // Job type match
        if (job.type && seeker.preferredJobType) {
            totalFactors++;
            if (job.type === seeker.preferredJobType) {
                score += 0.2;
            }
        }

        // Skills match
        if (job.requirements && seeker.skills) {
            totalFactors++;
            const jobSkills = this.extractSkillsFromRequirements(job.requirements);
            const seekerSkills = Array.isArray(seeker.skills) ? seeker.skills : [];
            
            const matchingSkills = jobSkills.filter(jobSkill => 
                seekerSkills.some(seekerSkill => 
                    seekerSkill.toLowerCase().includes(jobSkill.toLowerCase()) || 
                    jobSkill.toLowerCase().includes(seekerSkill.toLowerCase())
                )
            );
            
            if (matchingSkills.length > 0) {
                score += (matchingSkills.length / jobSkills.length) * 0.2;
            }
        }

        return totalFactors > 0 ? score / totalFactors : 0;
    }

    extractSkillsFromRequirements(requirements) {
        if (!requirements) return [];
        
        // Simple skill extraction - you might want to make this more sophisticated
        const commonSkills = ['javascript', 'react', 'node', 'python', 'java', 'html', 'css', 'sql', 'mongodb', 'aws'];
        const foundSkills = [];
        
        commonSkills.forEach(skill => {
            if (requirements.toLowerCase().includes(skill)) {
                foundSkills.push(skill);
            }
        });
        
        return foundSkills.length > 0 ? foundSkills : ['various skills'];
    }

    extractSalary(salaryString) {
        if (!salaryString) return null;
        
        const numbers = salaryString.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
            return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
        } else if (numbers && numbers.length === 1) {
            return { min: parseInt(numbers[0]), max: parseInt(numbers[0]) * 1.5 };
        }
        return null;
    }

    createCandidateCardHTML(candidate) {
        const skills = candidate.skills || [];
        const displaySkills = skills.length > 0 ? skills.slice(0, 5) : ['No skills listed'];
        
        return `
            <div class="candidate-card">
                <div class="candidate-header">
                    <div class="candidate-name">${candidate.fullName || 'Anonymous Candidate'}</div>
                    <div class="match-score">${candidate.matchScore}% Match</div>
                </div>
                <div class="candidate-skills">
                    ${displaySkills.map(skill => 
                        `<span class="skill-tag">${skill}</span>`
                    ).join('')}
                    ${skills.length > 5 ? `<span class="skill-tag">+${skills.length - 5} more</span>` : ''}
                </div>
                <div class="candidate-meta">
                    <div><i class="fas fa-map-marker-alt"></i> ${candidate.preferredLocation || 'Not specified'}</div>
                    <div><i class="fas fa-money-bill-wave"></i> $${candidate.desiredSalary || 'Not specified'}</div>
                    <div><i class="fas fa-briefcase"></i> ${candidate.preferredJobType || 'Not specified'}</div>
                </div>
                <div class="candidate-actions">
                    <button class="btn-view-profile" data-candidate-id="${candidate.id}">
                        <i class="fas fa-eye"></i> View Profile
                    </button>
                    <button class="btn-contact" data-candidate-id="${candidate.id}">
                        <i class="fas fa-envelope"></i> Contact
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
        
        const totalApplicants = this.jobs.reduce((sum, job) => sum + (job.applications || 0), 0);
        document.getElementById('totalApplicantsCount').textContent = totalApplicants;
        
        document.getElementById('potentialMatchesCount').textContent = this.potentialCandidatesCount;
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

    async handleViewAllApplicants() {
        try {
            this.showToast('Loading applicants...', 'info');
            
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('employerId', '==', this.currentUser.uid)
            );
            
            const jobsSnapshot = await getDocs(jobsQuery);
            const jobIds = jobsSnapshot.docs.map(doc => doc.id);
            
            if (jobIds.length === 0) {
                this.showToast('No jobs found', 'info');
                return;
            }
            
            const applications = [];
            for (const jobId of jobIds) {
                const applicationsQuery = query(
                    collection(db, 'applications'),
                    where('jobId', '==', jobId)
                );
                const applicationsSnapshot = await getDocs(applicationsQuery);
                
                applicationsSnapshot.forEach(doc => {
                    applications.push({ id: doc.id, ...doc.data(), jobId });
                });
            }
            
            if (applications.length === 0) {
                this.showToast('No applicants found', 'info');
                return;
            }
            
            const applicantsWithDetails = [];
            
            for (const application of applications) {
                const jobDoc = await getDoc(doc(db, 'jobs', application.jobId));
                const job = jobDoc.exists() ? jobDoc.data() : { title: 'Unknown Job' };
                
                const seekerDoc = await getDoc(doc(db, 'users', application.seekerId));
                const seeker = seekerDoc.exists() ? seekerDoc.data() : { fullName: 'Unknown Seeker' };
                
                applicantsWithDetails.push({
                    ...application,
                    jobTitle: job.title,
                    seekerName: seeker.fullName,
                    seekerEmail: seeker.email,
                    seekerPhone: seeker.phone,
                    seekerResume: seeker.resumeUrl,
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
                            <h4 style="margin: 0; color: #1e293b;">${applicant.seekerName || 'Unknown Seeker'}</h4>
                            <p style="margin: 5px 0; color: #2563eb; font-weight: 500;">Applied for: ${applicant.jobTitle}</p>
                        </div>
                        <div style="color: #64748b; font-size: 0.9rem;">
                            ${applicant.appliedAt?.toDate ? applicant.appliedAt.toDate().toLocaleDateString() : 'Unknown date'}
                        </div>
                    </div>
                    
                    <div class="applicant-contact" style="margin-bottom: 10px;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            ${applicant.seekerEmail ? `<div><i class="fas fa-envelope"></i> ${applicant.seekerEmail}</div>` : ''}
                            ${applicant.seekerPhone ? `<div><i class="fas fa-phone"></i> ${applicant.seekerPhone}</div>` : ''}
                        </div>
                    </div>
                    
                    ${applicant.coverLetter ? `
                    <div class="cover-letter" style="margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #1e293b;">Cover Letter</h5>
                        <div style="background: #f8fafc; padding: 10px; border-radius: 5px; border-left: 3px solid #2563eb;">
                            ${applicant.coverLetter}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${applicant.seekerSkills.length > 0 ? `
                    <div class="applicant-skills" style="margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #1e293b;">Skills</h5>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${applicant.seekerSkills.map(skill => 
                                `<span style="background: #2563eb; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.8rem;">${skill}</span>`
                            ).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="applicant-actions" style="display: flex; gap: 10px;">
                        ${applicant.seekerResume ? `
                        <button class="btn-view-resume" data-resume-url="${applicant.seekerResume}" 
                                style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-file-pdf"></i> View Resume
                        </button>
                        ` : ''}
                        
                        <button class="btn-contact-applicant" data-applicant-email="${applicant.seekerEmail}"
                                style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-envelope"></i> Contact
                        </button>
                    </div>
                </div>
            `;
        });
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>All Applicants (${applicants.length})</h3>
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
        `;

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
        if (resumeUrl) {
            window.open(resumeUrl, '_blank');
        } else {
            this.showToast('Resume not available', 'error');
        }
    }

    contactApplicant(email) {
        if (email) {
            window.open(`mailto:${email}?subject=Regarding Your Job Application`, '_blank');
        } else {
            this.showToast('Contact information not available', 'error');
        }
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
        } else {
            this.showToast(`No ${statType.toLowerCase()} data available yet`, 'info');
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
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new EmployerDashboard();
});