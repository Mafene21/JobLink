// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    startAfter
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNXjUFXeeVhyHMBuhBiMv-YYcVrBdCRS8",
    authDomain: "joblink-babb6.firebaseapp.com",
    projectId: "joblink-babb6",
    storageBucket: "joblink-babb6.firebasestorage.app",
    messagingSenderId: "442169381701",
    appId: "1:442169381701:web:d8ec90c72aab424d2d242c",
    measurementId: "G-Z0737HMGCQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class JobsPage {
    constructor() {
        this.currentJobId = null;
        this.allJobs = [];
        this.filteredJobs = [];
        this.currentFilters = {
            jobType: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
            location: ['Kampala', 'Entebbe', 'Jinja', 'Mbarara', 'Remote']
        };
        this.searchQuery = '';
        this.sortBy = 'newest';
        this.lastVisible = null;
        this.hasMoreJobs = true;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAllJobs();
        this.applySavedSearch();
    }

    bindEvents() {
        // Mobile navigation
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }
        
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar') && navMenu?.classList.contains('active')) {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            }
        });

        // Filter events
        this.bindFilterEvents();
        
        // Search events
        this.bindSearchEvents();
        
        // Sort events
        this.bindSortEvents();
        
        // Load more events
        this.bindLoadMoreEvents();
        
        // Modal events
        this.bindModalEvents();
    }

    bindFilterEvents() {
        // Job type filters
        document.querySelectorAll('input[name="jobType"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Location filters
        document.querySelectorAll('input[name="location"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Salary filter
        const salaryRange = document.getElementById('salaryRange');
        if (salaryRange) {
            salaryRange.addEventListener('change', () => this.applyFilters());
        }

        // Clear filters
        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
    }

    bindSearchEvents() {
        const searchInput = document.getElementById('jobsSearchInput');
        const searchButton = document.getElementById('jobsSearchButton');

        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.searchQuery = searchInput.value.trim();
                this.applyFilters();
            }, 300));

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchQuery = searchInput.value.trim();
                    this.applyFilters();
                }
            });
        }

        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.searchQuery = searchInput?.value.trim() || '';
                this.applyFilters();
            });
        }
    }

    bindSortEvents() {
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
            });
        }
    }

    bindLoadMoreEvents() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreJobs());
        }
    }

    bindModalEvents() {
        const jobModal = document.getElementById('jobModal');
        const authModal = document.getElementById('authModal');
        const modalClose = document.getElementById('modalClose');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeJobModal());
        }

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

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeJobModal();
                this.closeAuthModal();
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async loadAllJobs() {
        const jobsGrid = document.getElementById('jobsGrid');
        if (!jobsGrid) return;
        
        try {
            jobsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading jobs...</p>
                </div>
            `;

            let jobsQuery;
            
            try {
                jobsQuery = query(
                    collection(db, 'jobs'),
                    where('status', '==', 'active'),
                    orderBy('createdAt', 'desc'),
                    limit(12)
                );
            } catch (error) {
                jobsQuery = query(
                    collection(db, 'jobs'),
                    where('status', '==', 'active'),
                    limit(12)
                );
            }
            
            const jobsSnapshot = await getDocs(jobsQuery);
            
            if (jobsSnapshot.empty) {
                this.showNoJobsMessage();
                return;
            }
            
            this.lastVisible = jobsSnapshot.docs[jobsSnapshot.docs.length - 1];
            this.hasMoreJobs = jobsSnapshot.docs.length === 12;
            
            this.allJobs = [];
            jobsSnapshot.forEach(doc => {
                const jobData = doc.data();
                this.allJobs.push({
                    id: doc.id,
                    ...jobData
                });
            });
            
            this.applyFilters();
            
        } catch (error) {
            console.error('Error loading jobs:', error);
            this.showErrorState(error);
        }
    }

    async loadMoreJobs() {
        if (this.isLoading || !this.hasMoreJobs) return;
        
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const spinner = loadMoreBtn?.querySelector('.fa-spinner');
        const text = loadMoreBtn?.querySelector('span');
        
        if (loadMoreBtn && spinner && text) {
            this.isLoading = true;
            loadMoreBtn.disabled = true;
            spinner.style.display = 'inline-block';
            text.textContent = 'Loading...';
        }
        
        try {
            let jobsQuery;
            
            try {
                jobsQuery = query(
                    collection(db, 'jobs'),
                    where('status', '==', 'active'),
                    orderBy('createdAt', 'desc'),
                    startAfter(this.lastVisible),
                    limit(12)
                );
            } catch (error) {
                this.hasMoreJobs = false;
                return;
            }
            
            const jobsSnapshot = await getDocs(jobsQuery);
            
            if (jobsSnapshot.empty) {
                this.hasMoreJobs = false;
                return;
            }
            
            this.lastVisible = jobsSnapshot.docs[jobsSnapshot.docs.length - 1];
            this.hasMoreJobs = jobsSnapshot.docs.length === 12;
            
            const newJobs = [];
            jobsSnapshot.forEach(doc => {
                const jobData = doc.data();
                newJobs.push({
                    id: doc.id,
                    ...jobData
                });
            });
            
            this.allJobs = [...this.allJobs, ...newJobs];
            this.applyFilters();
            
        } catch (error) {
            console.error('Error loading more jobs:', error);
            this.hasMoreJobs = false;
        } finally {
            this.isLoading = false;
            if (loadMoreBtn && spinner && text) {
                loadMoreBtn.disabled = false;
                spinner.style.display = 'none';
                text.textContent = 'Load More Jobs';
                
                if (!this.hasMoreJobs) {
                    loadMoreBtn.style.display = 'none';
                }
            }
        }
    }

    applyFilters() {
        this.updateCurrentFilters();
        
        let filtered = [...this.allJobs];
        
        // Apply search query
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(job => 
                job.title?.toLowerCase().includes(query) ||
                job.companyName?.toLowerCase().includes(query) ||
                job.skills?.some(skill => skill.toLowerCase().includes(query)) ||
                job.description?.toLowerCase().includes(query)
            );
        }
        
        // Apply job type filters
        if (this.currentFilters.jobType.length > 0) {
            filtered = filtered.filter(job => 
                this.currentFilters.jobType.includes(job.type)
            );
        }
        
        // Apply location filters
        if (this.currentFilters.location.length > 0) {
            filtered = filtered.filter(job => 
                this.currentFilters.location.some(loc => 
                    job.location?.toLowerCase().includes(loc.toLowerCase())
                )
            );
        }
        
        // Apply salary filter
        const salaryRange = document.getElementById('salaryRange');
        if (salaryRange && salaryRange.value !== 'any') {
            filtered = filtered.filter(job => {
                const salary = this.extractSalaryNumber(job.salary);
                const range = salaryRange.value;
                
                if (range === '0-1000') return salary >= 0 && salary <= 1000;
                if (range === '1000-3000') return salary >= 1000 && salary <= 3000;
                if (range === '3000-5000') return salary >= 3000 && salary <= 5000;
                if (range === '5000+') return salary >= 5000;
                
                return true;
            });
        }
        
        // Apply sorting
        filtered = this.sortJobs(filtered);
        
        this.filteredJobs = filtered;
        this.displayJobs();
    }

    updateCurrentFilters() {
        // Job types
        this.currentFilters.jobType = Array.from(document.querySelectorAll('input[name="jobType"]:checked'))
            .map(checkbox => checkbox.value);
        
        // Locations
        this.currentFilters.location = Array.from(document.querySelectorAll('input[name="location"]:checked'))
            .map(checkbox => checkbox.value);
    }

    extractSalaryNumber(salaryString) {
        if (!salaryString) return 0;
        
        // Extract numbers from strings like "$3,000 - $5,000" or "Negotiable"
        const matches = salaryString.match(/\$?([0-9,]+)/);
        if (matches && matches[1]) {
            return parseInt(matches[1].replace(/,/g, ''));
        }
        
        return 0;
    }

    sortJobs(jobs) {
        switch (this.sortBy) {
            case 'newest':
                return jobs.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                
            case 'oldest':
                return jobs.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dateA - dateB;
                });
                
            case 'salary-high':
                return jobs.sort((a, b) => {
                    const salaryA = this.extractSalaryNumber(a.salary);
                    const salaryB = this.extractSalaryNumber(b.salary);
                    return salaryB - salaryA;
                });
                
            case 'salary-low':
                return jobs.sort((a, b) => {
                    const salaryA = this.extractSalaryNumber(a.salary);
                    const salaryB = this.extractSalaryNumber(b.salary);
                    return salaryA - salaryB;
                });
                
            default:
                return jobs;
        }
    }

    displayJobs() {
        const jobsGrid = document.getElementById('jobsGrid');
        const jobsCount = document.getElementById('jobsCount');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (!jobsGrid) return;
        
        if (this.filteredJobs.length === 0) {
            this.showNoJobsMessage();
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            if (jobsCount) jobsCount.textContent = 'No jobs found';
            return;
        }
        
        if (jobsCount) {
            jobsCount.textContent = `${this.filteredJobs.length} job${this.filteredJobs.length !== 1 ? 's' : ''} found`;
        }
        
        let jobsHTML = '';
        this.filteredJobs.forEach(job => {
            jobsHTML += this.createJobCard(job);
        });
        
        jobsGrid.innerHTML = jobsHTML;
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.hasMoreJobs ? 'block' : 'none';
        }
    }

    createJobCard(job) {
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
                console.warn('Error processing skills for job:', job.id, error);
                return '<span class="skill-tag">Various Skills</span>';
            }
        };
        
        return `
            <div class="job-card ${isFeatured ? 'featured' : ''} ${isUrgent ? 'urgent' : ''}" data-job-id="${job.id}">
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
                <button class="btn-apply" onclick="window.jobsPage.showJobDetails('${job.id}')">
                    View Details & Apply
                </button>
            </div>
        `;
    }

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
        
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    }

    showNoJobsMessage() {
        const jobsGrid = document.getElementById('jobsGrid');
        if (!jobsGrid) return;
        
        jobsGrid.innerHTML = `
            <div class="no-jobs-state">
                <i class="fas fa-search"></i>
                <h3>No Jobs Found</h3>
                <p>We couldn't find any jobs matching your criteria. Try adjusting your filters or search terms.</p>
                <button onclick="window.jobsPage.clearFilters()" class="btn btn-primary">
                    Clear All Filters
                </button>
            </div>
        `;
    }

    showErrorState(error) {
        const jobsGrid = document.getElementById('jobsGrid');
        if (!jobsGrid) return;
        
        jobsGrid.innerHTML = `
            <div class="no-jobs-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Jobs</h3>
                <p>There was a problem loading job listings. Please try again.</p>
                <button onclick="window.jobsPage.loadAllJobs()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }

    clearFilters() {
        // Reset checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        // Reset salary dropdown
        const salaryRange = document.getElementById('salaryRange');
        if (salaryRange) salaryRange.value = 'any';
        
        // Reset search
        const searchInput = document.getElementById('jobsSearchInput');
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        
        // Reset sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = 'newest';
        this.sortBy = 'newest';
        
        this.applyFilters();
    }

    applySavedSearch() {
        const savedSearch = sessionStorage.getItem('lastSearch');
        if (savedSearch) {
            try {
                const searchData = JSON.parse(savedSearch);
                const searchInput = document.getElementById('jobsSearchInput');
                
                if (searchData.query && searchInput) {
                    searchInput.value = searchData.query;
                    this.searchQuery = searchData.query;
                }
                
                sessionStorage.removeItem('lastSearch');
                
            } catch (error) {
                console.error('Error applying saved search:', error);
            }
        }
    }

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

    handleJobApplication() {
        const isLoggedIn = this.checkUserAuth();
        
        if (!isLoggedIn) {
            this.closeJobModal();
            this.showAuthModal();
        } else {
            this.submitApplication();
        }
    }

    checkUserAuth() {
        // This should check your actual authentication state
        // For now, return false to demonstrate the auth flow
        return false;
    }

    showAuthModal() {
        this.showModal('authModal');
    }

    closeAuthModal() {
        this.hideModal('authModal');
    }

    closeJobModal() {
        this.hideModal('jobModal');
        this.currentJobId = null;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    redirectToLogin() {
        if (this.currentJobId) {
            sessionStorage.setItem('pendingJobApplication', this.currentJobId);
        }
        window.location.href = 'login.html';
    }

    redirectToRegister() {
        if (this.currentJobId) {
            sessionStorage.setItem('pendingJobApplication', this.currentJobId);
        }
        window.location.href = 'register.html';
    }

    submitApplication() {
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
}

// Initialize the jobs page
let jobsPage;

document.addEventListener('DOMContentLoaded', function() {
    jobsPage = new JobsPage();
    window.jobsPage = jobsPage;
});