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
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { 
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

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
const storage = getStorage(app);

class JobPosting {
    constructor() {
        this.currentUser = null;
        this.uploadedFile = null;
        this.jobData = null;
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
    }

    async checkAuthState() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
            } else {
                // Redirect to login if not authenticated
                window.location.href = 'login.html';
            }
        });
    }

    bindEvents() {
        const jobForm = document.getElementById('jobForm');
        const fileUploadArea = document.getElementById('fileUploadArea');
        const posterInput = document.getElementById('poster');
        const modalClose = document.getElementById('modalClose');
        const editJobBtn = document.getElementById('editJob');
        const confirmPostBtn = document.getElementById('confirmPost');
        const downloadPosterBtn = document.getElementById('downloadPoster');
        const sharePosterBtn = document.getElementById('sharePoster');
        const viewDashboardBtn = document.getElementById('viewDashboard');
        const postAnotherBtn = document.getElementById('postAnother');
        const browseBtn = document.querySelector('.browse-btn');
        const logoutBtn = document.querySelector('.logout-btn');

        // File upload functionality
        fileUploadArea.addEventListener('click', () => posterInput.click());
        browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            posterInput.click();
        });
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        posterInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Form submission
        jobForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Modal actions
        modalClose.addEventListener('click', () => this.closePreviewModal());
        editJobBtn.addEventListener('click', () => this.closePreviewModal());
        confirmPostBtn.addEventListener('click', () => this.confirmJobPosting());

        // Download and share buttons
        downloadPosterBtn.addEventListener('click', () => this.downloadPoster());
        sharePosterBtn.addEventListener('click', () => this.sharePoster());

        // Success modal actions
        viewDashboardBtn.addEventListener('click', () => window.location.href = 'employer_dashboard.html');
        postAnotherBtn.addEventListener('click', () => this.resetForm());

        // Logout
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Close modals when clicking outside
        document.getElementById('previewModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('previewModal')) {
                this.closePreviewModal();
            }
        });

        document.getElementById('successModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('successModal')) {
                document.getElementById('successModal').classList.remove('show');
            }
        });

        // Real-time validation
        this.setupRealTimeValidation();
    }

    setupRealTimeValidation() {
        const requiredFields = ['jobTitle', 'companyName', 'category', 'location', 'jobType', 'requirements', 'description'];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            field.addEventListener('blur', () => this.validateField(fieldId));
            field.addEventListener('input', () => this.clearFieldError(fieldId));
        });
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        const value = field.value.trim();
        
        if (!value) {
            this.showFieldError(fieldId, 'This field is required');
            return false;
        }
        
        this.clearFieldError(fieldId);
        return true;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const inputGroup = field.closest('.input-group');
        
        inputGroup.classList.add('error');
        
        let errorElement = inputGroup.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            inputGroup.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const inputGroup = field.closest('.input-group');
        
        inputGroup.classList.remove('error');
        const errorElement = inputGroup.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }

    handleFileUpload(file) {
        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('Please upload a PNG or JPG image file', 'error');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        this.uploadedFile = file;
        this.showFilePreview(file);
    }

    showFilePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const posterPreview = document.getElementById('posterPreview');
            posterPreview.innerHTML = `
                <div class="preview-item">
                    <div class="preview-info">
                        <i class="fas fa-file-image"></i>
                        <span>${file.name} (${this.formatFileSize(file.size)})</span>
                    </div>
                    <div class="preview-actions">
                        <button type="button" onclick="jobPosting.removeFile()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            posterPreview.classList.add('show');
        };
        reader.readAsDataURL(file);
    }

    removeFile() {
        this.uploadedFile = null;
        document.getElementById('poster').value = '';
        document.getElementById('posterPreview').classList.remove('show');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        // Show loading state on submit button
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.classList.add('loading');

        try {
            // Collect form data
            this.jobData = this.collectFormData();
            this.updatePreview();
            
            // Hide loading state and show preview
            submitBtn.classList.remove('loading');
            document.getElementById('previewModal').classList.add('show');
            
        } catch (error) {
            submitBtn.classList.remove('loading');
            this.showToast('Error preparing job preview', 'error');
        }
    }

    collectFormData() {
        return {
            jobTitle: document.getElementById('jobTitle').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            category: document.getElementById('category').value,
            location: document.getElementById('location').value.trim(),
            jobType: document.getElementById('jobType').value,
            salary: document.getElementById('salary').value.trim(),
            requirements: document.getElementById('requirements').value.trim(),
            description: document.getElementById('description').value.trim(),
            applicationDeadline: document.getElementById('applicationDeadline').value,
            posterFile: this.uploadedFile,
            createdAt: new Date(),
            employerId: this.currentUser.uid,
            status: 'active',
            applicantCount: 0
        };
    }

    validateForm() {
        const requiredFields = [
            'jobTitle',
            'companyName',
            'category',
            'location',
            'jobType',
            'requirements',
            'description'
        ];

        let isValid = true;

        for (let field of requiredFields) {
            if (!this.validateField(field)) {
                isValid = false;
            }
        }

        return isValid;
    }

    updatePreview() {
        const data = this.jobData;

        // Update preview elements
        document.querySelector('.preview-job-title').textContent = data.jobTitle;
        document.querySelector('.preview-company').textContent = data.companyName;
        document.querySelector('.preview-location').textContent = data.location;
        document.querySelector('.preview-job-type').textContent = this.formatJobType(data.jobType);
        document.querySelector('.preview-salary').textContent = data.salary || 'Salary not specified';
        document.querySelector('.preview-category').textContent = this.formatCategory(data.category);
        document.querySelector('.preview-requirements').textContent = data.requirements;
        document.querySelector('.preview-description').textContent = data.description;
        document.querySelector('.preview-deadline').textContent = data.applicationDeadline ? 
            `Apply by ${this.formatDate(data.applicationDeadline)}` : 'No deadline';

        // Update poster image
        const posterImage = document.getElementById('posterImage');
        if (this.uploadedFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                posterImage.innerHTML = `<img src="${e.target.result}" alt="Job Poster">`;
            };
            reader.readAsDataURL(this.uploadedFile);
        } else {
            posterImage.innerHTML = `
                <div class="no-image">
                    <i class="fas fa-image"></i>
                    <p>No poster uploaded</p>
                </div>
            `;
        }
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

    formatCategory(category) {
        const categories = {
            'it': 'Information Technology',
            'education': 'Education',
            'finance': 'Finance',
            'health': 'Healthcare',
            'engineering': 'Engineering',
            'marketing': 'Marketing',
            'agriculture': 'Agriculture',
            'construction': 'Construction',
            'other': 'Other'
        };
        return categories[category] || category;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    closePreviewModal() {
        document.getElementById('previewModal').classList.remove('show');
    }

    async confirmJobPosting() {
        const confirmBtn = document.getElementById('confirmPost');
        confirmBtn.classList.add('loading');
        confirmBtn.disabled = true;

        try {
            // Upload poster image if exists
            let posterUrl = '';
            if (this.uploadedFile) {
                posterUrl = await this.uploadPosterImage();
            }

            // Prepare job data for Firestore
            const jobData = {
                title: this.jobData.jobTitle,
                companyName: this.jobData.companyName,
                category: this.jobData.category,
                location: this.jobData.location,
                type: this.jobData.jobType,
                salary: this.jobData.salary,
                requirements: this.jobData.requirements,
                description: this.jobData.description,
                applicationDeadline: this.jobData.applicationDeadline || null,
                posterUrl: posterUrl,
                employerId: this.currentUser.uid,
                status: 'active',
                applicantCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Save to Firestore
            await this.saveJobToFirestore(jobData);

            // Show success
            this.closePreviewModal();
            document.getElementById('successModal').classList.add('show');
            
            this.showToast('Job posted successfully!', 'success');

        } catch (error) {
            console.error('Error posting job:', error);
            this.showToast('Error posting job. Please try again.', 'error');
        } finally {
            confirmBtn.classList.remove('loading');
            confirmBtn.disabled = false;
        }
    }

    async uploadPosterImage() {
        if (!this.uploadedFile) return '';

        try {
            const storageRef = ref(storage, `job-posters/${this.currentUser.uid}/${Date.now()}-${this.uploadedFile.name}`);
            const snapshot = await uploadBytes(storageRef, this.uploadedFile);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            return downloadUrl;
        } catch (error) {
            console.error('Error uploading poster:', error);
            throw new Error('Failed to upload poster image');
        }
    }

    async saveJobToFirestore(jobData) {
        try {
            const docRef = await addDoc(collection(db, 'jobs'), jobData);
            console.log('Job posted with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error saving job to Firestore:', error);
            throw new Error('Failed to save job to database');
        }
    }

    downloadPoster() {
        if (!this.uploadedFile) {
            this.showToast('Please upload a job poster first', 'error');
            return;
        }
        // In a real implementation, this would generate and download the poster
        this.showToast('Poster download functionality would be implemented here', 'info');
    }

    sharePoster() {
        const jobTitle = this.jobData.jobTitle;
        const companyName = this.jobData.companyName;
        
        if (navigator.share) {
            navigator.share({
                title: `${jobTitle} - ${companyName}`,
                text: 'Check out this job opportunity!',
                url: window.location.href
            });
        } else {
            // Fallback for browsers that don't support Web Share API
            this.showToast(`Share this job: ${jobTitle} at ${companyName}`, 'info');
        }
    }

    resetForm() {
        document.getElementById('jobForm').reset();
        this.removeFile();
        this.jobData = null;
        document.getElementById('successModal').classList.remove('show');
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
        }, 3000);
    }
}

// Initialize the job posting application when DOM is loaded
let jobPosting;
document.addEventListener('DOMContentLoaded', function() {
    jobPosting = new JobPosting();
});