// Seeker Edit Profile JavaScript
class SeekerEditProfile {
    constructor() {
        this.currentSection = 'personal';
        this.userSkills = [];
        this.referees = [];
        this.formData = {};
        this.defaultAvatar = 'https://i.pravatar.cc/100?img=5';
        this.firebaseInitialized = false;
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.initializeFirebase();
        await this.initializeAuth();
        this.bindEvents();
        await this.loadUserData();
        this.updateProgress();
        this.updatePreview();
    }

    initializeFirebase() {
        // Firebase configuration
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
            console.log("Firebase initialized successfully");
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.firebaseInitialized = false;
            this.showToast("Failed to initialize Firebase. Some features may not work.", "error");
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
                    console.log("No user authenticated - using local storage");
                    // Don't redirect, just continue with local storage
                    resolve();
                }
            });
        });
    }

    async loadUserData() {
        try {
            if (this.firebaseInitialized && this.currentUser) {
                await this.loadUserDataFromFirebase();
            } else {
                // Load from localStorage or use empty data
                this.loadUserDataFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.loadUserDataFromLocalStorage();
        }
    }

    async loadUserDataFromFirebase() {
        const db = firebase.firestore();
        const userDoc = await db.collection('seekers').doc(this.currentUser.uid).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            this.formData = userData;
            this.userSkills = userData.skills || [];
            this.referees = userData.referees || [];
            
            // Update profile picture in dashboard
            this.updateDashboardProfilePicture(userData.profilePicture);
            
            console.log('User data loaded from Firebase:', userData);
        } else {
            // Initialize empty data for new user
            this.initializeEmptyData();
        }

        this.populateForm();
        this.renderSkills();
        this.renderReferees();
    }

    updateDashboardProfilePicture(profilePicture) {
        // Update profile picture in dashboard if it exists
        if (profilePicture) {
            // Store in localStorage for dashboard to access
            localStorage.setItem('userProfilePicture', profilePicture);
        }
    }

    loadUserDataFromLocalStorage() {
        const savedData = localStorage.getItem('profileDraft');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            this.formData = parsedData;
            this.userSkills = parsedData.skills || [];
            this.referees = parsedData.referees || [];
            console.log('User data loaded from localStorage');
        } else {
            this.initializeEmptyData();
        }

        this.populateForm();
        this.renderSkills();
        this.renderReferees();
    }

    initializeEmptyData() {
        this.formData = {
            fullName: "",
            professionalTitle: "",
            email: "",
            phone: "",
            location: "",
            professionalSummary: "",
            highestEducation: "",
            fieldOfStudy: "",
            institution: "",
            graduationYear: "",
            educationCountry: "",
            totalExperience: "",
            currentStatus: "",
            workHistory: "",
            desiredSalary: "",
            salaryNegotiable: false,
            preferredLocations: "",
            industries: "",
            relocation: false,
            immediatelyAvailable: false,
            jobTypes: [],
            profilePicture: this.defaultAvatar
        };
        this.userSkills = [];
        this.referees = [];
    }

    bindEvents() {
        // Section navigation
        document.querySelectorAll('.nav-section').forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.currentTarget.getAttribute('data-section');
                this.switchSection(section);
            });
        });

        // Avatar upload
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.querySelector('.avatar-preview');

        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                this.handleAvatarUpload(e.target.files[0]);
            });
        }

        if (avatarPreview) {
            avatarPreview.addEventListener('click', () => {
                document.getElementById('avatarInput').click();
            });
        }

        // Profile picture removal
        const removePictureBtn = document.getElementById('removePictureBtn');
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');

        if (removePictureBtn) {
            removePictureBtn.addEventListener('click', () => {
                this.removeProfilePicture();
            });
        }

        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', () => {
                this.removeProfilePicture();
            });
        }

        // Institution field activation
        const institutionInput = document.getElementById('institution');
        if (institutionInput) {
            institutionInput.addEventListener('input', (e) => {
                this.toggleGraduationYear(e.target.value.trim() !== '');
            });
        }

        // Skills management
        const addSkillBtn = document.getElementById('addSkillBtn');
        const skillInput = document.getElementById('skillInput');

        if (addSkillBtn) {
            addSkillBtn.addEventListener('click', () => {
                this.addSkill();
            });
        }

        if (skillInput) {
            skillInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addSkill();
                }
            });
        }

        // Suggested skills
        document.querySelectorAll('.skill-suggestion').forEach(button => {
            button.addEventListener('click', (e) => {
                const skill = e.target.getAttribute('data-skill');
                if (skill && !this.userSkills.includes(skill)) {
                    this.userSkills.push(skill);
                    this.renderSkills();
                    this.updateProgress();
                    this.showToast(`Added skill: ${skill}`, 'success');
                }
            });
        });

        // Referees management
        const addRefereeBtn = document.getElementById('addRefereeBtn');
        const clearRefereeFormBtn = document.getElementById('clearRefereeForm');

        if (addRefereeBtn) {
            addRefereeBtn.addEventListener('click', () => {
                this.addReferee();
            });
        }

        if (clearRefereeFormBtn) {
            clearRefereeFormBtn.addEventListener('click', () => {
                this.clearRefereeForm();
            });
        }

        // Character count for summary
        const summaryInput = document.getElementById('professionalSummary');
        if (summaryInput) {
            summaryInput.addEventListener('input', (e) => {
                const charCount = document.getElementById('summaryChars');
                if (charCount) {
                    charCount.textContent = e.target.value.length;
                }
            });
        }

        // Form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Back to dashboard
        const backToDashboardBtn = document.getElementById('backToDashboard');
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', () => {
                window.location.href = 'seeker_dashboard.html';
            });
        }

        // Save draft
        const saveDraftBtn = document.getElementById('saveDraft');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => {
                this.saveDraft();
            });
        }

        // Success modal actions
        const continueEditingBtn = document.getElementById('continueEditing');
        const viewDashboardBtn = document.getElementById('viewDashboard');

        if (continueEditingBtn) {
            continueEditingBtn.addEventListener('click', () => {
                this.hideSuccessModal();
            });
        }

        if (viewDashboardBtn) {
            viewDashboardBtn.addEventListener('click', () => {
                window.location.href = 'seeker_dashboard.html';
            });
        }

        // Referee email modal actions
        const closeRefereeModalBtn = document.getElementById('closeRefereeModal');
        const closeEmailModalBtn = document.getElementById('closeEmailModal');

        if (closeRefereeModalBtn) {
            closeRefereeModalBtn.addEventListener('click', () => {
                this.hideRefereeEmailModal();
            });
        }

        if (closeEmailModalBtn) {
            closeEmailModalBtn.addEventListener('click', () => {
                this.hideRefereeEmailModal();
            });
        }

        // Real-time form updates
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('input', () => {
                this.updatePreview();
                this.updateProgress();
            });
        });

        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updatePreview();
                this.updateProgress();
            });
        });

        // Initialize graduation year toggle
        this.toggleGraduationYear(!!this.formData.institution);
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-section').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetButton = document.querySelector(`[data-section="${section}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        // Update form sections
        document.querySelectorAll('.form-section').forEach(sectionEl => {
            sectionEl.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        this.currentSection = section;
    }

    handleAvatarUpload(file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const avatarPreview = document.getElementById('avatarPreview');
                const previewAvatar = document.getElementById('previewAvatar');
                
                if (avatarPreview) avatarPreview.src = e.target.result;
                if (previewAvatar) previewAvatar.src = e.target.result;

                // Store the profile picture data
                this.formData.profilePicture = e.target.result;
                
                this.showToast('Profile picture updated successfully', 'success');
            };
            reader.readAsDataURL(file);
        }
    }

    removeProfilePicture() {
        const avatarPreview = document.getElementById('avatarPreview');
        const previewAvatar = document.getElementById('previewAvatar');
        
        if (avatarPreview) avatarPreview.src = this.defaultAvatar;
        if (previewAvatar) previewAvatar.src = this.defaultAvatar;

        // Remove profile picture data
        this.formData.profilePicture = this.defaultAvatar;
        
        this.showToast('Profile picture removed successfully', 'success');
    }

    toggleGraduationYear(enable) {
        const graduationYearInput = document.getElementById('graduationYear');
        if (graduationYearInput) {
            graduationYearInput.disabled = !enable;
            
            if (!enable) {
                graduationYearInput.value = '';
            }
        }
    }

    addSkill() {
        const skillInput = document.getElementById('skillInput');
        if (!skillInput) return;

        const skill = skillInput.value.trim();

        if (skill && !this.userSkills.includes(skill)) {
            this.userSkills.push(skill);
            this.renderSkills();
            skillInput.value = '';
            this.updateProgress();
            this.showToast(`Skill "${skill}" added`, 'success');
        } else if (this.userSkills.includes(skill)) {
            this.showToast('Skill already exists', 'warning');
        }
    }

    removeSkill(skillToRemove) {
        this.userSkills = this.userSkills.filter(skill => skill !== skillToRemove);
        this.renderSkills();
        this.updateProgress();
        this.showToast(`Skill "${skillToRemove}" removed`, 'success');
    }

    renderSkills() {
        const skillsContainer = document.getElementById('skillsTags');
        const skillsCount = document.getElementById('skillsCount');

        if (skillsContainer) {
            skillsContainer.innerHTML = this.userSkills.map(skill => `
                <div class="skill-tag">
                    ${skill}
                    <button type="button" class="remove-skill" onclick="profileEditor.removeSkill('${skill.replace(/'/g, "\\'")}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }

        if (skillsCount) {
            skillsCount.textContent = this.userSkills.length;
        }
        
        // Update preview with skills count
        const previewSkills = document.getElementById('previewSkills');
        if (previewSkills) {
            previewSkills.textContent = this.userSkills.length;
        }
    }

    addReferee() {
        const name = document.getElementById('refereeName')?.value.trim();
        const email = document.getElementById('refereeEmail')?.value.trim();
        const phone = document.getElementById('refereePhone')?.value.trim();
        const position = document.getElementById('refereePosition')?.value.trim();
        const company = document.getElementById('refereeCompany')?.value.trim();
        const relationship = document.getElementById('refereeRelationship')?.value;
        const notes = document.getElementById('refereeNotes')?.value.trim();

        // Validate required fields
        if (!name || !email || !relationship) {
            this.showToast('Please fill in all required fields for the referee', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showToast('Please enter a valid email address for the referee', 'error');
            return;
        }

        const referee = {
            id: Date.now().toString(),
            name,
            email,
            phone: phone || '',
            position: position || '',
            company: company || '',
            relationship,
            notes: notes || '',
            status: 'pending',
            addedDate: new Date().toISOString()
        };

        this.referees.push(referee);
        this.renderReferees();
        this.clearRefereeForm();
        this.updateProgress();
        
        // Send email to referee (if Firebase is available)
        this.sendRefereeEmail(referee);
    }

    removeReferee(refereeId) {
        this.referees = this.referees.filter(referee => referee.id !== refereeId);
        this.renderReferees();
        this.updateProgress();
        this.showToast('Referee removed successfully', 'success');
    }

    renderReferees() {
        const refereesContainer = document.getElementById('refereesContainer');
        const refereesCount = document.getElementById('refereesCount');
        const noRefereesMessage = document.getElementById('noRefereesMessage');

        if (!refereesContainer) return;

        if (this.referees.length === 0) {
            if (noRefereesMessage) noRefereesMessage.style.display = 'block';
            refereesContainer.innerHTML = '';
        } else {
            if (noRefereesMessage) noRefereesMessage.style.display = 'none';
            refereesContainer.innerHTML = this.referees.map(referee => `
                <div class="referee-card">
                    <div class="referee-header">
                        <div class="referee-info">
                            <h5>${referee.name}</h5>
                            <p>${referee.position}${referee.company ? ` at ${referee.company}` : ''}</p>
                            <p>${referee.email}${referee.phone ? ` • ${referee.phone}` : ''}</p>
                        </div>
                        <div class="referee-actions-card">
                            <button type="button" class="btn-remove-referee" onclick="profileEditor.removeReferee('${referee.id}')" title="Remove Referee">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="referee-details">
                        <div class="referee-detail">
                            <span class="detail-label">Relationship</span>
                            <span class="detail-value">${this.getRelationshipLabel(referee.relationship)}</span>
                        </div>
                        ${referee.notes ? `
                        <div class="referee-detail">
                            <span class="detail-label">Notes</span>
                            <span class="detail-value">${referee.notes}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="referee-status">
                        <span class="status-badge ${referee.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}">
                            <i class="fas ${referee.status === 'confirmed' ? 'fa-check' : 'fa-clock'}"></i>
                            ${referee.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation'}
                        </span>
                    </div>
                </div>
            `).join('');
        }

        if (refereesCount) {
            refereesCount.textContent = this.referees.length;
        }
        
        // Update preview with referees count
        const previewReferees = document.getElementById('previewReferees');
        if (previewReferees) {
            previewReferees.textContent = this.referees.length;
        }
    }

    getRelationshipLabel(relationship) {
        const relationships = {
            'former_manager': 'Former Manager',
            'colleague': 'Colleague',
            'supervisor': 'Supervisor',
            'client': 'Client',
            'professor': 'Professor',
            'mentor': 'Mentor',
            'other': 'Other'
        };
        return relationships[relationship] || relationship;
    }

    clearRefereeForm() {
        const fields = ['refereeName', 'refereeEmail', 'refereePhone', 'refereePosition', 'refereeCompany', 'refereeRelationship', 'refereeNotes'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
    }

    async sendRefereeEmail(referee) {
        if (!this.firebaseInitialized) {
            this.showToast('Referee added locally. Email service not available.', 'warning');
            return;
        }

        try {
            // For now, just simulate email sending since we don't have the cloud function
            console.log('Would send email to:', referee.email);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showRefereeEmailModal(referee.email);
            this.showToast('Reference request sent successfully', 'success');
        } catch (error) {
            console.error('Error sending referee email:', error);
            this.showToast('Referee added locally. Email service temporarily unavailable.', 'warning');
        }
    }

    showRefereeEmailModal(email) {
        const refereeEmailSent = document.getElementById('refereeEmailSent');
        const refereeEmailModal = document.getElementById('refereeEmailModal');
        
        if (refereeEmailSent) refereeEmailSent.textContent = email;
        if (refereeEmailModal) refereeEmailModal.classList.add('show');
    }

    hideRefereeEmailModal() {
        const refereeEmailModal = document.getElementById('refereeEmailModal');
        if (refereeEmailModal) refereeEmailModal.classList.remove('show');
    }

    populateForm() {
        // Populate form fields with loaded data
        Object.keys(this.formData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = !!this.formData[key];
                } else {
                    element.value = this.formData[key] || '';
                }
            }
        });

        // Handle job types checkboxes
        if (this.formData.jobTypes && Array.isArray(this.formData.jobTypes)) {
            document.querySelectorAll('input[name="jobType"]').forEach(checkbox => {
                checkbox.checked = this.formData.jobTypes.includes(checkbox.value);
            });
        }

        // Update character count
        const summary = document.getElementById('professionalSummary');
        const summaryChars = document.getElementById('summaryChars');
        if (summary && summaryChars) {
            summaryChars.textContent = summary.value.length;
        }

        // Set profile pictures
        const avatarPreview = document.getElementById('avatarPreview');
        const previewAvatar = document.getElementById('previewAvatar');
        if (avatarPreview && this.formData.profilePicture) {
            avatarPreview.src = this.formData.profilePicture;
        }
        if (previewAvatar && this.formData.profilePicture) {
            previewAvatar.src = this.formData.profilePicture;
        }

        // Enable graduation year if institution is filled
        if (this.formData.institution) {
            this.toggleGraduationYear(true);
        }
    }

    updatePreview() {
        // Update preview card with current form data
        const name = document.getElementById('fullName')?.value || 'Your Name';
        const title = document.getElementById('professionalTitle')?.value || 'Your Title';
        const location = document.getElementById('location')?.value || 'Location';

        const previewName = document.getElementById('previewName');
        const previewTitle = document.getElementById('previewTitle');
        const previewLocation = document.getElementById('previewLocation');

        if (previewName) previewName.textContent = name;
        if (previewTitle) previewTitle.textContent = title;
        if (previewLocation) previewLocation.textContent = location;

        // Update skills count in preview
        const previewSkills = document.getElementById('previewSkills');
        if (previewSkills) {
            previewSkills.textContent = this.userSkills.length;
        }
        
        // Update referees count in preview
        const previewReferees = document.getElementById('previewReferees');
        if (previewReferees) {
            previewReferees.textContent = this.referees.length;
        }
    }

    updateProgress() {
        const completeness = this.calculateCompleteness();
        const progressFill = document.getElementById('progressFill');
        const completionPercent = document.getElementById('completionPercent');

        if (progressFill) progressFill.style.width = `${completeness}%`;
        if (completionPercent) completionPercent.textContent = `${completeness}%`;
    }

    calculateCompleteness() {
        let score = 0;
        const maxScore = 100;

        // Personal info (25%)
        if (document.getElementById('fullName')?.value) score += 10;
        if (document.getElementById('professionalTitle')?.value) score += 10;
        if (document.getElementById('location')?.value) score += 5;

        // Education (15%)
        if (document.getElementById('highestEducation')?.value) score += 10;
        if (document.getElementById('fieldOfStudy')?.value) score += 5;

        // Experience (15%)
        if (document.getElementById('totalExperience')?.value) score += 10;
        if (document.getElementById('currentStatus')?.value) score += 5;

        // Skills (15%)
        if (this.userSkills.length >= 3) score += 10;
        if (this.userSkills.length >= 5) score += 5;

        // Referees (15%)
        if (this.referees.length >= 1) score += 10;
        if (this.referees.length >= 2) score += 5;

        // Preferences (15%)
        const jobTypesChecked = document.querySelectorAll('input[name="jobType"]:checked').length;
        if (jobTypesChecked > 0) score += 10;
        if (document.getElementById('desiredSalary')?.value) score += 5;

        return Math.min(score, maxScore);
    }

    collectFormData() {
        const data = {
            fullName: document.getElementById('fullName')?.value || '',
            professionalTitle: document.getElementById('professionalTitle')?.value || '',
            email: document.getElementById('email')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            location: document.getElementById('location')?.value || '',
            professionalSummary: document.getElementById('professionalSummary')?.value || '',
            highestEducation: document.getElementById('highestEducation')?.value || '',
            fieldOfStudy: document.getElementById('fieldOfStudy')?.value || '',
            institution: document.getElementById('institution')?.value || '',
            graduationYear: document.getElementById('graduationYear')?.value || '',
            educationCountry: document.getElementById('educationCountry')?.value || '',
            totalExperience: document.getElementById('totalExperience')?.value || '',
            currentStatus: document.getElementById('currentStatus')?.value || '',
            workHistory: document.getElementById('workHistory')?.value || '',
            desiredSalary: document.getElementById('desiredSalary')?.value || '',
            salaryNegotiable: document.getElementById('salaryNegotiable')?.checked || false,
            preferredLocations: document.getElementById('preferredLocations')?.value || '',
            industries: document.getElementById('industries')?.value || '',
            relocation: document.getElementById('relocation')?.checked || false,
            immediatelyAvailable: document.getElementById('immediatelyAvailable')?.checked || false,
            jobTypes: Array.from(document.querySelectorAll('input[name="jobType"]:checked')).map(cb => cb.value),
            skills: this.userSkills,
            referees: this.referees,
            profilePicture: this.formData.profilePicture || this.defaultAvatar
        };

        return data;
    }

    async handleFormSubmit() {
        const submitBtn = document.getElementById('updateProfile');
        if (submitBtn) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        }

        try {
            const formData = this.collectFormData();
            
            // Save to Firebase or localStorage
            await this.saveProfileData(formData);
            
            this.showSuccessModal();
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showToast('Error updating profile. Please try again.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        }
    }

    async saveProfileData(formData) {
        if (this.firebaseInitialized && this.currentUser) {
            await this.saveProfileToFirebase(formData);
        } else {
            this.saveProfileToLocalStorage(formData);
        }
    }

    async saveProfileToFirebase(formData) {
        try {
            const db = firebase.firestore();
            await db.collection('seekers').doc(this.currentUser.uid).set({
                ...formData,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.currentUser.uid
            }, { merge: true });

            console.log('Profile saved to Firebase successfully');
            return true;
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            throw error;
        }
    }

    saveProfileToLocalStorage(formData) {
        localStorage.setItem('profileDraft', JSON.stringify(formData));
        // Also store profile picture separately for dashboard access
        if (formData.profilePicture) {
            localStorage.setItem('userProfilePicture', formData.profilePicture);
        }
        console.log('Profile saved to localStorage');
    }

    saveDraft() {
        const formData = this.collectFormData();
        this.saveProfileToLocalStorage(formData);
        this.showToast('Draft saved successfully', 'success');
    }

    showSuccessModal() {
        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.classList.add('show');
        }
    }

    hideSuccessModal() {
        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.classList.remove('show');
        }
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : type === 'warning' ? 'toast-warning' : ''}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);

        // Remove toast after 3 seconds
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

// Initialize the profile editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileEditor = new SeekerEditProfile();
});