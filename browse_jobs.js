// Browse Jobs JavaScript with Firebase Integration
class BrowseJobs {
    constructor() {
        this.jobs = [];
        this.filteredJobs = [];
        this.currentPage = 1;
        this.jobsPerPage = 10;
        this.filters = {
            search: '',
            category: '',
            jobType: '',
            location: '',
            salary: ''
        };
        this.sortBy = 'newest';
        this.firebaseInitialized = false;
        this.currentUser = null;
        this.currentJobApplication = null;
        this.init();
    }

    async init() {
        await this.initializeFirebase();
        await this.initializeAuth();
        this.bindEvents();
        await this.loadJobs();
    }

    initializeFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyCNXjUFXeeVhyHMBuhBiMv-YYcVrBdCRS8",
            authDomain: "joblink-babb6.firebaseapp.com",
            projectId: "joblink-babb6",
            storageBucket: "joblink-babb6.firebasestorage.app",
            messagingSenderId: "442169381701",
            appId: "1:442169381701:web:d8ec90c72aab424d2d242c",
            measurementId: "G-Z0737HMGCQ"
        };

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.firebaseInitialized = true;
            console.log("Firebase initialized successfully");
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.firebaseInitialized = false;
            this.showToast('Failed to initialize Firebase. Please refresh the page.', 'error');
        }
    }

    async initializeAuth() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    console.log("User authenticated:", user.uid);
                } else {
                    console.log("No user authenticated - some features may be limited");
                }
                resolve();
            });
        });
    }

    bindEvents() {
        // Mobile navigation
        const hamburger = document.querySelector('.hamburger');
        const mobileNav = document.getElementById('mobileNav');
        const overlay = document.getElementById('overlay');
        
        hamburger.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
        });
        
        overlay.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        // Mobile logout
        document.getElementById('mobileLogoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.handleSearch();
        });

        document.getElementById('jobSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Real-time search
        document.getElementById('jobSearch').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Filter changes
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });

        document.getElementById('jobTypeFilter').addEventListener('change', (e) => {
            this.filters.jobType = e.target.value;
            this.applyFilters();
        });

        document.getElementById('locationFilter').addEventListener('change', (e) => {
            this.filters.location = e.target.value;
            this.applyFilters();
        });

        document.getElementById('salaryFilter').addEventListener('change', (e) => {
            this.filters.salary = e.target.value;
            this.applyFilters();
        });

        // Reset filters
        document.getElementById('resetFilters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Sort options
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.sortJobs();
            this.renderJobs();
        });

        // Empty state actions
        document.getElementById('refreshJobs').addEventListener('click', () => {
            this.refreshJobs();
        });

        document.getElementById('setupAlerts').addEventListener('click', () => {
            this.showAlertsModal();
        });

        // Load more jobs
        document.getElementById('loadMoreJobs').addEventListener('click', () => {
            this.loadMoreJobs();
        });

        // Alert modal
        document.getElementById('closeAlertsModal').addEventListener('click', () => {
            this.hideAlertsModal();
        });

        document.getElementById('cancelAlert').addEventListener('click', () => {
            this.hideAlertsModal();
        });

        document.getElementById('saveAlert').addEventListener('click', () => {
            this.saveJobAlert();
        });

        // Job modal
        document.getElementById('closeJobModal').addEventListener('click', () => {
            this.hideJobModal();
        });

        document.getElementById('saveJobBtn').addEventListener('click', () => {
            this.saveJob();
        });

        document.getElementById('applyJobBtn').addEventListener('click', () => {
            this.showApplicationModal();
        });

        // Application modal
        document.getElementById('closeApplicationModal').addEventListener('click', () => {
            this.hideApplicationModal();
        });

        document.getElementById('cancelApplication').addEventListener('click', () => {
            this.hideApplicationModal();
        });

        document.getElementById('submitApplication').addEventListener('click', () => {
            this.submitApplication();
        });

        // Cover letter character count
        document.getElementById('applicationMessage').addEventListener('input', (e) => {
            document.getElementById('coverLetterChars').textContent = e.target.value.length;
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Close modals on outside click
        document.getElementById('alertsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('alertsModal')) {
                this.hideAlertsModal();
            }
        });

        document.getElementById('jobModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('jobModal')) {
                this.hideJobModal();
            }
        });

        document.getElementById('applicationModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('applicationModal')) {
                this.hideApplicationModal();
            }
        });
    }

    async loadJobs() {
        if (!this.firebaseInitialized) {
            this.showEmptyState();
            return;
        }

        try {
            this.showLoadingState();
            
            const db = firebase.firestore();
            console.log('🔍 Loading jobs from Firebase...');
            
            // Try to get ALL documents from the jobs collection
            let jobsSnapshot;
            try {
                // First, let's just get everything without any filters
                jobsSnapshot = await db.collection('jobs').get();
                console.log('✅ Successfully fetched jobs collection');
            } catch (error) {
                console.error('❌ Error fetching jobs:', error);
                this.showToast('Error connecting to database', 'error');
                this.showEmptyState();
                return;
            }

            this.jobs = [];
            
            if (jobsSnapshot.empty) {
                console.log('📭 Jobs collection is empty');
                this.showEmptyState();
                this.showToast('No jobs found in the database', 'info');
                return;
            }

            console.log(`📊 Found ${jobsSnapshot.size} documents in jobs collection`);
            
            jobsSnapshot.forEach(doc => {
                const jobData = doc.data();
                console.log(`📄 Processing job document ${doc.id}:`, jobData);
                
                // Create a normalized job object with fallbacks
                const job = {
                    id: doc.id,
                    // Handle title with multiple possible field names
                    title: jobData.title || jobData.jobTitle || jobData.position || 'Untitled Position',
                    // Handle company with multiple possible field names
                    company: jobData.company || jobData.companyName || jobData.employer || 'Unknown Company',
                    // Handle location
                    location: jobData.location || jobData.jobLocation || 'Not specified',
                    // Handle job type
                    jobType: jobData.jobType || jobData.type || jobData.employmentType || 'full-time',
                    // Handle category
                    category: jobData.category || jobData.industry || jobData.field || 'other',
                    // Handle description
                    description: jobData.description || jobData.jobDescription || jobData.details || 'No description available.',
                    // Handle salary
                    salary: jobData.salary || jobData.salaryAmount || jobData.pay || 0,
                    salaryType: jobData.salaryType || jobData.payFrequency || 'monthly',
                    // Handle required skills
                    requiredSkills: jobData.requiredSkills || jobData.skills || jobData.qualifications || [],
                    // Handle experience level
                    experienceLevel: jobData.experienceLevel || jobData.experience || jobData.requiredExperience || 'Not specified',
                    // Handle status
                    status: jobData.status || 'active',
                    // Handle urgent flag
                    urgent: jobData.urgent || jobData.hiringUrgently || false,
                    // Handle contact email
                    contactEmail: jobData.contactEmail || jobData.email || jobData.applicationEmail || null,
                    // Handle employer ID
                    employerId: jobData.employerId || jobData.postedBy || 'unknown'
                };

                // Handle dates - try multiple possible field names
                if (jobData.postedDate && jobData.postedDate.toDate) {
                    job.postedDate = jobData.postedDate.toDate();
                } else if (jobData.createdAt && jobData.createdAt.toDate) {
                    job.postedDate = jobData.createdAt.toDate();
                } else if (jobData.timestamp && jobData.timestamp.toDate) {
                    job.postedDate = jobData.timestamp.toDate();
                } else if (jobData.datePosted && jobData.datePosted.toDate) {
                    job.postedDate = jobData.datePosted.toDate();
                } else {
                    job.postedDate = new Date(jobData.postedDate || jobData.createdAt || jobData.timestamp || Date.now());
                }

                // Handle deadline
                if (jobData.deadline && jobData.deadline.toDate) {
                    job.deadline = jobData.deadline.toDate();
                } else if (jobData.applicationDeadline && jobData.applicationDeadline.toDate) {
                    job.deadline = jobData.applicationDeadline.toDate();
                } else if (jobData.closingDate && jobData.closingDate.toDate) {
                    job.deadline = jobData.closingDate.toDate();
                } else {
                    job.deadline = jobData.deadline ? new Date(jobData.deadline) : null;
                }

                // Handle arrays that might be stored as strings
                if (typeof job.requiredSkills === 'string') {
                    job.requiredSkills = job.requiredSkills.split(',').map(skill => skill.trim());
                }

                // Handle requirements
                if (jobData.requirements) {
                    if (Array.isArray(jobData.requirements)) {
                        job.requirements = jobData.requirements;
                    } else if (typeof jobData.requirements === 'string') {
                        job.requirements = jobData.requirements.split('\n').filter(req => req.trim());
                    }
                } else {
                    job.requirements = ['No specific requirements listed'];
                }

                // Handle responsibilities
                if (jobData.responsibilities) {
                    if (Array.isArray(jobData.responsibilities)) {
                        job.responsibilities = jobData.responsibilities;
                    } else if (typeof jobData.responsibilities === 'string') {
                        job.responsibilities = jobData.responsibilities.split('\n').filter(resp => resp.trim());
                    }
                } else {
                    job.responsibilities = ['No specific responsibilities listed'];
                }

                // Handle benefits
                if (jobData.benefits) {
                    if (Array.isArray(jobData.benefits)) {
                        job.benefits = jobData.benefits;
                    } else if (typeof jobData.benefits === 'string') {
                        job.benefits = jobData.benefits.split('\n').filter(benefit => benefit.trim());
                    }
                }

                console.log(`✅ Processed job: ${job.title} at ${job.company}`);
                this.jobs.push(job);
            });

            console.log(`🎉 Successfully loaded ${this.jobs.length} jobs from Firebase`);
            console.log('Sample job:', this.jobs[0]);

            if (this.jobs.length === 0) {
                this.showEmptyState();
                this.showToast('No jobs found in the database.', 'info');
            } else {
                this.applyFilters();
                this.showToast(`Loaded ${this.jobs.length} jobs successfully`, 'success');
            }
            
        } catch (error) {
            console.error('💥 Error loading jobs:', error);
            this.showToast('Error loading jobs. Please check console for details.', 'error');
            this.showEmptyState();
        }
    }

    handleSearch() {
        const searchTerm = document.getElementById('jobSearch').value.trim();
        this.filters.search = searchTerm.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        this.currentPage = 1; // Reset to first page when filters change
        
        if (this.jobs.length === 0) {
            this.showEmptyState();
            return;
        }

        console.log(`🔍 Applying filters to ${this.jobs.length} jobs`);
        
        this.filteredJobs = this.jobs.filter(job => {
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const matchesSearch = 
                    (job.title && job.title.toLowerCase().includes(searchTerm)) ||
                    (job.company && job.company.toLowerCase().includes(searchTerm)) ||
                    (job.description && job.description.toLowerCase().includes(searchTerm)) ||
                    (job.category && job.category.toLowerCase().includes(searchTerm)) ||
                    (job.requiredSkills && job.requiredSkills.some(skill => 
                        skill.toLowerCase().includes(searchTerm))) ||
                    (job.location && job.location.toLowerCase().includes(searchTerm));

                if (!matchesSearch) {
                    console.log(`❌ Job "${job.title}" filtered out by search`);
                    return false;
                }
            }

            // Category filter
            if (this.filters.category && job.category !== this.filters.category) {
                return false;
            }

            // Job type filter
            if (this.filters.jobType && job.jobType !== this.filters.jobType) {
                return false;
            }

            // Location filter
            if (this.filters.location) {
                if (this.filters.location === 'remote' && job.location.toLowerCase().includes('remote')) {
                    // Allow remote jobs
                } else if (job.location !== this.filters.location) {
                    return false;
                }
            }

            // Salary filter
            if (this.filters.salary) {
                const salaryRange = this.filters.salary;
                const jobSalary = job.salary || 0;

                if (salaryRange === '0-500000' && jobSalary > 500000) return false;
                if (salaryRange === '500000-1000000' && (jobSalary < 500000 || jobSalary > 1000000)) return false;
                if (salaryRange === '1000000-2000000' && (jobSalary < 1000000 || jobSalary > 2000000)) return false;
                if (salaryRange === '2000000-5000000' && (jobSalary < 2000000 || jobSalary > 5000000)) return false;
                if (salaryRange === '5000000+' && jobSalary < 5000000) return false;
            }

            console.log(`✅ Job "${job.title}" passed all filters`);
            return true;
        });

        console.log(`📊 After filtering: ${this.filteredJobs.length} jobs remain`);
        this.sortJobs();
        this.renderJobs();
    }

    sortJobs() {
        if (this.filteredJobs.length === 0) return;

        console.log(`🔄 Sorting ${this.filteredJobs.length} jobs by ${this.sortBy}`);
        
        switch (this.sortBy) {
            case 'newest':
                this.filteredJobs.sort((a, b) => b.postedDate - a.postedDate);
                break;
            case 'salary-high':
                this.filteredJobs.sort((a, b) => (b.salary || 0) - (a.salary || 0));
                break;
            case 'salary-low':
                this.filteredJobs.sort((a, b) => (a.salary || 0) - (b.salary || 0));
                break;
            case 'deadline':
                this.filteredJobs.sort((a, b) => {
                    const deadlineA = a.deadline || new Date('9999-12-31');
                    const deadlineB = b.deadline || new Date('9999-12-31');
                    return deadlineA - deadlineB;
                });
                break;
        }
    }

    resetFilters() {
        document.getElementById('jobSearch').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('jobTypeFilter').value = '';
        document.getElementById('locationFilter').value = '';
        document.getElementById('salaryFilter').value = '';
        document.getElementById('sortBy').value = 'newest';

        this.filters = {
            search: '',
            category: '',
            jobType: '',
            location: '',
            salary: ''
        };
        this.sortBy = 'newest';
        this.currentPage = 1;

        this.applyFilters();
        this.showToast('Filters reset successfully', 'info');
    }

    refreshJobs() {
        this.showLoadingState();
        this.loadJobs();
    }

    loadMoreJobs() {
        this.currentPage++;
        this.renderJobs();
        this.showToast(`Loaded more jobs`, 'info');
    }

    showEmptyState() {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('jobsGrid').style.display = 'none';
        document.getElementById('loadingState').style.display = 'none';
    }

    showJobsGrid() {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('jobsGrid').style.display = 'block';
        document.getElementById('loadingState').style.display = 'none';
    }

    showLoadingState() {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('jobsGrid').style.display = 'none';
        document.getElementById('loadingState').style.display = 'block';
    }

    renderJobs() {
        const jobsList = document.getElementById('jobsList');
        const jobsCount = document.getElementById('jobsCount');
        const loadMoreBtn = document.getElementById('loadMoreJobs');
        
        jobsCount.textContent = this.filteredJobs.length;
        
        if (this.filteredJobs.length === 0) {
            console.log('📭 No jobs to display after filtering');
            this.showEmptyState();
            loadMoreBtn.style.display = 'none';
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.jobsPerPage;
        const endIndex = startIndex + this.jobsPerPage;
        const jobsToShow = this.filteredJobs.slice(0, endIndex); // Show all up to current page

        console.log(`🎨 Rendering ${jobsToShow.length} jobs`);
        
        jobsList.innerHTML = jobsToShow.map(job => `
            <div class="job-card" data-job-id="${job.id}">
                <div class="job-header">
                    <div class="job-info">
                        <h3 class="job-title">${job.title}</h3>
                        <p class="job-company">${job.company}</p>
                        <div class="job-meta">
                            <div class="job-meta-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${job.location}</span>
                            </div>
                            <div class="job-meta-item">
                                <i class="fas fa-clock"></i>
                                <span>${this.formatJobType(job.jobType)}</span>
                            </div>
                            <div class="job-meta-item">
                                <i class="fas fa-tag"></i>
                                <span>${this.formatCategory(job.category)}</span>
                            </div>
                            ${job.urgent ? `
                            <div class="job-meta-item">
                                <span class="urgent-badge">
                                    <i class="fas fa-exclamation-circle"></i>
                                    Urgent
                                </span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="job-salary">
                        <div class="salary-amount">${this.formatSalary(job.salary)}</div>
                        <div class="salary-type">${job.salaryType || 'monthly'}</div>
                    </div>
                </div>
                
                <p class="job-description">${job.description.substring(0, 200)}${job.description.length > 200 ? '...' : ''}</p>
                
                ${job.requiredSkills && job.requiredSkills.length > 0 ? `
                <div class="job-skills">
                    ${job.requiredSkills.slice(0, 5).map(skill => 
                        `<span class="skill-tag">${skill}</span>`
                    ).join('')}
                    ${job.requiredSkills.length > 5 ? 
                        `<span class="skill-tag">+${job.requiredSkills.length - 5} more</span>` : ''
                    }
                </div>
                ` : ''}
                
                <div class="job-actions">
                    <button class="btn btn-primary btn-sm view-details" data-job-id="${job.id}">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-outline btn-sm save-job" data-job-id="${job.id}">
                        <i class="fas fa-bookmark"></i>
                        Save
                    </button>
                    <button class="btn btn-secondary btn-sm quick-apply" data-job-id="${job.id}">
                        <i class="fas fa-paper-plane"></i>
                        Quick Apply
                    </button>
                </div>
                
                <div class="job-posted">
                    <i class="fas fa-calendar"></i>
                    Posted ${this.formatDate(job.postedDate)}
                    ${job.deadline ? `
                    • <i class="fas fa-hourglass-end"></i>
                    Apply before <span class="${this.isDeadlineClose(job.deadline) ? 'deadline-warning' : 'deadline-normal'}">
                        ${this.formatDate(job.deadline)}
                    </span>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Show/hide load more button
        if (endIndex < this.filteredJobs.length) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
        
        this.attachJobEventListeners();
        this.showJobsGrid();
    }

    attachJobEventListeners() {
        // View details buttons
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = btn.getAttribute('data-job-id');
                this.showJobModal(jobId);
            });
        });

        // Save job buttons
        document.querySelectorAll('.save-job').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = btn.getAttribute('data-job-id');
                this.saveJobToList(jobId);
            });
        });

        // Quick apply buttons
        document.querySelectorAll('.quick-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const jobId = btn.getAttribute('data-job-id');
                this.quickApply(jobId);
            });
        });

        // Make entire job card clickable
        document.querySelectorAll('.job-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const jobId = card.getAttribute('data-job-id');
                    this.showJobModal(jobId);
                }
            });
        });
    }

    showJobModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) {
            this.showToast('Job not found', 'error');
            return;
        }

        document.getElementById('modalJobTitle').textContent = job.title;
        
        const jobDetails = document.getElementById('jobDetailsContent');
        jobDetails.innerHTML = this.getJobDetailsHTML(job);
        
        // Store current job for application
        this.currentJobApplication = job;
        
        document.getElementById('jobModal').classList.add('show');
    }

    hideJobModal() {
        document.getElementById('jobModal').classList.remove('show');
    }

    getJobDetailsHTML(job) {
        return `
            <div class="job-detail-section">
                <h4>Job Description</h4>
                <p>${job.description}</p>
            </div>

            ${job.requirements && job.requirements.length > 0 ? `
            <div class="job-detail-section">
                <h4>Requirements</h4>
                <ul>
                    ${Array.isArray(job.requirements) ? 
                      job.requirements.map(req => `<li>${req}</li>`).join('') : 
                      `<li>${job.requirements}</li>`}
                </ul>
            </div>
            ` : ''}

            ${job.responsibilities && job.responsibilities.length > 0 ? `
            <div class="job-detail-section">
                <h4>Responsibilities</h4>
                <ul>
                    ${Array.isArray(job.responsibilities) ? 
                      job.responsibilities.map(resp => `<li>${resp}</li>`).join('') : 
                      `<li>${job.responsibilities}</li>`}
                </ul>
            </div>
            ` : ''}

            ${job.requiredSkills && job.requiredSkills.length > 0 ? `
            <div class="job-detail-section">
                <h4>Skills Required</h4>
                <div class="job-skills">
                    ${job.requiredSkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
            </div>
            ` : ''}

            <div class="job-detail-section">
                <h4>Job Details</h4>
                <p><strong>Company:</strong> ${job.company}</p>
                <p><strong>Location:</strong> ${job.location}</p>
                <p><strong>Category:</strong> ${this.formatCategory(job.category)}</p>
                <p><strong>Job Type:</strong> ${this.formatJobType(job.jobType)}</p>
                <p><strong>Experience Level:</strong> ${job.experienceLevel || 'Not specified'}</p>
                <p><strong>Salary:</strong> ${this.formatSalary(job.salary)} ${job.salaryType || 'monthly'}</p>
                <p><strong>Posted:</strong> ${this.formatDate(job.postedDate)}</p>
                ${job.deadline ? `<p><strong>Application Deadline:</strong> <span class="${this.isDeadlineClose(job.deadline) ? 'deadline-warning' : ''}">${this.formatDate(job.deadline)}</span></p>` : ''}
                ${job.contactEmail ? `<p><strong>Contact Email:</strong> ${job.contactEmail}</p>` : ''}
            </div>

            ${job.benefits && job.benefits.length > 0 ? `
            <div class="job-detail-section">
                <h4>Benefits</h4>
                <ul>
                    ${Array.isArray(job.benefits) ? 
                      job.benefits.map(benefit => `<li>${benefit}</li>`).join('') : 
                      `<li>${job.benefits}</li>`}
                </ul>
            </div>
            ` : ''}
        `;
    }

    showApplicationModal() {
        if (!this.currentUser) {
            this.showToast('Please log in to apply for jobs', 'error');
            return;
        }

        if (!this.currentJobApplication) {
            this.showToast('No job selected', 'error');
            return;
        }

        document.getElementById('applyJobTitle').textContent = this.currentJobApplication.title;
        document.getElementById('applicationMessage').value = '';
        document.getElementById('coverLetterChars').textContent = '0';
        
        this.hideJobModal();
        document.getElementById('applicationModal').classList.add('show');
    }

    hideApplicationModal() {
        document.getElementById('applicationModal').classList.remove('show');
    }

    async submitApplication() {
        if (!this.currentJobApplication || !this.currentUser) return;

        const submitBtn = document.getElementById('submitApplication');
        const applicationMessage = document.getElementById('applicationMessage').value;

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const db = firebase.firestore();
            
            // Save application to Firebase
            await db.collection('applications').add({
                jobId: this.currentJobApplication.id,
                jobTitle: this.currentJobApplication.title,
                companyName: this.currentJobApplication.company,
                seekerId: this.currentUser.uid,
                appliedDate: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                coverLetter: applicationMessage,
                resumeAttached: document.getElementById('attachResume').checked,
                employerId: this.currentJobApplication.employerId || 'unknown'
            });

            this.showToast('Application submitted successfully!', 'success');
            this.hideApplicationModal();
            
        } catch (error) {
            console.error('Error submitting application:', error);
            this.showToast('Failed to submit application. Please try again.', 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    async saveJobToList(jobId) {
        if (!this.currentUser) {
            this.showToast('Please log in to save jobs', 'error');
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('savedJobs').add({
                jobId: jobId,
                seekerId: this.currentUser.uid,
                savedDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Job saved to your favorites!', 'success');
        } catch (error) {
            console.error('Error saving job:', error);
            this.showToast('Failed to save job. Please try again.', 'error');
        }
    }

    quickApply(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        this.currentJobApplication = job;
        this.showApplicationModal();
    }

    showAlertsModal() {
        document.getElementById('alertsModal').classList.add('show');
    }

    hideAlertsModal() {
        document.getElementById('alertsModal').classList.remove('show');
    }

    saveJobAlert() {
        const keywords = document.getElementById('alertKeywords').value.trim();
        const category = document.getElementById('alertCategory').value;
        const location = document.getElementById('alertLocation').value;
        const frequency = document.getElementById('alertFrequency').value;
        const emailNotifications = document.getElementById('emailNotifications').checked;

        if (!keywords) {
            this.showToast('Please enter job keywords for your alert', 'error');
            return;
        }

        // Save to localStorage for now (would be Firebase in production)
        const alert = {
            keywords,
            category,
            location,
            frequency,
            emailNotifications,
            created: new Date().toISOString()
        };

        const existingAlerts = JSON.parse(localStorage.getItem('jobAlerts') || '[]');
        existingAlerts.push(alert);
        localStorage.setItem('jobAlerts', JSON.stringify(existingAlerts));

        this.hideAlertsModal();
        this.showToast('Job alert saved successfully!', 'success');
        
        // Reset form
        document.getElementById('alertKeywords').value = '';
        document.getElementById('alertCategory').value = '';
        document.getElementById('alertLocation').value = '';
        document.getElementById('alertFrequency').value = 'daily';
        document.getElementById('emailNotifications').checked = true;
    }

    async handleLogout() {
        try {
            await firebase.auth().signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
    }

    // Utility Methods
    formatJobType(type) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'internship': 'Internship',
            'remote': 'Remote'
        };
        return types[type] || type || 'Full-time';
    }

    formatCategory(category) {
        const categories = {
            'technology': 'Technology',
            'healthcare': 'Healthcare',
            'education': 'Education',
            'finance': 'Finance',
            'marketing': 'Marketing',
            'sales': 'Sales',
            'engineering': 'Engineering',
            'design': 'Design',
            'business': 'Business',
            'other': 'Other'
        };
        return categories[category] || category || 'Other';
    }

    formatSalary(salary) {
        if (!salary || salary === 0) return 'Negotiable';
        return new Intl.NumberFormat('en-UG', {
            style: 'currency',
            currency: 'UGX',
            minimumFractionDigits: 0
        }).format(salary);
    }

    formatDate(date) {
        if (!date) return 'Unknown date';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    isDeadlineClose(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const diffTime = deadlineDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
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
        }, 4000);
    }
}

// Initialize the browse jobs functionality
document.addEventListener('DOMContentLoaded', () => {
    window.browseJobs = new BrowseJobs();
});