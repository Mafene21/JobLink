// Employer Dashboard JavaScript with Advanced Applicant Tracking
class EmployerDashboard {
    constructor() {
        this.currentUser = null;
        this.companyData = null;
        this.jobs = [];
        this.applications = [];
        this.potentialCandidatesCount = 0;
        this.totalApplicantsCount = 0;
        this.init();
    }

    async init() {
        await this.initializeFirebase();
        await this.checkAuthState();
        this.bindEvents();
        this.addTouchEvents();
        
        // Make instance globally available after initialization
        window.employerDashboard = this;
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
            console.log("Firebase initialized successfully");
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.showError("Failed to initialize Firebase. Please refresh the page.");
        }
    }

    async checkAuthState() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    console.log('User authenticated:', user.uid);
                    await this.loadCompanyData();
                    await this.loadApplications();
                    await this.loadJobPostings();
                    await this.calculatePotentialCandidatesCount();
                    this.updateStats();
                    resolve();
                } else {
                    console.log('No user authenticated, redirecting to login');
                    window.location.href = 'login.html';
                    resolve();
                }
            });
        });
    }

    async loadCompanyData() {
        try {
            console.log('Loading company data for user:', this.currentUser.uid);
            
            const db = firebase.firestore();
            
            // Try to get company data from companies collection first
            const companyDoc = await db.collection('companies').doc(this.currentUser.uid).get();
            if (companyDoc.exists) {
                this.companyData = companyDoc.data();
                console.log('Company data loaded from companies collection:', this.companyData);
                this.updateCompanyUI();
            } else {
                console.log('No company data found in companies collection, trying users collection...');
                // Fallback to user data
                const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
                if (userDoc.exists) {
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
        
        if (logoUrl && logoUrl.trim() !== '' && logoUrl !== 'https://via.placeholder.com/150x150?text=Company+Logo') {
            companyLogo.src = logoUrl;
            companyLogoNav.src = logoUrl;
            console.log('Company logo updated');
        } else {
            // Use default logo if no logo is set
            companyLogo.src = 'https://via.placeholder.com/60x60/2563eb/ffffff?text=LOGO';
            companyLogoNav.src = 'https://via.placeholder.com/32x32/2563eb/ffffff?text=LOGO';
            console.log('Using default logo');
        }

        // Add error handling for images
        companyLogo.onerror = () => {
            console.log('Company logo failed to load, using default');
            companyLogo.src = 'https://via.placeholder.com/60x60/2563eb/ffffff?text=LOGO';
        };
        
        companyLogoNav.onerror = () => {
            console.log('Nav logo failed to load, using default');
            companyLogoNav.src = 'https://via.placeholder.com/32x32/2563eb/ffffff?text=LOGO';
        };
    }

    async loadApplications() {
        try {
            const db = firebase.firestore();
            const jobsQuery = db.collection('jobs').where('employerId', '==', this.currentUser.uid);
            
            const jobsSnapshot = await jobsQuery.get();
            const jobIds = jobsSnapshot.docs.map(doc => doc.id);
            
            this.applications = [];
            this.totalApplicantsCount = 0;
            
            for (const jobId of jobIds) {
                const applicationsQuery = db.collection('applications').where('jobId', '==', jobId);
                const applicationsSnapshot = await applicationsQuery.get();
                
                applicationsSnapshot.forEach(doc => {
                    this.applications.push({ id: doc.id, ...doc.data() });
                });
            }
            
            this.totalApplicantsCount = this.applications.length;
            console.log('Total applicants loaded:', this.totalApplicantsCount);
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.applications = [];
            this.totalApplicantsCount = 0;
        }
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
            const db = firebase.firestore();
            const jobsQuery = db.collection('jobs').where('employerId', '==', this.currentUser.uid);
            
            const querySnapshot = await jobsQuery.get();
            console.log('Found', querySnapshot.size, 'jobs');
            
            if (querySnapshot.empty) {
                this.showNoJobsState(jobsList);
                this.jobs = [];
                return;
            }

            this.jobs = [];
            let jobsData = [];
            
            querySnapshot.forEach((doc) => {
                const job = { id: doc.id, ...doc.data() };
                jobsData.push(job);
            });
            
            // Calculate applicant counts for each job
            for (let job of jobsData) {
                job.applicantCount = await this.getApplicantCountForJob(job.id);
            }
            
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

    async getApplicantCountForJob(jobId) {
        try {
            const db = firebase.firestore();
            const applicationsQuery = db.collection('applications').where('jobId', '==', jobId);
            const applicationsSnapshot = await applicationsQuery.get();
            return applicationsSnapshot.size;
        } catch (error) {
            console.error('Error getting applicant count for job:', jobId, error);
            return 0;
        }
    }

    async calculatePotentialCandidatesCount() {
        try {
            let totalPotentialCandidates = 0;
            const db = firebase.firestore();
            
            for (const job of this.jobs) {
                const seekersQuery = db.collection('users').where('userType', '==', 'seeker');
                const seekersSnapshot = await seekersQuery.get();
                
                let jobPotentialCandidates = 0;
                
                seekersSnapshot.forEach(seekerDoc => {
                    const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
                    const matchScore = this.calculateAdvancedMatchScore(job, seeker);
                    
                    if (matchScore >= 50) { // 50% match threshold
                        jobPotentialCandidates++;
                    }
                });
                
                totalPotentialCandidates += jobPotentialCandidates;
            }
            
            this.potentialCandidatesCount = totalPotentialCandidates;
            console.log('Potential candidates count:', this.potentialCandidatesCount);
            
        } catch (error) {
            console.error('Error calculating potential candidates:', error);
            this.potentialCandidatesCount = 0;
        }
    }

    calculateAdvancedMatchScore(job, seeker) {
        if (!job || !seeker) return 0;

        let score = 0;
        let totalWeight = 0;

        // Job Type Matching (25% weight)
        if (job.jobType && seeker.jobTypes) {
            const userJobTypes = Array.isArray(seeker.jobTypes) ? 
                seeker.jobTypes : [seeker.jobTypes];
            
            if (userJobTypes.includes(job.jobType)) {
                score += 100 * 0.25;
            } else {
                // Partial match for similar types
                const similarTypes = {
                    'full-time': ['part-time', 'contract'],
                    'part-time': ['full-time', 'contract'],
                    'contract': ['full-time', 'part-time'],
                    'remote': ['full-time', 'part-time', 'contract'],
                    'internship': ['full-time', 'part-time']
                };
                
                if (similarTypes[job.jobType]) {
                    const hasSimilar = userJobTypes.some(type => 
                        similarTypes[job.jobType].includes(type)
                    );
                    if (hasSimilar) score += 50 * 0.25;
                }
            }
            totalWeight += 0.25;
        }

        // Category Matching (25% weight)
        if (job.category && seeker.categories) {
            const userCategories = Array.isArray(seeker.categories) ? 
                seeker.categories : [seeker.categories];
            const jobCategories = Array.isArray(job.category) ? 
                job.category : [job.category];
            
            const matchingCategories = jobCategories.filter(cat => 
                userCategories.includes(cat)
            );
            
            if (matchingCategories.length > 0) {
                score += 100 * 0.25;
            } else {
                // Check for similar categories
                const categorySimilarity = this.calculateCategorySimilarity(userCategories, jobCategories);
                score += categorySimilarity * 0.25;
            }
            totalWeight += 0.25;
        }

        // Industry Matching (20% weight)
        if (job.industry && seeker.industries) {
            const userIndustries = Array.isArray(seeker.industries) ? 
                seeker.industries : [seeker.industries];
            const jobIndustries = Array.isArray(job.industry) ? 
                job.industry : [job.industry];
            
            const matchingIndustries = jobIndustries.filter(ind => 
                userIndustries.includes(ind)
            );
            
            if (matchingIndustries.length > 0) {
                score += 100 * 0.20;
            } else {
                // Check for similar industries
                const industrySimilarity = this.calculateIndustrySimilarity(userIndustries, jobIndustries);
                score += industrySimilarity * 0.20;
            }
            totalWeight += 0.20;
        }

        // Location Matching (20% weight)
        if (job.location && seeker.location) {
            const locationMatch = this.calculateLocationMatch(seeker.location, job.location);
            score += locationMatch * 0.20;
            totalWeight += 0.20;
        }

        // Skills Matching (10% weight)
        if (job.requiredSkills && seeker.skills) {
            const userSkills = Array.isArray(seeker.skills) ? 
                seeker.skills : [seeker.skills];
            const jobSkills = Array.isArray(job.requiredSkills) ? 
                job.requiredSkills : [job.requiredSkills];
            
            const matchingSkills = jobSkills.filter(skill => 
                userSkills.some(userSkill => 
                    userSkill.toLowerCase().includes(skill.toLowerCase()) ||
                    skill.toLowerCase().includes(userSkill.toLowerCase())
                )
            );
            
            const skillsScore = jobSkills.length > 0 ? 
                (matchingSkills.length / jobSkills.length) * 100 : 0;
            score += skillsScore * 0.10;
            totalWeight += 0.10;
        }

        const normalizedScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
        return Math.max(0, Math.min(100, normalizedScore));
    }

    calculateCategorySimilarity(userCategories, jobCategories) {
        // Define category groups for similarity calculation
        const categoryGroups = {
            'technology': ['software-development', 'web-development', 'mobile-development', 'data-science', 'ai-ml'],
            'design': ['graphic-design', 'ui-ux-design', 'web-design', 'product-design'],
            'business': ['marketing', 'sales', 'business-development', 'project-management'],
            'finance': ['accounting', 'finance', 'banking', 'investment'],
            'healthcare': ['nursing', 'medical', 'healthcare', 'pharmaceutical']
        };

        let maxSimilarity = 0;
        
        userCategories.forEach(userCat => {
            jobCategories.forEach(jobCat => {
                let similarity = 0;
                
                // Exact match
                if (userCat === jobCat) {
                    similarity = 100;
                } else {
                    // Check if they belong to the same group
                    for (const group in categoryGroups) {
                        const groupCategories = categoryGroups[group];
                        if (groupCategories.includes(userCat) && groupCategories.includes(jobCat)) {
                            similarity = 75;
                            break;
                        }
                    }
                    
                    // Check for partial string match
                    if (similarity === 0) {
                        const userWords = userCat.toLowerCase().split(/[-_ ]/);
                        const jobWords = jobCat.toLowerCase().split(/[-_ ]/);
                        const commonWords = userWords.filter(word => 
                            jobWords.some(jobWord => this.calculateSimilarity(word, jobWord) > 0.7)
                        );
                        
                        if (commonWords.length > 0) {
                            similarity = 50;
                        }
                    }
                }
                
                maxSimilarity = Math.max(maxSimilarity, similarity);
            });
        });
        
        return maxSimilarity;
    }

    calculateIndustrySimilarity(userIndustries, jobIndustries) {
        // Define industry groups for similarity calculation
        const industryGroups = {
            'technology': ['software', 'hardware', 'internet', 'telecommunications', 'it-services'],
            'finance': ['banking', 'insurance', 'investment', 'financial-services'],
            'healthcare': ['hospitals', 'pharmaceuticals', 'medical-devices', 'healthcare-services'],
            'retail': ['e-commerce', 'consumer-goods', 'fashion', 'retail-services'],
            'manufacturing': ['automotive', 'industrial', 'construction', 'energy']
        };

        let maxSimilarity = 0;
        
        userIndustries.forEach(userInd => {
            jobIndustries.forEach(jobInd => {
                let similarity = 0;
                
                // Exact match
                if (userInd === jobInd) {
                    similarity = 100;
                } else {
                    // Check if they belong to the same group
                    for (const group in industryGroups) {
                        const groupIndustries = industryGroups[group];
                        if (groupIndustries.includes(userInd) && groupIndustries.includes(jobInd)) {
                            similarity = 75;
                            break;
                        }
                    }
                    
                    // Check for partial string match
                    if (similarity === 0) {
                        const userWords = userInd.toLowerCase().split(/[-_ ]/);
                        const jobWords = jobInd.toLowerCase().split(/[-_ ]/);
                        const commonWords = userWords.filter(word => 
                            jobWords.some(jobWord => this.calculateSimilarity(word, jobWord) > 0.7)
                        );
                        
                        if (commonWords.length > 0) {
                            similarity = 50;
                        }
                    }
                }
                
                maxSimilarity = Math.max(maxSimilarity, similarity);
            });
        });
        
        return maxSimilarity;
    }

    calculateLocationMatch(userLocation, jobLocation) {
        if (!userLocation || !jobLocation) return 0;
        
        const userLoc = userLocation.toLowerCase().trim();
        const jobLoc = jobLocation.toLowerCase().trim();
        
        // Exact match
        if (userLoc === jobLoc) return 100;
        
        // Check for same city/state
        const userParts = userLoc.split(',');
        const jobParts = jobLoc.split(',');
        
        if (userParts.length > 0 && jobParts.length > 0) {
            const userCity = userParts[0].trim();
            const jobCity = jobParts[0].trim();
            
            if (userCity === jobCity) return 90;
            
            // Check for similar city names
            if (this.calculateSimilarity(userCity, jobCity) > 0.8) return 80;
        }
        
        // Check for same state
        if (userParts.length > 1 && jobParts.length > 1) {
            const userState = userParts[1].trim();
            const jobState = jobParts[1].trim();
            
            if (userState === jobState) return 70;
        }
        
        // Check for remote work
        if (jobLoc.includes('remote') || jobLoc.includes('anywhere')) return 60;
        
        // Check for same country
        const userCountry = userParts[userParts.length - 1].trim();
        const jobCountry = jobParts[jobParts.length - 1].trim();
        
        if (userCountry === jobCountry) return 50;
        
        return 0;
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length);
    }

    editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
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
        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'https://via.placeholder.com/24x24/2563eb/ffffff?text=LOGO';
        const companyName = job.companyName || this.companyData?.companyName || 'Your Company';
        
        // Create job poster HTML
        const jobPosterHTML = this.createJobPosterHTML(job);
        
        // Get applicant count for this job
        const applicantCount = job.applicantCount || 0;
        
        return `
            <div class="job-card" data-job-id="${job.id}">
                <div class="job-card-header">
                    <div class="job-header-content">
                        <img src="${companyLogo}" alt="Company Logo" class="job-company-logo" onerror="this.src='https://via.placeholder.com/24x24/2563eb/ffffff?text=LOGO'">
                        <div class="job-title-section">
                            <div class="job-title">${job.title || 'Untitled Job'}</div>
                            <div class="job-company">${companyName}</div>
                        </div>
                    </div>
                    <div class="job-type">${this.formatJobType(job.jobType) || 'Full-time'}</div>
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
                        ${applicantCount} applicant${applicantCount !== 1 ? 's' : ''}
                    </div>
                    <button class="view-candidates-btn" data-job-id="${job.id}">
                        View Potential Candidates
                    </button>
                </div>
            </div>
        `;
    }

    createJobPosterHTML(job) {
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
            const db = firebase.firestore();
            const seekersQuery = db.collection('users').where('userType', '==', 'seeker');
            const seekersSnapshot = await seekersQuery.get();
            
            const potentialCandidates = [];
            
            seekersSnapshot.forEach(seekerDoc => {
                const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
                const matchScore = this.calculateAdvancedMatchScore(job, seeker);
                
                if (matchScore >= 50) { // 50% match threshold
                    potentialCandidates.push({
                        ...seeker,
                        matchScore: matchScore
                    });
                }
            });
            
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
                    <div><i class="fas fa-map-marker-alt"></i> ${candidate.location || 'Not specified'}</div>
                    <div><i class="fas fa-money-bill-wave"></i> ${candidate.desiredSalary || 'Not specified'}</div>
                    <div><i class="fas fa-briefcase"></i> ${this.formatJobTypes(candidate.jobTypes) || 'Not specified'}</div>
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

    formatJobTypes(jobTypes) {
        if (!jobTypes) return '';
        if (Array.isArray(jobTypes)) {
            return jobTypes.map(type => this.formatJobType(type)).join(', ');
        }
        return this.formatJobType(jobTypes);
    }

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'remote': 'Remote',
            'internship': 'Internship'
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
        this.bindJobCardEvents();
    }

    bindJobCardEvents() {
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

    viewCandidateProfile(candidateId) {
        window.open(`candidate_profile.html?id=${candidateId}`, '_blank');
    }

    contactCandidate(candidateId) {
        this.showToast('Contact feature will be implemented soon!', 'info');
    }

    showJobImageModal(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job || !job.posterUrl) return;

        const modal = document.createElement('div');
        modal.className = 'modal job-image-modal';
        modal.style.display = 'block';
        
        const companyLogo = this.companyData?.logoUrl || job.companyLogo || 'https://via.placeholder.com/40x40/2563eb/ffffff?text=LOGO';
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
                            <img src="${companyLogo}" alt="Company Logo" style="width: 16px; height: 16px; border-radius: 3px; margin-right: 5px;" onerror="this.src='https://via.placeholder.com/16x16/2563eb/ffffff?text=LOGO'">
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

    editJobPoster(jobId) {
        this.showToast('Redirecting to edit job page...', 'info');
        setTimeout(() => {
            window.location.href = `job_posting.html?edit=${jobId}`;
        }, 1000);
    }

    updateStats() {
        document.getElementById('activeJobsCount').textContent = this.jobs.length;
        document.getElementById('totalApplicantsCount').textContent = this.totalApplicantsCount;
        document.getElementById('potentialMatchesCount').textContent = this.potentialCandidatesCount;
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
        } else if (statType === 'Total Applicants') {
            this.showToast(`You have ${this.totalApplicantsCount} total applicants across all jobs`, 'info');
        } else {
            this.showToast(`You have ${this.jobs.length} active job postings`, 'info');
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
            await firebase.auth().signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
    }

    async handleViewAllApplicants() {
        try {
            this.showToast('Loading applicants...', 'info');
            
            const db = firebase.firestore();
            const jobsQuery = db.collection('jobs').where('employerId', '==', this.currentUser.uid);
            
            const jobsSnapshot = await jobsQuery.get();
            const jobIds = jobsSnapshot.docs.map(doc => doc.id);
            
            if (jobIds.length === 0) {
                this.showToast('No jobs found', 'info');
                return;
            }
            
            const applications = [];
            for (const jobId of jobIds) {
                const applicationsQuery = db.collection('applications').where('jobId', '==', jobId);
                const applicationsSnapshot = await applicationsQuery.get();
                
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
                const jobDoc = await db.collection('jobs').doc(application.jobId).get();
                const job = jobDoc.exists ? jobDoc.data() : { title: 'Unknown Job' };
                
                const seekerDoc = await db.collection('users').doc(application.seekerId).get();
                const seeker = seekerDoc.exists ? seekerDoc.data() : { fullName: 'Unknown Seeker' };
                
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
                            ${applicant.appliedDate?.toDate ? applicant.appliedDate.toDate().toLocaleDateString() : 'Unknown date'}
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

    showError(message) {
        this.showToast(message, 'error');
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