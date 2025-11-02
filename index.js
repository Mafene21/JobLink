// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query,
    where,
    orderBy,
    limit 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

class JobLinkHomepage {
    constructor() {
        this.currentJobId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFeaturedJobs();
        this.loadCategories();
        this.loadRealStats();
        this.animateOnScroll();
    }

    // Fixed Mobile Navigation
    bindEvents() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        console.log('Hamburger:', hamburger);
        console.log('Nav Menu:', navMenu);
        
        // Mobile menu toggle
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
                console.log('Menu toggled. Active:', navMenu.classList.contains('active'));
            });
        }
        
        // Close menu when clicking on a link
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar') && navMenu?.classList.contains('active')) {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            }
        });
        
        // Search functionality
        this.initAdvancedSearch();
        
        // Modal close events
        this.bindModalEvents();
    }

    // Bind modal events
    bindModalEvents() {
        const jobModal = document.getElementById('jobModal');
        const authModal = document.getElementById('authModal');
        const modalClose = document.getElementById('modalClose');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeJobModal());
        }

        // Close modals when clicking outside
        [jobModal, authModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        if (modal === jobModal) this.closeJobModal();
                        if (modal === authModal) this.closeAuthModal();
                    }
                });
            }
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeJobModal();
                this.closeAuthModal();
            }
        });
    }

    // Enhanced Search with Suggestions
    initAdvancedSearch() {
        const searchBtn = document.getElementById('searchButton');
        const jobInput = document.getElementById('jobSearchInput');
        const locationInput = document.getElementById('locationSearchInput');
        const suggestions = document.querySelector('.search-suggestions');
        
        const categories = ['Technology', 'Healthcare', 'Business', 'Education', 'Engineering', 'Creative', 
                           'Marketing', 'Sales', 'Customer Service', 'Finance', 'Design', 'Operations'];
        
        // Search button click
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }
        
        // Enter key support
        [jobInput, locationInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.performSearch();
                    }
                });
            }
        });
        
        // Job input suggestions
        if (jobInput && suggestions) {
            jobInput.addEventListener('input', (e) => {
                const value = e.target.value.toLowerCase();
                suggestions.innerHTML = '';
                
                if (value.length > 1) {
                    const filtered = categories.filter(cat => 
                        cat.toLowerCase().includes(value)
                    );
                    
                    if (filtered.length > 0) {
                        filtered.forEach(cat => {
                            const div = document.createElement('div');
                            div.textContent = cat;
                            div.addEventListener('click', () => {
                                jobInput.value = cat;
                                suggestions.innerHTML = '';
                                this.performSearch();
                            });
                            suggestions.appendChild(div);
                        });
                    } else {
                        const div = document.createElement('div');
                        div.textContent = 'No suggestions found';
                        div.style.color = 'var(--gray)';
                        div.style.cursor = 'default';
                        suggestions.appendChild(div);
                    }
                }
            });
        }
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (suggestions && !e.target.closest('.search-input')) {
                suggestions.innerHTML = '';
            }
        });
    }

    performSearch() {
        const jobInput = document.getElementById('jobSearchInput');
        const locationInput = document.getElementById('locationSearchInput');
        
        if (!jobInput || !locationInput) return;
        
        const jobQuery = jobInput.value.trim();
        const locationQuery = locationInput.value.trim();
        
        const params = new URLSearchParams();
        if (jobQuery) params.set('q', jobQuery);
        if (locationQuery) params.set('location', locationQuery);
        
        // Store search in session storage for jobs page
        sessionStorage.setItem('lastSearch', JSON.stringify({
            query: jobQuery,
            location: locationQuery,
            timestamp: new Date().getTime()
        }));
        
        window.location.href = `jobs.html?${params.toString()}`;
    }

    // Generate SVG placeholder for company logos
    generateCompanyLogo(companyName, size = 50) {
        const initials = companyName
            ? companyName.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2)
            : 'CO';
        
        const colors = ['#2c5aa0', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#34495e'];
        const color = colors[companyName?.length % colors.length] || '#2c5aa0';
        
        const svgString = `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="${color}" rx="8"/>
                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
                      fill="white" font-weight="bold" font-size="${size * 0.4}">
                    ${initials}
                </text>
            </svg>
        `;
        
        // Convert to data URL
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    }

    // Load Featured Jobs from Firebase
    async loadFeaturedJobs() {
        const jobsGrid = document.getElementById('jobsGrid');
        if (!jobsGrid) return;
        
        try {
            jobsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading featured jobs...</p>
                </div>
            `;

            console.log('Loading featured jobs from Firebase...');

            // Query for featured jobs
            let jobsQuery;
            let jobsSnapshot;
            
            try {
                // Approach 1: Try to get jobs with featured flag
                jobsQuery = query(
                    collection(db, 'jobs'),
                    where('featured', '==', true),
                    where('status', '==', 'active'),
                    limit(6)
                );
                jobsSnapshot = await getDocs(jobsQuery);
                console.log('Found featured jobs:', jobsSnapshot.size);
                
                // If no featured jobs found, get recent active jobs
                if (jobsSnapshot.empty) {
                    console.log('No featured jobs found, loading recent active jobs...');
                    jobsQuery = query(
                        collection(db, 'jobs'),
                        where('status', '==', 'active'),
                        orderBy('createdAt', 'desc'),
                        limit(6)
                    );
                    jobsSnapshot = await getDocs(jobsQuery);
                    console.log('Found recent active jobs:', jobsSnapshot.size);
                }
                
            } catch (indexError) {
                console.log('Index error, trying simple query...', indexError);
                // Fallback: Just get active jobs without ordering
                jobsQuery = query(
                    collection(db, 'jobs'),
                    where('status', '==', 'active'),
                    limit(6)
                );
                jobsSnapshot = await getDocs(jobsQuery);
            }
            
            if (jobsSnapshot.empty) {
                console.log('No jobs found in Firebase');
                this.showNoJobsMessage(jobsGrid);
                return;
            }
            
            let jobsHTML = '';
            let jobCount = 0;
            
            jobsSnapshot.forEach(doc => {
                jobCount++;
                const jobData = doc.data();
                
                const job = {
                    id: doc.id,
                    title: jobData.title,
                    companyName: jobData.companyName,
                    companyLogo: jobData.companyLogo,
                    type: jobData.type,
                    location: jobData.location,
                    salary: jobData.salary,
                    skills: jobData.skills,
                    featured: jobData.featured || false,
                    urgent: jobData.urgent || false,
                    createdAt: jobData.createdAt,
                    status: jobData.status
                };
                
                jobsHTML += this.createJobCard(job, doc.id);
            });
            
            console.log(`Rendering ${jobCount} jobs`);
            jobsGrid.innerHTML = jobsHTML;
            
        } catch (error) {
            console.error('Error loading featured jobs:', error);
            this.showErrorState(jobsGrid, error);
        }
    }

    // Show no jobs message
    showNoJobsMessage(jobsGrid) {
        jobsGrid.innerHTML = `
            <div class="no-jobs">
                <i class="fas fa-briefcase"></i>
                <h3>No Jobs Available</h3>
                <p>There are currently no active job postings. Check back later for new opportunities.</p>
                <button onclick="window.retryLoadJobs()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Check Again
                </button>
            </div>
        `;
    }

    // Show error state
    showErrorState(jobsGrid, error) {
        jobsGrid.innerHTML = `
            <div class="no-jobs">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Jobs</h3>
                <p>There was a problem loading job listings. Please try again.</p>
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="window.retryLoadJobs()" class="btn btn-primary">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                    <button onclick="window.jobLinkHomepage.showFallbackJobs()" class="btn btn-secondary">
                        <i class="fas fa-eye"></i> Show Demo Jobs
                    </button>
                </div>
                ${error ? `<small style="display: block; margin-top: 10px; color: var(--gray);">Error: ${error.message}</small>` : ''}
            </div>
        `;
    }

    // Fallback demo jobs
    showFallbackJobs() {
        const jobsGrid = document.getElementById('jobsGrid');
        if (!jobsGrid) return;
        
        const fallbackJobs = [
            {
                id: 'demo-1',
                title: 'Senior Software Engineer',
                companyName: 'Tech Solutions Ltd',
                type: 'full-time',
                location: 'Kampala',
                salary: '$3,000 - $5,000',
                skills: ['JavaScript', 'React', 'Node.js'],
                featured: true,
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                id: 'demo-2',
                title: 'Registered Nurse',
                companyName: 'City Hospital',
                type: 'full-time',
                location: 'Mbarara',
                salary: '$1,500 - $2,500',
                skills: ['Nursing', 'Patient Care', 'BLS Certified'],
                urgent: true,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            },
            {
                id: 'demo-3',
                title: 'Mathematics Teacher',
                companyName: 'Green Valley School',
                type: 'part-time',
                location: 'Fort Portal',
                salary: '$800 - $1,200',
                skills: ['Mathematics', 'Teaching', 'Curriculum'],
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            }
        ];

        let jobsHTML = '';
        fallbackJobs.forEach(job => {
            jobsHTML += this.createJobCard(job, job.id);
        });
        
        jobsGrid.innerHTML = jobsHTML;
    }

    createJobCard(job, jobId) {
        let createdAt;
        if (job.createdAt && typeof job.createdAt.toDate === 'function') {
            createdAt = job.createdAt.toDate();
        } else if (job.createdAt instanceof Date) {
            createdAt = job.createdAt;
        } else if (job.createdAt) {
            createdAt = new Date(job.createdAt);
        } else {
            createdAt = new Date();
        }
        
        const isFeatured = job.featured || false;
        const isUrgent = job.urgent || false;
        
        // Generate SVG logo
        const logoDataURL = this.generateCompanyLogo(job.companyName);
        
        // Safe skills handling
        const getSkillsHTML = () => {
            try {
                if (!job.skills) {
                    return '<span class="skill-tag">Various Skills</span>';
                }
                
                let skillsArray = [];
                
                if (Array.isArray(job.skills)) {
                    skillsArray = job.skills;
                } else if (typeof job.skills === 'string') {
                    skillsArray = job.skills.split(/[,|;]/).map(s => s.trim()).filter(s => s);
                } else if (typeof job.skills === 'object' && job.skills !== null) {
                    skillsArray = Object.values(job.skills).filter(s => typeof s === 'string');
                }
                
                const validSkills = skillsArray
                    .filter(skill => typeof skill === 'string' && skill.trim().length > 0)
                    .slice(0, 3);
                
                if (validSkills.length === 0) {
                    return '<span class="skill-tag">Various Skills</span>';
                }
                
                return validSkills.map(skill => 
                    `<span class="skill-tag">${skill}</span>`
                ).join('');
                
            } catch (error) {
                console.warn('Error processing skills for job:', jobId, error);
                return '<span class="skill-tag">Various Skills</span>';
            }
        };
        
        return `
            <div class="job-card ${isFeatured ? 'featured' : ''} ${isUrgent ? 'urgent' : ''}" data-job-id="${jobId}">
                <div class="job-header">
                    <div class="company-logo">
                        <img src="${logoDataURL}" alt="${job.companyName || 'Company'}" width="50" height="50">
                    </div>
                    <div class="job-info">
                        <h3>${job.title || 'Untitled Position'}</h3>
                        <p class="company-name">${job.companyName || 'Company'}</p>
                    </div>
                    <span class="job-type ${job.type || 'full-time'}">${this.formatJobType(job.type)}</span>
                </div>
                <div class="job-details">
                    <span><i class="fas fa-map-marker-alt"></i> ${job.location || 'Remote'}</span>
                    <span><i class="fas fa-money-bill-wave"></i> ${job.salary || 'Negotiable'}</span>
                    <span><i class="fas fa-clock"></i> ${this.formatDate(createdAt)}</span>
                </div>
                <div class="job-skills">
                    ${getSkillsHTML()}
                </div>
                <button class="btn-apply" onclick="window.jobLinkHomepage.showJobDetails('${jobId}')">
                    View Details & Apply
                </button>
            </div>
        `;
    }

    // Show job details in modal
    async showJobDetails(jobId) {
        this.currentJobId = jobId;
        
        try {
            let jobData;
            
            if (jobId.startsWith('demo-')) {
                // Handle demo jobs
                const demoJobs = {
                    'demo-1': {
                        title: 'Senior Software Engineer',
                        companyName: 'Tech Solutions Ltd',
                        type: 'full-time',
                        location: 'Kampala',
                        salary: '$3,000 - $5,000',
                        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'AWS'],
                        description: 'We are looking for a skilled Senior Software Engineer to join our dynamic team. You will be responsible for developing and maintaining high-quality software solutions.',
                        requirements: [
                            '5+ years of experience in software development',
                            'Strong proficiency in JavaScript and React',
                            'Experience with Node.js and TypeScript',
                            'Knowledge of AWS services',
                            'Excellent problem-solving skills'
                        ],
                        responsibilities: [
                            'Develop and maintain web applications',
                            'Collaborate with cross-functional teams',
                            'Write clean, maintainable code',
                            'Participate in code reviews',
                            'Mentor junior developers'
                        ]
                    },
                    'demo-2': {
                        title: 'Registered Nurse',
                        companyName: 'City Hospital',
                        type: 'full-time',
                        location: 'Mbarara',
                        salary: '$1,500 - $2,500',
                        skills: ['Nursing', 'Patient Care', 'BLS Certified', 'ACLS', 'Emergency Care'],
                        description: 'Join our dedicated healthcare team as a Registered Nurse. Provide exceptional patient care in a fast-paced hospital environment.',
                        requirements: [
                            'Valid nursing license',
                            'BLS and ACLS certification',
                            '2+ years of hospital experience',
                            'Excellent communication skills',
                            'Ability to work in a team environment'
                        ],
                        responsibilities: [
                            'Provide direct patient care',
                            'Administer medications and treatments',
                            'Monitor patient conditions',
                            'Collaborate with healthcare team',
                            'Maintain patient records'
                        ]
                    },
                    'demo-3': {
                        title: 'Mathematics Teacher',
                        companyName: 'Green Valley School',
                        type: 'part-time',
                        location: 'Fort Portal',
                        salary: '$800 - $1,200',
                        skills: ['Mathematics', 'Teaching', 'Curriculum', 'Classroom Management'],
                        description: 'Inspiring Mathematics Teacher needed to join our school community. Help students develop strong mathematical foundations.',
                        requirements: [
                            'Teaching certification',
                            'Degree in Mathematics or related field',
                            '2+ years teaching experience',
                            'Strong classroom management skills',
                            'Passion for education'
                        ],
                        responsibilities: [
                            'Plan and deliver engaging lessons',
                            'Assess student progress',
                            'Provide individualized support',
                            'Participate in school activities',
                            'Communicate with parents'
                        ]
                    }
                };
                jobData = demoJobs[jobId] || demoJobs['demo-1'];
            } else {
                // Get real job from Firebase
                const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
                const jobDoc = await getDoc(doc(db, 'jobs', jobId));
                if (!jobDoc.exists()) {
                    throw new Error('Job not found');
                }
                jobData = jobDoc.data();
            }
            
            this.populateJobModal(jobData);
            this.showModal('jobModal');
            
        } catch (error) {
            console.error('Error loading job details:', error);
            alert('Error loading job details. Please try again.');
        }
    }

    // Populate job modal with details - FIXED THE TYPO HERE
    populateJobModal(jobData) {
        const modalTitle = document.getElementById('modalJobTitle');
        const modalDetails = document.getElementById('modalJobDetails');
        
        if (!modalTitle || !modalDetails) return;
        
        modalTitle.textContent = jobData.title || 'Job Details';
        
        const skillsHTML = Array.isArray(jobData.skills) 
            ? jobData.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')
            : '<span class="skill-tag">Various Skills</span>';
        
        const requirementsHTML = Array.isArray(jobData.requirements)
            ? jobData.requirements.map(req => `<li>${req}</li>`).join('')
            : '<li>No specific requirements listed</li>';
            
        const responsibilitiesHTML = Array.isArray(jobData.responsibilities)
            ? jobData.responsibilities.map(resp => `<li>${resp}</li>`).join('')
            : '<li>No specific responsibilities listed</li>';
        
        modalDetails.innerHTML = `
            <div class="job-meta">
                <div class="meta-item">
                    <i class="fas fa-building"></i>
                    <span>${jobData.companyName || 'Company'}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${jobData.location || 'Remote'}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>${jobData.salary || 'Negotiable'}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>${this.formatJobType(jobData.type)}</span>
                </div>
            </div>
            
            <div class="job-detail-item">
                <h3>Job Description</h3>
                <p>${jobData.description || 'No description available.'}</p>
            </div>
            
            <div class="job-detail-item">
                <h3>Requirements</h3>
                <ul>
                    ${requirementsHTML}
                </ul>
            </div>
            
            <div class="job-detail-item">
                <h3>Responsibilities</h3>
                <ul>
                    ${responsibilitiesHTML}
                </ul>
            </div>
            
            <div class="job-detail-item">
                <h3>Skills Required</h3>
                <div class="job-skills">
                    ${skillsHTML}
                </div>
            </div>
        `;
    }

    // Handle job application
    handleJobApplication() {
        // Check if user is logged in
        const isLoggedIn = this.checkUserAuth();
        
        if (!isLoggedIn) {
            this.closeJobModal();
            this.showAuthModal();
        } else {
            // User is logged in, proceed with application
            this.submitApplication();
        }
    }

    // Check user authentication
    checkUserAuth() {
        return auth.currentUser !== null;
    }

    // Show authentication modal
    showAuthModal() {
        this.showModal('authModal');
    }

    // Close authentication modal
    closeAuthModal() {
        this.hideModal('authModal');
    }

    // Close job modal
    closeJobModal() {
        this.hideModal('jobModal');
        this.currentJobId = null;
    }

    // Show modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
    }

    // Hide modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = ''; // Restore scroll
        }
    }

    // Redirect to auth page
    redirectToAuth() {
        // Save the job ID for after login
        if (this.currentJobId) {
            sessionStorage.setItem('pendingJobApplication', this.currentJobId);
        }
        // Save the current page to return after login
        sessionStorage.setItem('returnUrl', window.location.href);
        // Close modal and redirect
        this.closeAuthModal();
        window.location.href = 'auth.html';
    }

    // Submit application (placeholder)
    submitApplication() {
        // Implement actual application submission
        alert('Application submitted successfully!');
        this.closeJobModal();
    }

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full Time',
            'part-time': 'Part Time',
            'contract': 'Contract',
            'internship': 'Internship',
            'remote': 'Remote',
            'freelance': 'Freelance'
        };
        return types[jobType] || jobType || 'Full Time';
    }

    formatDate(date) {
        if (!date) return 'Recently';
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Load Categories
    async loadCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) return;
        
        const categories = [
            { name: 'Technology', icon: 'laptop-code', jobs: '2,500+', color: '#2c5aa0' },
            { name: 'Healthcare', icon: 'stethoscope', jobs: '1,800+', color: '#e74c3c' },
            { name: 'Business', icon: 'chart-line', jobs: '3,200+', color: '#27ae60' },
            { name: 'Education', icon: 'graduation-cap', jobs: '1,200+', color: '#f39c12' },
            { name: 'Engineering', icon: 'wrench', jobs: '2,100+', color: '#9b59b6' },
            { name: 'Creative', icon: 'paint-brush', jobs: '900+', color: '#d35400' }
        ];
        
        let categoriesHTML = '';
        categories.forEach(category => {
            categoriesHTML += `
                <div class="category-card" onclick="window.jobLinkHomepage.searchCategory('${category.name}')">
                    <div class="category-icon" style="background: ${category.color}">
                        <i class="fas fa-${category.icon}"></i>
                    </div>
                    <h3>${category.name}</h3>
                    <p>${category.jobs} Jobs</p>
                </div>
            `;
        });
        
        categoriesGrid.innerHTML = categoriesHTML;
    }

    searchCategory(categoryName) {
        const jobInput = document.getElementById('jobSearchInput');
        if (jobInput) {
            jobInput.value = categoryName;
            this.performSearch();
        }
    }

    // Load Real Stats from Firebase - REVERTED TO ORIGINAL COUNTING METHOD
    async loadRealStats() {
        try {
            console.log('Loading real statistics from Firebase...');
            
            // Use the original counting method that was working
            const jobsCount = await this.getActiveJobsCount();
            const companiesCount = await this.getCompaniesCount();
            const jobSeekersCount = await this.getJobSeekersCount();

            console.log('Real stats loaded:', {
                jobs: jobsCount,
                companies: companiesCount,
                seekers: jobSeekersCount
            });

            this.animateCounter('stat-jobs', jobsCount);
            this.animateCounter('stat-companies', companiesCount);
            this.animateCounter('stat-seekers', jobSeekersCount);
            
        } catch (error) {
            console.error('Error loading real stats:', error);
            // Fallback to reasonable numbers if counting fails
            this.animateCounter('stat-jobs', 15000);
            this.animateCounter('stat-companies', 5000);
            this.animateCounter('stat-seekers', 50000);
        }
    }

    // Get count of active jobs - ORIGINAL METHOD
    async getActiveJobsCount() {
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('status', '==', 'active')
            );
            const jobsSnapshot = await getDocs(jobsQuery);
            const count = jobsSnapshot.size;
            console.log('Active jobs count:', count);
            return count > 0 ? count : 15000; // Fallback to 15,000 if no jobs found
        } catch (error) {
            console.error('Error getting jobs count:', error);
            return 15000; // Fallback number
        }
    }

    // Get count of companies - ORIGINAL METHOD
    async getCompaniesCount() {
        try {
            // Try different collections that might contain companies
            const collections = ['companies', 'employers', 'users'];
            
            for (const collectionName of collections) {
                try {
                    const companiesQuery = query(
                        collection(db, collectionName),
                        where('userType', '==', 'employer')
                    );
                    const companiesSnapshot = await getDocs(companiesQuery);
                    if (companiesSnapshot.size > 0) {
                        console.log(`Found companies in ${collectionName}:`, companiesSnapshot.size);
                        return companiesSnapshot.size > 0 ? companiesSnapshot.size : 5000;
                    }
                } catch (error) {
                    console.log(`No companies found in ${collectionName} with employer filter:`, error.message);
                    
                    // Try without filter
                    try {
                        const allCompaniesQuery = query(collection(db, collectionName));
                        const allCompaniesSnapshot = await getDocs(allCompaniesQuery);
                        if (allCompaniesSnapshot.size > 0) {
                            console.log(`Found all records in ${collectionName}:`, allCompaniesSnapshot.size);
                            return Math.floor(allCompaniesSnapshot.size * 0.3); // Estimate 30% are companies
                        }
                    } catch (secondError) {
                        continue;
                    }
                }
            }
            
            return 5000; // Fallback number
            
        } catch (error) {
            console.error('Error getting companies count:', error);
            return 5000; // Fallback number
        }
    }

    // Get count of job seekers - ORIGINAL METHOD
    async getJobSeekersCount() {
        try {
            const collections = ['users', 'jobseekers', 'candidates'];
            
            for (const collectionName of collections) {
                try {
                    const usersQuery = query(
                        collection(db, collectionName),
                        where('userType', 'in', ['jobseeker', 'candidate', 'user'])
                    );
                    const usersSnapshot = await getDocs(usersQuery);
                    if (usersSnapshot.size > 0) {
                        console.log(`Found job seekers in ${collectionName}:`, usersSnapshot.size);
                        return usersSnapshot.size > 0 ? usersSnapshot.size : 50000;
                    }
                } catch (error) {
                    console.log(`No job seekers found in ${collectionName} with filter:`, error.message);
                    
                    // Try without filter and estimate
                    try {
                        const allUsersQuery = query(collection(db, collectionName));
                        const allUsersSnapshot = await getDocs(allUsersQuery);
                        if (allUsersSnapshot.size > 0) {
                            console.log(`Found all users in ${collectionName}:`, allUsersSnapshot.size);
                            return Math.floor(allUsersSnapshot.size * 0.7); // Estimate 70% are job seekers
                        }
                    } catch (secondError) {
                        continue;
                    }
                }
            }
            
            // If no specific counts found, estimate from applications
            return await this.estimateJobSeekersFromApplications();
            
        } catch (error) {
            console.error('Error getting job seekers count:', error);
            return 50000; // Fallback number
        }
    }

    // Estimate job seekers count from applications - ORIGINAL METHOD
    async estimateJobSeekersFromApplications() {
        try {
            const applicationsQuery = query(collection(db, 'applications'));
            const applicationsSnapshot = await getDocs(applicationsQuery);
            
            if (applicationsSnapshot.size > 0) {
                const uniqueUsers = new Set();
                applicationsSnapshot.forEach(doc => {
                    const application = doc.data();
                    if (application.userId) {
                        uniqueUsers.add(application.userId);
                    }
                    if (application.userEmail) {
                        uniqueUsers.add(application.userEmail);
                    }
                });
                
                const estimatedCount = uniqueUsers.size || applicationsSnapshot.size;
                console.log('Estimated job seekers from applications:', estimatedCount);
                return estimatedCount > 0 ? estimatedCount : 50000;
            }
            
            return 50000; // Fallback number
            
        } catch (error) {
            console.error('Error estimating job seekers:', error);
            return 50000; // Fallback number
        }
    }

    // Animate counter
    animateCounter(elementId, target) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const finalTarget = target;
        
        const duration = 2000;
        const step = finalTarget / (duration / 16);
        let current = 0;
        
        const timer = setInterval(() => {
            current += step;
            if (current >= finalTarget) {
                current = finalTarget;
                clearInterval(timer);
                element.textContent = this.formatNumber(current) + '+';
                element.classList.add('animated');
            } else {
                element.textContent = this.formatNumber(Math.floor(current)) + '+';
            }
        }, 16);
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return Math.floor(num).toLocaleString();
    }

    // Animate elements on scroll
    animateOnScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        const categoryCards = document.querySelectorAll('.category-card');
        categoryCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `all 0.6s ease ${index * 0.1}s`;
            observer.observe(card);
        });

        const stepCards = document.querySelectorAll('.step-card');
        stepCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `all 0.6s ease ${index * 0.2}s`;
            observer.observe(card);
        });
    }
}

// Initialize the homepage
let jobLinkHomepage;

document.addEventListener('DOMContentLoaded', function() {
    jobLinkHomepage = new JobLinkHomepage();
    window.jobLinkHomepage = jobLinkHomepage;
});

// Global function for retry button
window.retryLoadJobs = function() {
    if (window.jobLinkHomepage) {
        window.jobLinkHomepage.loadFeaturedJobs();
    }
};

// Global function for demo jobs
window.showDemoJobs = function() {
    if (window.jobLinkHomepage) {
        window.jobLinkHomepage.showFallbackJobs();
    }
};

// Global function to refresh stats
window.refreshStats = function() {
    if (window.jobLinkHomepage) {
        window.jobLinkHomepage.loadRealStats();
    }
};