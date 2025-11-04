// Browse Jobs JavaScript with Firebase Integration
class BrowseJobs {
    constructor() {
        this.jobs = [];
        this.filteredJobs = [];
        this.currentPage = 1;
        this.jobsPerPage = 10;
        this.filters = {
            search: '',
            jobType: '',
            location: '',
            experience: '',
            salary: ''
        };
        this.sortBy = 'newest';
        this.firebaseInitialized = false;
        this.init();
    }

    async init() {
        await this.initializeFirebase();
        this.bindEvents();
        await this.loadJobs();
    }

    initializeFirebase() {
        // Firebase configuration (same as your dashboard)
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
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.firebaseInitialized = true;
            console.log("Firebase initialized successfully for Browse Jobs");
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.firebaseInitialized = false;
            this.showError("Failed to initialize Firebase. Please refresh the page.");
        }
    }

    bindEvents() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.handleSearch();
        });

        document.getElementById('jobSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Filter changes
        document.getElementById('jobTypeFilter').addEventListener('change', (e) => {
            this.filters.jobType = e.target.value;
            this.applyFilters();
        });

        document.getElementById('locationFilter').addEventListener('change', (e) => {
            this.filters.location = e.target.value;
            this.applyFilters();
        });

        document.getElementById('experienceFilter').addEventListener('change', (e) => {
            this.filters.experience = e.target.value;
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
            this.applyForJob();
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
    }

    async loadJobs() {
        if (!this.firebaseInitialized) {
            this.showError("Firebase not initialized. Please refresh the page.");
            this.showEmptyState();
            return;
        }

        try {
            this.showLoadingState();
            
            const db = firebase.firestore();
            const jobsSnapshot = await db
                .collection('jobs')
                .where('status', '==', 'active')
                .get();

            console.log('Loaded jobs from Firebase:', jobsSnapshot.size);

            this.jobs = [];
            for (const doc of jobsSnapshot.docs) {
                const jobData = doc.data();
                
                // Load employer data for each job
                let employerData = null;
                if (jobData.employerId) {
                    employerData = await this.loadEmployerData(jobData.employerId);
                }
                
                this.jobs.push({
                    id: doc.id,
                    ...jobData,
                    employerData: employerData,
                    company: this.getCompanyName(jobData, employerData),
                    companyLogo: this.getCompanyLogo(jobData, employerData),
                    postedDate: jobData.createdAt ? this.formatFirebaseDate(jobData.createdAt) : 'Recently',
                    formattedSalary: this.formatSalary(jobData.salary)
                });
            }

            console.log('Processed jobs with employer data:', this.jobs);

            if (this.jobs.length === 0) {
                this.showEmptyState();
            } else {
                this.filteredJobs = [...this.jobs];
                this.sortJobs();
                this.renderJobs();
            }
            
        } catch (error) {
            console.error('Error loading jobs from Firebase:', error);
            this.showToast('Error loading jobs. Please try again.', 'error');
            this.showEmptyState();
        }
    }

    async loadEmployerData(employerId) {
        try {
            const db = firebase.firestore();
            
            // Try companies collection first
            let employerDoc = await db.collection('companies').doc(employerId).get();
            if (employerDoc.exists) {
                return employerDoc.data();
            }
            
            // Fallback to users collection
            employerDoc = await db.collection('users').doc(employerId).get();
            if (employerDoc.exists) {
                return employerDoc.data();
            }
            
            console.log('No employer data found for:', employerId);
            return null;
        } catch (error) {
            console.error('Error loading employer data:', error);
            return null;
        }
    }

    getCompanyName(jobData, employerData) {
        if (employerData) {
            return employerData.companyName || 
                   employerData.fullName || 
                   'Company not specified';
        }
        
        return jobData.company || 
               jobData.companyName || 
               jobData.employerName || 
               jobData.employer || 
               jobData.postedByCompany ||
               'Company not specified';
    }

    getCompanyLogo(jobData, employerData) {
        if (employerData) {
            return employerData.logoUrl || 
                   employerData.profilePicture ||
                   `https://via.placeholder.com/50x50/3498db/ffffff?text=${this.getCompanyName(jobData, employerData).charAt(0).toUpperCase()}`;
        }
        
        return jobData.companyLogo || 
               jobData.logo || 
               jobData.companyImage || 
               jobData.employerLogo ||
               `https://via.placeholder.com/50x50/3498db/ffffff?text=${this.getCompanyName(jobData, employerData).charAt(0).toUpperCase()}`;
    }

    formatFirebaseDate(timestamp) {
        if (!timestamp) return 'Recently';
        
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
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

    formatSalary(salaryString) {
        if (!salaryString) return 'Salary not specified';
        
        // Format salary for display
        if (salaryString.includes('UGX')) {
            return salaryString;
        }
        
        // Add UGX prefix if not present
        return `UGX ${salaryString}`;
    }

    handleSearch() {
        const searchTerm = document.getElementById('jobSearch').value.trim();
        this.filters.search = searchTerm.toLowerCase();
        
        if (searchTerm) {
            this.showLoadingState();
            // Small delay for better UX
            setTimeout(() => {
                this.applyFilters();
            }, 300);
        } else {
            this.applyFilters();
        }
    }

    applyFilters() {
        this.filteredJobs = this.jobs.filter(job => {
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const matchesSearch = 
                    job.title?.toLowerCase().includes(searchTerm) ||
                    job.company?.toLowerCase().includes(searchTerm) ||
                    job.description?.toLowerCase().includes(searchTerm) ||
                    (job.requiredSkills && job.requiredSkills.some(skill => 
                        skill.toLowerCase().includes(searchTerm)));
                
                if (!matchesSearch) return false;
            }

            // Job type filter
            if (this.filters.jobType && job.jobType !== this.filters.jobType) {
                return false;
            }

            // Location filter
            if (this.filters.location) {
                if (this.filters.location === 'remote') {
                    if (!job.location?.toLowerCase().includes('remote')) {
                        return false;
                    }
                } else if (job.location?.toLowerCase() !== this.filters.location.toLowerCase()) {
                    return false;
                }
            }

            // Experience filter
            if (this.filters.experience) {
                const experienceMap = {
                    'entry': ['none', '0-1'],
                    'mid': ['1-3', '3-5'],
                    'senior': ['5-10', '10+']
                };
                
                const allowedLevels = experienceMap[this.filters.experience] || [];
                if (!allowedLevels.includes(job.experienceLevel)) {
                    return false;
                }
            }

            // Salary filter
            if (this.filters.salary) {
                const jobSalary = this.parseSalary(job.salary);
                if (jobSalary === 0) return false; // Skip jobs with no salary info

                switch (this.filters.salary) {
                    case '0-500k':
                        if (jobSalary > 500000) return false;
                        break;
                    case '500k-1M':
                        if (jobSalary <= 500000 || jobSalary > 1000000) return false;
                        break;
                    case '1M-2M':
                        if (jobSalary <= 1000000 || jobSalary > 2000000) return false;
                        break;
                    case '2M+':
                        if (jobSalary <= 2000000) return false;
                        break;
                }
            }

            return true;
        });

        this.currentPage = 1; // Reset to first page when filters change
        this.sortJobs();
    }

    sortJobs() {
        if (this.filteredJobs.length === 0) {
            this.showEmptyState();
            return;
        }

        switch (this.sortBy) {
            case 'newest':
                this.filteredJobs.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                break;
            case 'salary-high':
                this.filteredJobs.sort((a, b) => this.parseSalary(b.salary) - this.parseSalary(a.salary));
                break;
            case 'salary-low':
                this.filteredJobs.sort((a, b) => this.parseSalary(a.salary) - this.parseSalary(b.salary));
                break;
            case 'relevant':
                // For now, sort by newest as relevance metric
                this.filteredJobs.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                break;
        }

        this.renderJobs();
    }

    parseSalary(salaryString) {
        if (!salaryString) return 0;
        
        // Extract numbers from salary string
        const numbers = salaryString.match(/\d+/g);
        if (!numbers) return 0;
        
        // Take the first number and handle 'k' notation
        let salary = parseInt(numbers[0]);
        if (salaryString.toLowerCase().includes('k')) {
            salary *= 1000;
        }
        
        return salary;
    }

    resetFilters() {
        document.getElementById('jobSearch').value = '';
        document.getElementById('jobTypeFilter').value = '';
        document.getElementById('locationFilter').value = '';
        document.getElementById('experienceFilter').value = '';
        document.getElementById('salaryFilter').value = '';
        document.getElementById('sortBy').value = 'newest';

        this.filters = {
            search: '',
            jobType: '',
            location: '',
            experience: '',
            salary: ''
        };
        this.sortBy = 'newest';

        this.filteredJobs = [...this.jobs];
        this.sortJobs();
        this.showToast('Filters reset successfully', 'info');
    }

    async refreshJobs() {
        this.showLoadingState();
        await this.loadJobs();
        this.showToast('Jobs refreshed successfully!', 'success');
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

    showAlertsModal() {
        document.getElementById('alertsModal').classList.add('show');
    }

    hideAlertsModal() {
        document.getElementById('alertsModal').classList.remove('show');
    }

    showJobModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        document.getElementById('modalJobTitle').textContent = job.title;
        
        const jobDetails = document.querySelector('.job-details');
        jobDetails.innerHTML = this.getJobDetailsHTML(job);
        
        // Set up apply button with job ID
        const applyBtn = document.getElementById('applyJobBtn');
        applyBtn.setAttribute('data-job-id', jobId);
        
        // Set up save button with job ID
        const saveBtn = document.getElementById('saveJobBtn');
        saveBtn.setAttribute('data-job-id', jobId);
        
        document.getElementById('jobModal').classList.add('show');
    }

    hideJobModal() {
        document.getElementById('jobModal').classList.remove('show');
    }

    getJobDetailsHTML(job) {
        const companyName = this.getCompanyName(job, job.employerData);
        const companyLogo = this.getCompanyLogo(job, job.employerData);

        return `
            <div class="job-detail-section">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <img src="${companyLogo}" 
                         alt="${companyName} Logo" 
                         style="width: 50px; height: 50px; border-radius: 8px; margin-right: 15px;"
                         onerror="this.src='https://via.placeholder.com/50x50/3498db/ffffff?text=${companyName.charAt(0).toUpperCase()}'">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${companyName}</h4>
                        <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${job.location || 'Location not specified'}</p>
                    </div>
                </div>
            </div>

            <div class="job-detail-section">
                <h4>Job Description</h4>
                <p>${job.description || 'No description available.'}</p>
            </div>

            ${job.responsibilities && job.responsibilities.length > 0 ? `
            <div class="job-detail-section">
                <h4>Key Responsibilities</h4>
                <ul>
                    ${job.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${job.requiredSkills && job.requiredSkills.length > 0 ? `
            <div class="job-detail-section">
                <h4>Required Skills</h4>
                <div class="job-skills">
                    ${job.requiredSkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
            </div>
            ` : ''}

            ${job.benefits && job.benefits.length > 0 ? `
            <div class="job-detail-section">
                <h4>Benefits</h4>
                <ul>
                    ${job.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            <div class="job-detail-section">
                <h4>Job Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <strong>Job Type:</strong><br>
                        ${this.formatJobType(job.jobType)}
                    </div>
                    <div>
                        <strong>Experience Level:</strong><br>
                        ${this.formatExperience(job.experienceLevel)}
                    </div>
                    <div>
                        <strong>Education:</strong><br>
                        ${this.getEducationLabel(job.educationLevel)}
                    </div>
                    <div>
                        <strong>Salary:</strong><br>
                        ${job.formattedSalary}
                    </div>
                </div>
            </div>

            ${job.applicationDeadline ? `
            <div class="job-detail-section">
                <h4>Application Deadline</h4>
                <p>${this.formatFirebaseDate(job.applicationDeadline)}</p>
            </div>
            ` : ''}
        `;
    }

    formatJobType(type) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'internship': 'Internship',
            'remote': 'Remote'
        };
        return types[type] || type || 'Not specified';
    }

    formatExperience(experience) {
        const levels = {
            'none': 'No experience',
            '0-1': '0-1 years',
            '1-3': '1-3 years',
            '3-5': '3-5 years',
            '5-10': '5-10 years',
            '10+': '10+ years'
        };
        return levels[experience] || experience || 'Not specified';
    }

    getEducationLabel(education) {
        const educationLabels = {
            'high_school': 'High School',
            'certificate': 'Certificate',
            'diploma': 'Diploma',
            'associate': 'Associate Degree',
            'bachelor': "Bachelor's Degree",
            'master': "Master's Degree",
            'phd': 'PhD',
            'other': 'Other'
        };
        return educationLabels[education] || education || 'Not specified';
    }

    saveJobAlert() {
        const keywords = document.getElementById('alertKeywords').value.trim();
        const location = document.getElementById('alertLocation').value;
        const jobType = document.getElementById('alertJobType').value;
        const frequency = document.getElementById('alertFrequency').value;
        const emailNotifications = document.getElementById('emailNotifications').checked;

        if (!keywords) {
            this.showToast('Please enter job keywords for your alert', 'error');
            return;
        }

        // Simulate saving alert
        setTimeout(() => {
            this.hideAlertsModal();
            this.showToast('Job alert saved successfully! You will be notified when matching jobs are posted.', 'success');
            
            // Reset form
            document.getElementById('alertKeywords').value = '';
            document.getElementById('alertLocation').value = '';
            document.getElementById('alertJobType').value = '';
            document.getElementById('alertFrequency').value = 'daily';
            document.getElementById('emailNotifications').checked = false;
        }, 1000);
    }

    async saveJob() {
        const jobId = document.getElementById('saveJobBtn').getAttribute('data-job-id');
        const job = this.jobs.find(j => j.id === jobId);
        
        if (!job) {
            this.showToast('Job not found', 'error');
            return;
        }

        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showToast('Please log in to save jobs', 'error');
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('savedJobs').add({
                userId: user.uid,
                jobId: jobId,
                jobTitle: job.title,
                companyName: job.company,
                savedDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Job saved to your favorites!', 'success');
            this.hideJobModal();
        } catch (error) {
            console.error('Error saving job:', error);
            this.showToast('Failed to save job. Please try again.', 'error');
        }
    }

    applyForJob() {
        const jobId = document.getElementById('applyJobBtn').getAttribute('data-job-id');
        const job = this.jobs.find(j => j.id === jobId);
        
        if (!job) {
            this.showToast('Job not found', 'error');
            return;
        }

        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showToast('Please log in to apply for jobs', 'error');
            // Redirect to login page
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        // Redirect to application page or show application modal
        this.showToast('Redirecting to application page...', 'info');
        setTimeout(() => {
            // You can redirect to a separate application page or show a modal
            // For now, just show a message
            this.hideJobModal();
            this.showToast('Application feature will be implemented soon!', 'info');
        }, 1000);
    }

    renderJobs() {
        const jobsList = document.getElementById('jobsList');
        const jobsCount = document.getElementById('jobsCount');
        
        jobsCount.textContent = this.filteredJobs.length;
        
        if (this.filteredJobs.length === 0) {
            this.showEmptyState();
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.jobsPerPage;
        const endIndex = startIndex + this.jobsPerPage;
        const jobsToShow = this.filteredJobs.slice(startIndex, endIndex);

        jobsList.innerHTML = jobsToShow.map(job => `
            <div class="job-card" data-job-id="${job.id}">
                <div class="job-header">
                    <div class="job-info">
                        <h3 class="job-title">${job.title || 'No Title'}</h3>
                        <p class="job-company">${job.company}</p>
                        <div class="job-meta">
                            <div class="job-meta-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${job.location || 'Location not specified'}</span>
                            </div>
                            <div class="job-meta-item">
                                <i class="fas fa-clock"></i>
                                <span>${this.formatJobType(job.jobType)}</span>
                            </div>
                            <div class="job-meta-item">
                                <i class="fas fa-briefcase"></i>
                                <span>${this.formatExperience(job.experienceLevel)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="job-salary">
                        <div class="salary-amount">${job.formattedSalary}</div>
                        <div class="salary-type">${job.salaryType || 'monthly'}</div>
                    </div>
                </div>
                
                <p class="job-description">${job.description ? job.description.substring(0, 200) + '...' : 'No description available'}</p>
                
                ${job.requiredSkills && job.requiredSkills.length > 0 ? `
                <div class="job-skills">
                    ${job.requiredSkills.slice(0, 5).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                    ${job.requiredSkills.length > 5 ? `<span class="skill-tag">+${job.requiredSkills.length - 5} more</span>` : ''}
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
                    Posted ${job.postedDate}
                </div>
            </div>
        `).join('');
        
        // Add event listeners to job cards and buttons
        this.attachJobEventListeners();
        
        // Show/hide load more button
        const loadMoreSection = document.querySelector('.load-more-section');
        if (this.filteredJobs.length > endIndex) {
            loadMoreSection.style.display = 'block';
        } else {
            loadMoreSection.style.display = 'none';
        }
        
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

    async saveJobToList(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        
        if (!job) {
            this.showToast('Job not found', 'error');
            return;
        }

        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showToast('Please log in to save jobs', 'error');
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('savedJobs').add({
                userId: user.uid,
                jobId: jobId,
                jobTitle: job.title,
                companyName: job.company,
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
        
        if (!job) {
            this.showToast('Job not found', 'error');
            return;
        }

        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showToast('Please log in to apply for jobs', 'error');
            return;
        }

        this.showJobModal(jobId);
        this.showToast('Please use the "Apply Now" button in the job details', 'info');
    }

    showToast(message, type = 'info') {
        // Create toast element
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

        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    showError(message) {
        this.showToast(message, 'error');
    }
}

// Initialize the browse jobs functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase auth scripts are loaded
    if (typeof firebase !== 'undefined') {
        window.browseJobs = new BrowseJobs();
    } else {
        console.error('Firebase SDK not loaded');
        // Show error state
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').innerHTML = `
            <div class="empty-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2>Firebase Error</h2>
            <p>Failed to load Firebase SDK. Please refresh the page.</p>
        `;
    }
});