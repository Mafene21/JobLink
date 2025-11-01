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

class JobLinkHomepage {
    constructor() {
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
                <button class="btn-apply" onclick="window.jobLinkHomepage.viewJob('${jobId}')">
                    Apply Now
                </button>
            </div>
        `;
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

    viewJob(jobId) {
        if (jobId.startsWith('demo-')) {
            alert('This is a demo job. In a real application, you would be redirected to the job details page.');
            return;
        }
        window.location.href = `job-details.html?id=${jobId}`;
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

    // Load Real Stats from Firebase
    async loadRealStats() {
        try {
            console.log('Loading real statistics from Firebase...');
            
            const [jobsCount, companiesCount, jobSeekersCount] = await Promise.all([
                this.getActiveJobsCount(),
                this.getCompaniesCount(),
                this.getJobSeekersCount()
            ]);

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
            this.animateCounter('stat-jobs', 42);
            this.animateCounter('stat-companies', 15);
            this.animateCounter('stat-seekers', 125);
        }
    }

    // Get count of active jobs
    async getActiveJobsCount() {
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('status', '==', 'active')
            );
            const jobsSnapshot = await getDocs(jobsQuery);
            return jobsSnapshot.size;
        } catch (error) {
            console.error('Error getting jobs count:', error);
            return 42;
        }
    }

    // Get count of companies
    async getCompaniesCount() {
        try {
            const collections = ['companies', 'employers', 'users'];
            
            for (const collectionName of collections) {
                try {
                    const companiesQuery = query(collection(db, collectionName));
                    const companiesSnapshot = await getDocs(companiesQuery);
                    if (companiesSnapshot.size > 0) {
                        console.log(`Found companies in ${collectionName}:`, companiesSnapshot.size);
                        return companiesSnapshot.size;
                    }
                } catch (error) {
                    console.log(`No companies found in ${collectionName}:`, error.message);
                    continue;
                }
            }
            
            return 15;
            
        } catch (error) {
            console.error('Error getting companies count:', error);
            return 15;
        }
    }

    // Get count of job seekers
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
                        return usersSnapshot.size;
                    }
                } catch (error) {
                    console.log(`No job seekers found in ${collectionName}:`, error.message);
                    
                    try {
                        const allUsersQuery = query(collection(db, collectionName));
                        const allUsersSnapshot = await getDocs(allUsersQuery);
                        if (allUsersSnapshot.size > 0) {
                            console.log(`Found all users in ${collectionName}:`, allUsersSnapshot.size);
                            return Math.floor(allUsersSnapshot.size * 0.8);
                        }
                    } catch (secondError) {
                        continue;
                    }
                }
            }
            
            return await this.estimateJobSeekersFromApplications();
            
        } catch (error) {
            console.error('Error getting job seekers count:', error);
            return 125;
        }
    }

    // Estimate job seekers count from applications
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
                return estimatedCount;
            }
            
            return 125;
            
        } catch (error) {
            console.error('Error estimating job seekers:', error);
            return 125;
        }
    }

    // Animate counter
    animateCounter(elementId, target) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const finalTarget = target === 0 ? 5 : target;
        
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