// Seeker Dashboard JavaScript with Firebase Integration
class SeekerDashboard {
    constructor() {
        this.userData = null;
        this.userProfile = null;
        this.jobsData = [];
        this.filteredJobs = [];
        this.applicationsData = [];
        this.firebaseInitialized = false;
        this.currentUser = null;
        this.currentJobApplication = null;
        this.selectedResumeFile = null;
        this.employersData = new Map();
        this.init();
    }

    async init() {
        await this.initializeFirebase();
        await this.initializeAuth();
        this.bindEvents();
        await this.loadDashboardData();
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
            this.showError("Failed to initialize Firebase. Please refresh the page.");
        }
    }

    async initializeAuth() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    console.log("User authenticated:", user.uid);
                    resolve();
                } else {
                    console.log("No user authenticated");
                    this.showLoginPrompt();
                    resolve();
                }
            });
        });
    }

    showLoginPrompt() {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt-overlay';
        loginPrompt.innerHTML = `
            <div class="login-prompt">
                <div class="prompt-icon">
                    <i class="fas fa-user-lock"></i>
                </div>
                <h3>Authentication Required</h3>
                <p>Please log in to access your dashboard</p>
                <div class="prompt-actions">
                    <button class="btn btn-primary" onclick="location.href='login.html'">
                        <i class="fas fa-sign-in-alt"></i>
                        Go to Login
                    </button>
                    <button class="btn btn-outline" onclick="location.href='index.html'">
                        <i class="fas fa-home"></i>
                        Go to Homepage
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(loginPrompt);
    }

    bindEvents() {
        this.bindMobileNavigation();
        
        const searchInput = document.getElementById('jobSearch');
        const jobFilter = document.getElementById('jobFilter');
        const refreshMatchesBtn = document.getElementById('refreshMatchesBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        if (jobFilter) jobFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        if (refreshMatchesBtn) refreshMatchesBtn.addEventListener('click', () => this.refreshJobMatches());
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); this.handleLogout(); });

        // Modal events
        const closeModalBtn = document.getElementById('closeApplicationModal');
        const cancelModalBtn = document.getElementById('cancelApplication');
        const submitModalBtn = document.getElementById('submitApplication');
        const closeJobDetailsModalBtn = document.getElementById('closeJobDetailsModal');
        const closeEmployerModalBtn = document.getElementById('closeEmployerModal');

        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.hideApplicationModal());
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => this.hideApplicationModal());
        if (submitModalBtn) submitModalBtn.addEventListener('click', () => this.submitApplication());
        if (closeJobDetailsModalBtn) closeJobDetailsModalBtn.addEventListener('click', () => this.hideJobDetailsModal());
        if (closeEmployerModalBtn) closeEmployerModalBtn.addEventListener('click', () => this.hideEmployerModal());

        this.setupFileUpload();
    }

    bindMobileNavigation() {
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                navLinks.classList.toggle('active');
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

            document.addEventListener('click', (e) => {
                if (!navLinks.contains(e.target) && !hamburger.contains(e.target) && navLinks.classList.contains('active')) {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                    this.removeMenuOverlay();
                }
            });
        }
    }

    createMenuOverlay() {
        this.removeMenuOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay active';
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', () => {
            const hamburger = document.querySelector('.hamburger');
            const navLinks = document.querySelector('.nav-links');
            if (hamburger && navLinks) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                this.removeMenuOverlay();
            }
        });
    }

    removeMenuOverlay() {
        const overlay = document.querySelector('.menu-overlay');
        if (overlay) overlay.remove();
    }

    setupFileUpload() {
        const resumeUpload = document.getElementById('resumeUpload');
        const resumeUploadArea = document.getElementById('resumeUploadArea');

        if (resumeUpload && resumeUploadArea) {
            resumeUploadArea.addEventListener('click', () => resumeUpload.click());
            resumeUpload.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
            
            resumeUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                resumeUploadArea.classList.add('dragover');
            });
            resumeUploadArea.addEventListener('dragleave', () => resumeUploadArea.classList.remove('dragover'));
            resumeUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                resumeUploadArea.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }
    }

    handleFileSelect(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('Please upload a PDF, DOC, or DOCX file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        this.selectedResumeFile = file;
        this.showFilePreview(file);
    }

    showFilePreview(file) {
        const resumePreview = document.getElementById('resumePreview');
        const fileSize = this.formatFileSize(file.size);
        
        if (resumePreview) {
            resumePreview.innerHTML = `
                <div class="file-preview-item">
                    <div class="file-info">
                        <i class="fas fa-file-pdf file-icon"></i>
                        <div>
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${fileSize}</div>
                        </div>
                    </div>
                    <button class="remove-file" onclick="dashboard.removeResumeFile()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            resumePreview.classList.add('show');
        }
    }

    removeResumeFile() {
        this.selectedResumeFile = null;
        const resumePreview = document.getElementById('resumePreview');
        const resumeUpload = document.getElementById('resumeUpload');
        
        if (resumePreview) {
            resumePreview.classList.remove('show');
            resumePreview.innerHTML = '';
        }
        if (resumeUpload) resumeUpload.value = '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadDashboardData() {
        try {
            if (this.currentUser) {
                await this.loadUserProfile();
                await this.loadApplications();
                await this.loadJobMatches();
                this.updateGreeting();
            } else {
                this.initializeEmptyData();
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadUserProfile() {
        if (!this.firebaseInitialized || !this.currentUser) {
            this.initializeEmptyData();
            return;
        }

        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('seekers').doc(this.currentUser.uid).get();

            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.renderUserProfile();
                this.calculateProfileCompletion();
            } else {
                this.showProfileSetupPrompt();
                this.initializeEmptyData();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.initializeEmptyData();
        }
    }

    showProfileSetupPrompt() {
        const existingPrompt = document.querySelector('.profile-setup-prompt');
        if (existingPrompt) return;

        const prompt = document.createElement('div');
        prompt.className = 'profile-setup-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <i class="fas fa-user-plus"></i>
                <span>Complete your profile to get better job matches</span>
                <a href="seeker_edit_profile.html" class="btn-setup">Setup Profile</a>
            </div>
        `;
        
        const dashboardHeader = document.querySelector('.dashboard-header');
        if (dashboardHeader) {
            dashboardHeader.parentNode.insertBefore(prompt, dashboardHeader);
        }
    }

    initializeEmptyData() {
        this.userProfile = {
            fullName: "Guest User",
            professionalTitle: "Update your profile",
            location: "Location not set",
            highestEducation: "Not specified",
            totalExperience: "Not specified",
            skills: ["Add your skills"],
            stats: { applied: 0, matches: 0 }
        };

        this.jobsData = [];
        this.filteredJobs = [];
        this.applicationsData = [];

        this.renderUserProfile();
        this.renderStats();
        this.renderJobsFeed();
        this.renderApplications();
    }

    async loadApplications() {
        if (!this.firebaseInitialized || !this.currentUser) {
            this.applicationsData = [];
            this.renderApplications();
            return;
        }

        try {
            const db = firebase.firestore();
            let applicationsSnapshot;
            try {
                applicationsSnapshot = await db
                    .collection('applications')
                    .where('seekerId', '==', this.currentUser.uid)
                    .orderBy('appliedDate', 'desc')
                    .limit(5)
                    .get();
            } catch (indexError) {
                console.log('Index not ready, using simple query:', indexError);
                applicationsSnapshot = await db
                    .collection('applications')
                    .where('seekerId', '==', this.currentUser.uid)
                    .limit(5)
                    .get();
            }

            this.applicationsData = [];
            applicationsSnapshot.forEach(doc => {
                const applicationData = doc.data();
                this.applicationsData.push({ id: doc.id, ...applicationData });
            });

            if (this.applicationsData.length > 0 && this.applicationsData[0].appliedDate) {
                this.applicationsData.sort((a, b) => {
                    const dateA = a.appliedDate?.toDate?.() || new Date(0);
                    const dateB = b.appliedDate?.toDate?.() || new Date(0);
                    return dateB - dateA;
                });
            }

            this.renderApplications();
        } catch (error) {
            console.error('Error loading applications:', error);
            this.applicationsData = [];
            this.renderApplications();
        }
    }

    async loadJobMatches() {
        if (!this.firebaseInitialized) {
            this.jobsData = [];
            this.filteredJobs = [];
            this.renderJobsFeed();
            return;
        }

        this.showJobsLoading();

        try {
            const db = firebase.firestore();
            const jobsSnapshot = await db
                .collection('jobs')
                .where('status', '==', 'active')
                .get();

            console.log('Jobs snapshot:', jobsSnapshot.size, 'jobs found');

            this.jobsData = [];
            for (const doc of jobsSnapshot.docs) {
                const jobData = doc.data();
                let employerData = null;
                if (jobData.employerId) {
                    employerData = await this.loadEmployerData(jobData.employerId);
                }
                
                this.jobsData.push({
                    id: doc.id,
                    ...jobData,
                    employerData: employerData
                });
            }

            await this.calculateJobMatches();
            this.renderJobsFeed();
        } catch (error) {
            console.error('Error loading jobs:', error);
            this.jobsData = [];
            this.filteredJobs = [];
            this.renderJobsFeed();
        }
    }

    async loadEmployerData(employerId) {
        if (this.employersData.has(employerId)) {
            return this.employersData.get(employerId);
        }

        try {
            const db = firebase.firestore();
            let employerDoc = await db.collection('companies').doc(employerId).get();
            if (employerDoc.exists) {
                const data = employerDoc.data();
                this.employersData.set(employerId, data);
                return data;
            }
            
            employerDoc = await db.collection('users').doc(employerId).get();
            if (employerDoc.exists) {
                const data = employerDoc.data();
                this.employersData.set(employerId, data);
                return data;
            }
            
            console.log('No employer data found for:', employerId);
            return null;
        } catch (error) {
            console.error('Error loading employer data:', error);
            return null;
        }
    }

    async calculateJobMatches() {
        if (!this.userProfile) {
            this.filteredJobs = [];
            this.renderStats();
            return;
        }

        this.filteredJobs = this.jobsData.map(job => {
            const companyName = this.getCompanyName(job);
            const companyLogo = this.getCompanyLogo(job);
            const posterUrl = job.posterUrl;
            const matchScore = this.calculateMatchScore(job);
            
            return {
                ...job,
                company: companyName,
                companyLogo: companyLogo,
                posterUrl: posterUrl,
                matchScore: matchScore
            };
        }).filter(job => job.matchScore >= 30)
          .sort((a, b) => b.matchScore - a.matchScore);

        this.renderStats();
    }

    getCompanyName(job) {
        if (job.employerData) {
            return job.employerData.companyName || 
                   job.employerData.fullName || 
                   'Company not specified';
        }
        
        return job.company || 
               job.companyName || 
               job.employerName || 
               job.employer || 
               job.postedByCompany ||
               'Company not specified';
    }

    getCompanyLogo(job) {
        if (job.employerData) {
            return job.employerData.logoUrl || 
                   job.employerData.profilePicture ||
                   `https://via.placeholder.com/50x50/3498db/ffffff?text=${this.getCompanyName(job).charAt(0).toUpperCase()}`;
        }
        
        return job.companyLogo || 
               job.logo || 
               job.companyImage || 
               job.employerLogo ||
               `https://via.placeholder.com/50x50/3498db/ffffff?text=${this.getCompanyName(job).charAt(0).toUpperCase()}`;
    }

    getEmployerContactInfo(job) {
        if (!job.employerData) {
            return {
                email: 'Not available',
                phone: 'Not available',
                website: 'Not available',
                address: 'Not available',
                description: 'No description available',
                industry: 'Not specified',
                socialMedia: {}
            };
        }

        const employer = job.employerData;
        return {
            email: employer.email || employer.contactEmail || 'Not available',
            phone: employer.phone || employer.contactPhone || 'Not available',
            website: employer.website || employer.companyWebsite || 'Not available',
            address: employer.address || employer.location || employer.companyAddress || 'Not available',
            description: employer.description || employer.about || employer.companyDescription || 'No description available',
            industry: employer.industry || employer.companyIndustry || 'Not specified',
            socialMedia: {
                linkedin: employer.linkedin || employer.linkedIn || '',
                twitter: employer.twitter || '',
                facebook: employer.facebook || '',
                instagram: employer.instagram || ''
            }
        };
    }

    createSocialMediaHTML(socialMedia) {
        let html = '';
        if (socialMedia.linkedin) {
            html += `<a href="${socialMedia.linkedin}" target="_blank" class="social-link linkedin">
                        <i class="fab fa-linkedin"></i>
                    </a>`;
        }
        if (socialMedia.twitter) {
            html += `<a href="${socialMedia.twitter}" target="_blank" class="social-link twitter">
                        <i class="fab fa-twitter"></i>
                    </a>`;
        }
        if (socialMedia.facebook) {
            html += `<a href="${socialMedia.facebook}" target="_blank" class="social-link facebook">
                        <i class="fab fa-facebook"></i>
                    </a>`;
        }
        if (socialMedia.instagram) {
            html += `<a href="${socialMedia.instagram}" target="_blank" class="social-link instagram">
                        <i class="fab fa-instagram"></i>
                    </a>`;
        }
        
        return html ? `
            <div class="social-media-links">
                <h6>Follow Us</h6>
                <div class="social-icons">
                    ${html}
                </div>
            </div>
        ` : '';
    }

    calculateMatchScore(job) {
        if (!this.userProfile) return 0;

        let score = 0;
        let totalWeight = 0;

        // Skills Match (40% weight)
        if (this.userProfile.skills && job.requiredSkills && job.requiredSkills.length > 0) {
            const userSkills = this.userProfile.skills.map(skill => skill.toLowerCase().trim());
            const jobSkills = job.requiredSkills.map(skill => skill.toLowerCase().trim());
            
            const matchingSkills = jobSkills.filter(jobSkill => 
                userSkills.some(userSkill => 
                    userSkill.includes(jobSkill) || jobSkill.includes(userSkill) ||
                    this.calculateSimilarity(userSkill, jobSkill) > 0.7
                )
            );
            
            const skillsScore = (matchingSkills.length / jobSkills.length) * 100;
            score += skillsScore * 0.4;
            totalWeight += 0.4;
        }

        // Experience Match (20% weight)
        if (this.userProfile.totalExperience && job.experienceLevel) {
            const experienceLevels = {
                'none': 0,
                '0-1': 1,
                '1-3': 2,
                '3-5': 3,
                '5-10': 4,
                '10+': 5
            };
            
            const userExpLevel = experienceLevels[this.userProfile.totalExperience] || 0;
            const jobExpLevel = experienceLevels[job.experienceLevel] || 0;
            
            let experienceScore = 0;
            if (userExpLevel >= jobExpLevel) {
                experienceScore = 100;
            } else if (userExpLevel > 0) {
                experienceScore = (userExpLevel / jobExpLevel) * 100;
            }
            
            score += experienceScore * 0.2;
            totalWeight += 0.2;
        }

        // Education Match (15% weight)
        if (this.userProfile.highestEducation && job.educationLevel) {
            const educationLevels = {
                'high_school': 1,
                'certificate': 2,
                'diploma': 3,
                'associate': 4,
                'bachelor': 5,
                'master': 6,
                'phd': 7
            };
            
            const userEduLevel = educationLevels[this.userProfile.highestEducation] || 0;
            const jobEduLevel = educationLevels[job.educationLevel] || 0;
            
            let educationScore = 0;
            if (userEduLevel >= jobEduLevel) {
                educationScore = 100;
            } else if (userEduLevel > 0) {
                educationScore = (userEduLevel / jobEduLevel) * 100;
            }
            
            score += educationScore * 0.15;
            totalWeight += 0.15;
        }

        // Job Type Preference (10% weight)
        if (this.userProfile.jobTypes && job.jobType) {
            const preferredTypes = this.userProfile.jobTypes || [];
            if (preferredTypes.includes(job.jobType)) {
                score += 100 * 0.1;
            }
            totalWeight += 0.1;
        }

        // Location Match (10% weight)
        if (this.userProfile.location && job.location) {
            const userLocation = this.userProfile.location.toLowerCase();
            const jobLocation = job.location.toLowerCase();
            
            if (userLocation.includes(jobLocation) || jobLocation.includes(userLocation)) {
                score += 100 * 0.1;
            } else {
                const userWords = userLocation.split(/[,\s]+/);
                const jobWords = jobLocation.split(/[,\s]+/);
                const commonWords = userWords.filter(word => 
                    jobWords.some(jobWord => this.calculateSimilarity(word, jobWord) > 0.8)
                );
                
                if (commonWords.length > 0) {
                    score += (commonWords.length / Math.max(userWords.length, jobWords.length)) * 100 * 0.1;
                }
            }
            totalWeight += 0.1;
        }

        // Salary Expectations (5% weight)
        if (this.userProfile.desiredSalary && job.salary) {
            const userSalaryRange = this.parseSalary(this.userProfile.desiredSalary);
            const jobSalaryRange = this.parseSalary(job.salary);
            
            if (userSalaryRange && jobSalaryRange) {
                const salaryOverlap = this.calculateSalaryOverlap(userSalaryRange, jobSalaryRange);
                score += salaryOverlap * 0.05;
            }
            totalWeight += 0.05;
        }

        const normalizedScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
        return Math.max(0, Math.min(100, normalizedScore));
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

    parseSalary(salaryString) {
        if (!salaryString) return null;
        
        const numbers = salaryString.match(/\d+/g);
        if (!numbers || numbers.length < 2) return null;
        
        const min = parseInt(numbers[0]) * (salaryString.toLowerCase().includes('k') ? 1000 : 1);
        const max = parseInt(numbers[1]) * (salaryString.toLowerCase().includes('k') ? 1000 : 1);
        
        return { min, max };
    }

    calculateSalaryOverlap(userRange, jobRange) {
        const overlapMin = Math.max(userRange.min, jobRange.min);
        const overlapMax = Math.min(userRange.max, jobRange.max);
        
        if (overlapMin > overlapMax) return 0;
        
        const overlapLength = overlapMax - overlapMin;
        const userRangeLength = userRange.max - userRange.min;
        
        return (overlapLength / userRangeLength) * 100;
    }

    renderUserProfile() {
        if (!this.userProfile) return;

        const userName = document.getElementById('userName');
        const userTitle = document.getElementById('userTitle');
        const userLocation = document.getElementById('userLocation');
        const userEducation = document.getElementById('userEducation');
        const userExperience = document.getElementById('userExperience');
        const skillsContainer = document.getElementById('userSkills');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) userName.textContent = this.userProfile.fullName || 'Guest User';
        if (userTitle) userTitle.textContent = this.userProfile.professionalTitle || 'Update your profile';
        if (userLocation) userLocation.textContent = this.userProfile.location || 'Location not set';
        
        if (userEducation) userEducation.textContent = this.getEducationLabel(this.userProfile.highestEducation);
        if (userExperience) userExperience.textContent = this.getExperienceLabel(this.userProfile.totalExperience);
        
        if (skillsContainer) {
            if (this.userProfile.skills && this.userProfile.skills.length > 0) {
                skillsContainer.innerHTML = this.userProfile.skills
                    .slice(0, 5)
                    .map(skill => `<span class="skill-tag">${skill}</span>`)
                    .join('');
            } else {
                skillsContainer.innerHTML = '<span class="skill-tag">No skills added</span>';
            }
        }

        if (userAvatar && this.userProfile.profilePicture) {
            userAvatar.src = this.userProfile.profilePicture;
        }
    }

    renderStats() {
        const appliedJobs = document.getElementById('appliedJobs');
        const matchedJobs = document.getElementById('matchedJobs');
        const totalMatches = document.getElementById('totalMatches');
        const totalApplications = document.getElementById('totalApplications');
        const matchScore = document.getElementById('matchScore');
        const matchCount = document.getElementById('matchCount');

        if (appliedJobs) appliedJobs.textContent = this.applicationsData.length;
        if (matchedJobs) matchedJobs.textContent = this.filteredJobs.length;
        if (totalMatches) totalMatches.textContent = this.filteredJobs.length;
        if (totalApplications) totalApplications.textContent = this.applicationsData.length;
        
        const avgMatchScore = this.filteredJobs.length > 0 
            ? Math.round(this.filteredJobs.reduce((sum, job) => sum + job.matchScore, 0) / this.filteredJobs.length)
            : 0;
        
        if (matchScore) matchScore.textContent = `${avgMatchScore}%`;
        if (matchCount) matchCount.textContent = `${this.filteredJobs.length} matches found`;
    }

    renderJobsFeed() {
        const jobsFeed = document.getElementById('jobsFeed');
        const matchCount = document.getElementById('matchCount');

        this.hideJobsLoading();

        if (!jobsFeed) return;

        if (this.filteredJobs.length === 0) {
            jobsFeed.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>No matching jobs found</h3>
                    <p>We couldn't find any jobs that match your current profile. Try updating your skills or preferences.</p>
                    <div class="empty-actions">
                        <a href="seeker_edit_profile.html" class="btn-primary">Update Your Profile</a>
                        <a href="browse_jobs.html" class="btn-secondary">Browse All Jobs</a>
                    </div>
                </div>
            `;
        } else {
            jobsFeed.innerHTML = this.filteredJobs.map(job => {
                const companyName = this.getCompanyName(job);
                const companyLogo = this.getCompanyLogo(job);
                const posterUrl = job.posterUrl;
                const jobPosterHTML = this.createJobPosterHTML(job);
                
                return `
                <div class="job-card" data-job-id="${job.id}">
                    <div class="job-card-header">
                        <div class="job-title-section">
                            <div class="company-logo-container">
                                <img src="${companyLogo}" 
                                     alt="${companyName} Logo" 
                                     class="company-logo"
                                     onerror="this.src='https://via.placeholder.com/50x50/3498db/ffffff?text=${companyName.charAt(0).toUpperCase()}'">
                            </div>
                            <div class="job-title-info">
                                <h3>${job.title || 'No Title'}</h3>
                                <p class="job-company" onclick="dashboard.showEmployerDetails('${job.id}')">
                                    <i class="fas fa-building"></i>
                                    ${companyName}
                                </p>
                                <p class="job-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${job.location || 'Location not specified'}
                                </p>
                            </div>
                        </div>
                        <div class="job-match-score">
                            ${job.matchScore}% Match
                        </div>
                    </div>
                    
                    ${jobPosterHTML}
                    
                    <div class="job-meta">
                        <span class="job-type">${this.getJobTypeLabel(job.jobType)}</span>
                        <span class="job-salary">${job.salary || 'Salary not specified'}</span>
                        <span class="job-experience">${this.getExperienceLabel(job.experienceLevel)}</span>
                    </div>
                    <p class="job-description">${job.description ? job.description.substring(0, 150) + '...' : 'No description available'}</p>
                    <div class="job-skills">
                        ${job.requiredSkills ? job.requiredSkills.slice(0, 6).map(skill => 
                            `<span class="job-skill">${skill}</span>`
                        ).join('') : ''}
                        ${job.requiredSkills && job.requiredSkills.length > 6 ? 
                            `<span class="job-skill">+${job.requiredSkills.length - 6} more</span>` : ''
                        }
                    </div>
                    <div class="job-match-breakdown">
                        <small>Match based on: Skills, Experience, Location, Salary</small>
                    </div>
                    <div class="job-actions">
                        <button class="btn-apply" onclick="dashboard.showApplicationModal('${job.id}')">
                            Apply Now
                        </button>
                        <button class="btn-save" onclick="dashboard.saveJob('${job.id}')">
                            <i class="fas fa-bookmark"></i> Save
                        </button>
                        <button class="btn-contact-employer" onclick="dashboard.showEmployerDetails('${job.id}')">
                            <i class="fas fa-envelope"></i> Contact
                        </button>
                        <button class="btn-view-details" onclick="dashboard.showJobDetails('${job.id}')">
                            View Details
                        </button>
                    </div>
                </div>
                `;
            }).join('');
        }

        if (matchCount) {
            matchCount.textContent = `${this.filteredJobs.length} matches found`;
        }
    }

    createJobPosterHTML(job) {
        const posterUrl = job.posterUrl;
        
        if (posterUrl && posterUrl.trim() !== '' && posterUrl !== 'https://via.placeholder.com/150x150?text=Job+Image') {
            return `
                <div class="job-poster-container" data-job-id="${job.id}" onclick="dashboard.showJobImageModal('${job.id}')">
                    <img src="${posterUrl}" 
                         alt="${job.title || 'Job Poster'}" 
                         class="job-poster-image"
                         onerror="this.onerror=null; this.parentElement.outerHTML=window.dashboard.createNoPosterHTML('${job.id}');">
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
            </div>
        `;
    }

    showJobImageModal(jobId) {
        const job = this.jobsData.find(j => j.id === jobId);
        if (!job || !job.posterUrl) return;

        const modal = document.createElement('div');
        modal.className = 'modal job-image-modal';
        modal.style.display = 'block';
        
        const companyName = this.getCompanyName(job);
        const companyLogo = this.getCompanyLogo(job);
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${job.title || 'Job Poster'}</h3>
                    <span class="modal-close">&times;</span>
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

        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    renderApplications() {
        const applicationsList = document.getElementById('applicationsList');
        this.hideApplicationsLoading();

        if (!applicationsList) return;

        if (this.applicationsData.length === 0) {
            applicationsList.innerHTML = `
                <div class="empty-applications">
                    <i class="fas fa-file-alt"></i>
                    <p>No applications yet</p>
                    <small>Start applying to jobs to see your applications here</small>
                </div>
            `;
        } else {
            applicationsList.innerHTML = this.applicationsData.map(application => `
                <div class="application-card">
                    <div class="application-header">
                        <div class="application-job-info">
                            <h4>${application.jobTitle || 'Unknown Job'}</h4>
                            <p class="application-company">${application.companyName || 'Unknown Company'}</p>
                            <p class="application-date">
                                Applied on ${application.appliedDate ? new Date(application.appliedDate.toDate()).toLocaleDateString() : 'Unknown date'}
                            </p>
                        </div>
                        <span class="application-status status-${application.status || 'pending'}">
                            ${this.getStatusLabel(application.status)}
                        </span>
                    </div>
                </div>
            `).join('');
        }
    }

    calculateProfileCompletion() {
        if (!this.userProfile) return 0;

        let completion = 0;
        const fields = [
            'fullName', 'professionalTitle', 'email', 'location', 
            'highestEducation', 'totalExperience', 'currentStatus', 'skills'
        ];

        fields.forEach(field => {
            if (this.userProfile[field]) {
                if (Array.isArray(this.userProfile[field])) {
                    if (this.userProfile[field].length > 0) completion += 12.5;
                } else if (this.userProfile[field].toString().trim() !== '') {
                    completion += 12.5;
                }
            }
        });

        const progressFill = document.getElementById('profileProgressFill');
        const completionPercent = document.getElementById('profileCompletion');
        
        if (progressFill) progressFill.style.width = `${completion}%`;
        if (completionPercent) completionPercent.textContent = `${Math.round(completion)}%`;

        return completion;
    }

    updateGreeting() {
        const greetingMessage = document.getElementById('greetingMessage');
        const subtitle = document.getElementById('dashboardSubtitle');

        if (!greetingMessage || !subtitle) return;

        const hour = new Date().getHours();
        let greeting = 'Welcome back';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        greetingMessage.textContent = `${greeting}, ${this.userProfile?.fullName?.split(' ')[0] || 'there'}!`;
        
        if (this.filteredJobs.length > 0) {
            subtitle.textContent = `We found ${this.filteredJobs.length} jobs matching your profile`;
        }
    }

    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredJobs = [...this.jobsData.map(job => ({
                ...job,
                company: this.getCompanyName(job),
                companyLogo: this.getCompanyLogo(job),
                posterUrl: job.posterUrl,
                matchScore: this.calculateMatchScore(job)
            })).filter(job => job.matchScore >= 30)];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredJobs = this.jobsData
                .map(job => ({
                    ...job,
                    company: this.getCompanyName(job),
                    companyLogo: this.getCompanyLogo(job),
                    posterUrl: job.posterUrl,
                    matchScore: this.calculateMatchScore(job)
                }))
                .filter(job => 
                    job.matchScore >= 30 &&
                    (job.title?.toLowerCase().includes(term) ||
                     job.company?.toLowerCase().includes(term) ||
                     job.description?.toLowerCase().includes(term) ||
                     (job.requiredSkills && job.requiredSkills.some(skill => 
                         skill.toLowerCase().includes(term)))
                    )
                );
        }
        this.renderJobsFeed();
    }

    handleFilter(filterType) {
        if (filterType === 'all') {
            this.filteredJobs = [...this.jobsData.map(job => ({
                ...job,
                company: this.getCompanyName(job),
                companyLogo: this.getCompanyLogo(job),
                posterUrl: job.posterUrl,
                matchScore: this.calculateMatchScore(job)
            })).filter(job => job.matchScore >= 30)];
        } else {
            this.filteredJobs = this.jobsData
                .map(job => ({
                    ...job,
                    company: this.getCompanyName(job),
                    companyLogo: this.getCompanyLogo(job),
                    posterUrl: job.posterUrl,
                    matchScore: this.calculateMatchScore(job)
                }))
                .filter(job => job.matchScore >= 30 && job.jobType === filterType);
        }
        this.renderJobsFeed();
    }

    async refreshJobMatches() {
        const refreshBtn = document.getElementById('refreshMatchesBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
        }

        await this.loadJobMatches();

        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Matches';
                refreshBtn.disabled = false;
            }
            this.showToast('Job matches refreshed successfully', 'success');
        }, 1000);
    }

    showJobDetails(jobId) {
        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) return;

        const jobDetailsModal = document.getElementById('jobDetailsModal');
        const jobDetailsContent = document.getElementById('jobDetailsContent');
        const jobDetailsTitle = document.getElementById('jobDetailsTitle');

        const companyName = this.getCompanyName(job);
        const companyLogo = this.getCompanyLogo(job);

        if (jobDetailsTitle) jobDetailsTitle.textContent = job.title || 'Job Details';
        
        if (jobDetailsContent) {
            jobDetailsContent.innerHTML = `
                <div class="job-header-with-logo">
                    <div class="company-logo-large">
                        <img src="${companyLogo}" 
                             alt="${companyName} Logo"
                             onerror="this.src='https://via.placeholder.com/60x60/3498db/ffffff?text=${companyName.charAt(0).toUpperCase()}'">
                    </div>
                    <div class="job-header-info">
                        <h4>${job.title || 'No Title'}</h4>
                        <p class="company-name-large" onclick="dashboard.showEmployerDetails('${job.id}')">
                            ${companyName}
                        </p>
                    </div>
                </div>
                
                <div class="job-details-meta">
                    <div class="job-detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${job.location || 'Location not specified'}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${this.getJobTypeLabel(job.jobType)}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-money-bill-wave"></i>
                        <span>${job.salary || 'Salary not specified'}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-briefcase"></i>
                        <span>${this.getExperienceLabel(job.experienceLevel)}</span>
                    </div>
                    <div class="job-detail-item">
                        <i class="fas fa-graduation-cap"></i>
                        <span>${this.getEducationLabel(job.educationLevel)}</span>
                    </div>
                </div>

                <div class="job-details-section">
                    <h5>Job Description</h5>
                    <p>${job.description || 'No description available.'}</p>
                </div>

                ${job.responsibilities ? `
                <div class="job-details-section">
                    <h5>Key Responsibilities</h5>
                    <ul class="job-requirements-list">
                        ${job.responsibilities.map(resp => `<li><i class="fas fa-check"></i> ${resp}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${job.requiredSkills ? `
                <div class="job-details-section">
                    <h5>Required Skills</h5>
                    <div class="job-skills">
                        ${job.requiredSkills.map(skill => `<span class="job-skill">${skill}</span>`).join('')}
                    </div>
                </div>
                ` : ''}

                ${job.benefits ? `
                <div class="job-details-section">
                    <h5>Benefits</h5>
                    <ul class="job-requirements-list">
                        ${job.benefits.map(benefit => `<li><i class="fas fa-check"></i> ${benefit}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="job-details-actions">
                    <button class="btn btn-primary" onclick="dashboard.showApplicationModal('${job.id}')">
                        Apply Now
                    </button>
                    <button class="btn btn-outline" onclick="dashboard.saveJob('${job.id}')">
                        <i class="fas fa-bookmark"></i> Save Job
                    </button>
                    <button class="btn btn-outline" onclick="dashboard.showEmployerDetails('${job.id}')">
                        <i class="fas fa-building"></i> View Employer
                    </button>
                </div>
            `;
        }

        if (jobDetailsModal) jobDetailsModal.classList.add('show');
    }

    hideJobDetailsModal() {
        const jobDetailsModal = document.getElementById('jobDetailsModal');
        if (jobDetailsModal) jobDetailsModal.classList.remove('show');
    }

    // EMPLOYER DETAILS MODAL - FIXED AND WORKING
    showEmployerDetails(jobId) {
        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) {
            console.error('Job not found:', jobId);
            return;
        }

        const employerModal = document.getElementById('employerModal');
        const employerContent = document.getElementById('employerContent');
        const employerTitle = document.getElementById('employerTitle');

        const companyName = this.getCompanyName(job);
        const companyLogo = this.getCompanyLogo(job);
        const contactInfo = this.getEmployerContactInfo(job);

        console.log('Employer data for job:', jobId, job.employerData);
        console.log('Contact info:', contactInfo);

        if (employerTitle) employerTitle.textContent = companyName;
        
        if (employerContent) {
            const socialMediaHTML = this.createSocialMediaHTML(contactInfo.socialMedia);
            
            employerContent.innerHTML = `
                <div class="employer-header">
                    <div class="employer-logo-large">
                        <img src="${companyLogo}" 
                             alt="${companyName} Logo"
                             onerror="this.src='https://via.placeholder.com/80x80/3498db/ffffff?text=${companyName.charAt(0).toUpperCase()}'">
                    </div>
                    <div class="employer-header-info">
                        <h4>${companyName}</h4>
                        <p class="employer-industry">${contactInfo.industry}</p>
                        <p class="employer-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${contactInfo.address}
                        </p>
                    </div>
                </div>

                <div class="employer-contact-info">
                    <h5>Contact Information</h5>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <span class="contact-label">Email:</span>
                        <span class="contact-value">
                            ${contactInfo.email !== 'Not available' ? 
                                `<a href="mailto:${contactInfo.email}">${contactInfo.email}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span class="contact-label">Phone:</span>
                        <span class="contact-value">
                            ${contactInfo.phone !== 'Not available' ? 
                                `<a href="tel:${contactInfo.phone}">${contactInfo.phone}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-globe"></i>
                        <span class="contact-label">Website:</span>
                        <span class="contact-value">
                            ${contactInfo.website !== 'Not available' ? 
                                `<a href="${contactInfo.website}" target="_blank">${contactInfo.website}</a>` : 
                                'Not available'}
                        </span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="contact-label">Address:</span>
                        <span class="contact-value">${contactInfo.address}</span>
                    </div>
                </div>

                <div class="employer-description">
                    <h5>About ${companyName}</h5>
                    <p>${contactInfo.description}</p>
                </div>

                ${socialMediaHTML}

                <div class="employer-actions">
                    <button class="btn btn-primary" onclick="dashboard.showApplicationModal('${job.id}')">
                        Apply to Job
                    </button>
                    ${contactInfo.email !== 'Not available' ? `
                    <a href="mailto:${contactInfo.email}?subject=Regarding ${job.title || 'Job Application'}" class="btn btn-outline">
                        <i class="fas fa-envelope"></i> Send Email
                    </a>
                    ` : ''}
                    ${contactInfo.phone !== 'Not available' ? `
                    <a href="tel:${contactInfo.phone}" class="btn btn-outline">
                        <i class="fas fa-phone"></i> Call Now
                    </a>
                    ` : ''}
                </div>
            `;
        }

        if (employerModal) {
            employerModal.classList.add('show');
            employerModal.style.display = 'flex';
        }
    }

    hideEmployerModal() {
        const employerModal = document.getElementById('employerModal');
        if (employerModal) {
            employerModal.classList.remove('show');
            employerModal.style.display = 'none';
        }
    }

    showApplicationModal(jobId) {
        if (!this.currentUser) {
            this.showToast('Please log in to apply for jobs', 'error');
            return;
        }

        const job = this.jobsData.find(j => j.id === jobId);
        if (!job) return;

        const companyName = this.getCompanyName(job);
        const modalJobTitle = document.getElementById('modalJobTitle');
        const applicationModal = document.getElementById('applicationModal');

        if (modalJobTitle) modalJobTitle.textContent = job.title || 'this position';
        if (applicationModal) applicationModal.classList.add('show');
        this.currentJobApplication = jobId;
    }

    hideApplicationModal() {
        const applicationModal = document.getElementById('applicationModal');
        const applicationMessage = document.getElementById('applicationMessage');

        if (applicationModal) applicationModal.classList.remove('show');
        if (applicationMessage) applicationMessage.value = '';
        this.currentJobApplication = null;
        this.removeResumeFile();
    }

    async submitApplication() {
        if (!this.currentJobApplication || !this.currentUser) return;

        const submitBtn = document.getElementById('submitApplication');
        const applicationMessage = document.getElementById('applicationMessage');

        if (!submitBtn || !applicationMessage) return;

        const message = applicationMessage.value;

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const job = this.jobsData.find(j => j.id === this.currentJobApplication);
            if (!job) {
                throw new Error('Job not found');
            }
            
            const companyName = this.getCompanyName(job);
            
            let resumeUrl = null;
            let resumeFileName = null;

            if (this.selectedResumeFile) {
                const storageRef = firebase.storage().ref();
                const resumeRef = storageRef.child(`resumes/${this.currentUser.uid}/${Date.now()}_${this.selectedResumeFile.name}`);
                const uploadTask = await resumeRef.put(this.selectedResumeFile);
                resumeUrl = await uploadTask.ref.getDownloadURL();
                resumeFileName = this.selectedResumeFile.name;
            }

            const applicationData = {
                seekerId: this.currentUser.uid,
                jobId: this.currentJobApplication,
                jobTitle: job.title || 'Unknown Position',
                companyName: companyName,
                appliedDate: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                coverLetter: message || '',
                hasResume: !!resumeUrl,
                profileUsed: !resumeUrl
            };

            if (resumeUrl) {
                applicationData.resumeUrl = resumeUrl;
                applicationData.resumeFileName = resumeFileName;
            }

            const db = firebase.firestore();
            await db.collection('applications').add(applicationData);

            this.showToast('Application submitted successfully!', 'success');
            this.hideApplicationModal();
            
            await this.loadApplications();
        } catch (error) {
            console.error('Error submitting application:', error);
            this.showToast('Failed to submit application. Please try again.', 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    async saveJob(jobId) {
        if (!this.currentUser) {
            this.showToast('Please log in to save jobs', 'error');
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('savedJobs').add({
                seekerId: this.currentUser.uid,
                jobId: jobId,
                savedDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast('Job saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving job:', error);
            this.showToast('Failed to save job. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            await firebase.auth().signOut();
            this.showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } catch (error) {
            console.error('Error signing out:', error);
            this.showToast('Error signing out', 'error');
        }
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
        return educationLabels[education] || 'Not specified';
    }

    getExperienceLabel(experience) {
        const experienceLabels = {
            'none': 'No experience',
            '0-1': '0-1 years',
            '1-3': '1-3 years',
            '3-5': '3-5 years',
            '5-10': '5-10 years',
            '10+': '10+ years'
        };
        return experienceLabels[experience] || 'Not specified';
    }

    getJobTypeLabel(jobType) {
        const jobTypeLabels = {
            'full-time': 'Full-time',
            'part-time': 'Part-time',
            'contract': 'Contract',
            'remote': 'Remote',
            'internship': 'Internship'
        };
        return jobTypeLabels[jobType] || jobType;
    }

    getStatusLabel(status) {
        const statusLabels = {
            'pending': 'Pending',
            'reviewed': 'Under Review',
            'accepted': 'Accepted',
            'rejected': 'Not Selected'
        };
        return statusLabels[status] || 'Pending';
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

    showJobsLoading() {
        const jobsLoading = document.getElementById('jobsLoading');
        if (jobsLoading) jobsLoading.style.display = 'block';
    }

    hideJobsLoading() {
        const jobsLoading = document.getElementById('jobsLoading');
        if (jobsLoading) jobsLoading.style.display = 'none';
    }

    hideApplicationsLoading() {
        const applicationsLoading = document.getElementById('applicationsLoading');
        if (applicationsLoading) applicationsLoading.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
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
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SeekerDashboard();
});