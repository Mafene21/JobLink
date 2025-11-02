// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

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
const auth = getAuth(app);
const storage = getStorage(app);

class JobPosting {
    constructor() {
        this.currentUser = null;
        this.selectedFile = null;
        this.jobData = null;
        this.init();
    }

    init() {
        this.checkAuthState();
        this.bindEvents();
        this.setupFileUpload();
    }

    checkAuthState() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User is authenticated:', user.uid);
            } else {
                console.log('User is not authenticated');
                // Redirect to login if not authenticated
                window.location.href = 'login.html';
            }
        });
    }

    bindEvents() {
        // Form submission
        const jobForm = document.getElementById('jobForm');
        if (jobForm) {
            jobForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Modal events
        const modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closePreviewModal());
        }

        const editJob = document.getElementById('editJob');
        if (editJob) {
            editJob.addEventListener('click', () => this.closePreviewModal());
        }

        const confirmPost = document.getElementById('confirmPost');
        if (confirmPost) {
            confirmPost.addEventListener('click', () => this.confirmJobPosting());
        }

        // Success modal events
        const viewDashboard = document.getElementById('viewDashboard');
        if (viewDashboard) {
            viewDashboard.addEventListener('click', () => {
                window.location.href = 'employer_dashboard.html';
            });
        }

        const postAnother = document.getElementById('postAnother');
        if (postAnother) {
            postAnother.addEventListener('click', () => {
                this.closeSuccessModal();
                this.resetForm();
            });
        }

        // Close modals when clicking outside
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'previewModal') this.closePreviewModal();
                    if (modal.id === 'successModal') this.closeSuccessModal();
                }
            });
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePreviewModal();
                this.closeSuccessModal();
            }
        });
    }

    setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('poster');
        const posterPreview = document.getElementById('posterPreview');
        const browseBtn = document.querySelector('.browse-btn');

        if (!fileUploadArea || !fileInput) return;

        // Click on browse button
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }

        // Click on upload area
        fileUploadArea.addEventListener('click', (e) => {
            if (e.target !== browseBtn) {
                fileInput.click();
            }
        });

        // Drag and drop events
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
                this.handleFileSelection(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });
    }

    handleFileSelection(file) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            this.showToast('Please select a valid image file (JPG, JPEG, PNG)', 'error');
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        this.selectedFile = file;
        this.displayFilePreview(file);
    }

    displayFilePreview(file) {
        const posterPreview = document.getElementById('posterPreview');
        if (!posterPreview) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            posterPreview.innerHTML = `
                <div class="preview-item">
                    <div class="preview-info">
                        <i class="fas fa-file-image"></i>
                        <span>${file.name}</span>
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
        this.selectedFile = null;
        const posterPreview = document.getElementById('posterPreview');
        const fileInput = document.getElementById('poster');
        
        if (posterPreview) {
            posterPreview.classList.remove('show');
            posterPreview.innerHTML = '';
        }
        
        if (fileInput) {
            fileInput.value = '';
        }
    }

    async handleFormSubmit() {
        // Validate form
        if (!this.validateForm()) {
            return;
        }

        // Get form data
        const formData = this.getFormData();
        
        // Show loading state
        this.setButtonLoading(true);

        try {
            // Store job data for preview
            this.jobData = formData;
            
            // Update preview modal
            this.updatePreviewModal(formData);
            
            // Show preview modal
            this.showPreviewModal();
            
        } catch (error) {
            console.error('Error preparing preview:', error);
            this.showToast('Error preparing job preview', 'error');
        } finally {
            this.setButtonLoading(false);
        }
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

        requiredFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            const inputGroup = field.closest('.input-group');
            
            if (!field.value.trim()) {
                inputGroup.classList.add('error');
                isValid = false;
            } else {
                inputGroup.classList.remove('error');
            }
        });

        return isValid;
    }

    getFormData() {
        return {
            jobTitle: document.getElementById('jobTitle').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            category: document.getElementById('category').value,
            location: document.getElementById('location').value.trim(),
            jobType: document.getElementById('jobType').value,
            requirements: document.getElementById('requirements').value.trim(),
            description: document.getElementById('description').value.trim(),
            salary: document.getElementById('salary').value.trim(),
            applicationDeadline: document.getElementById('applicationDeadline').value,
            posterFile: this.selectedFile
        };
    }

    updatePreviewModal(formData) {
        // Update basic job info
        document.querySelector('.preview-job-title').textContent = formData.jobTitle;
        document.querySelector('.preview-company').textContent = formData.companyName;
        document.querySelector('.preview-location').textContent = formData.location;
        document.querySelector('.preview-job-type').textContent = this.formatJobType(formData.jobType);
        document.querySelector('.preview-category').textContent = this.formatCategory(formData.category);
        
        // Update salary
        const salaryElement = document.querySelector('.preview-salary');
        salaryElement.textContent = formData.salary || 'Salary not specified';
        
        // Update deadline
        const deadlineElement = document.querySelector('.preview-deadline');
        if (formData.applicationDeadline) {
            const deadlineDate = new Date(formData.applicationDeadline);
            deadlineElement.textContent = `Apply by ${deadlineDate.toLocaleDateString()}`;
        } else {
            deadlineElement.textContent = 'No deadline';
        }
        
        // Update requirements and description
        document.querySelector('.preview-requirements').textContent = formData.requirements;
        document.querySelector('.preview-description').textContent = formData.description;
        
        // Update poster image if available
        const posterImage = document.getElementById('posterImage');
        if (formData.posterFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                posterImage.innerHTML = `<img src="${e.target.result}" alt="Job Poster">`;
            };
            reader.readAsDataURL(formData.posterFile);
        } else {
            posterImage.innerHTML = `
                <div class="no-image">
                    <i class="fas fa-image"></i>
                    <p>No poster uploaded</p>
                </div>
            `;
        }
    }

    showPreviewModal() {
        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closePreviewModal() {
        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    async confirmJobPosting() {
        if (!this.jobData) {
            this.showToast('No job data to post', 'error');
            return;
        }

        const confirmBtn = document.getElementById('confirmPost');
        this.setConfirmButtonLoading(true);

        try {
            // Upload poster image if available
            let posterUrl = '';
            if (this.jobData.posterFile) {
                posterUrl = await this.uploadPosterImage(this.jobData.posterFile);
            }

            // Prepare job data for Firebase
            const jobDataForFirebase = {
                title: this.jobData.jobTitle,
                companyName: this.jobData.companyName,
                category: this.jobData.category,
                location: this.jobData.location,
                type: this.jobData.jobType,
                requirements: this.jobData.requirements,
                description: this.jobData.description,
                salary: this.jobData.salary || 'Negotiable',
                applicationDeadline: this.jobData.applicationDeadline || null,
                posterUrl: posterUrl,
                employerId: this.currentUser.uid,
                employerEmail: this.currentUser.email,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                applications: 0,
                views: 0
            };

            // Save to Firebase
            const docRef = await addDoc(collection(db, 'jobs'), jobDataForFirebase);
            
            console.log('Job posted successfully with ID:', docRef.id);
            
            // Close preview modal and show success
            this.closePreviewModal();
            this.showSuccessModal();
            
        } catch (error) {
            console.error('Error posting job:', error);
            this.showToast('Error posting job: ' + error.message, 'error');
        } finally {
            this.setConfirmButtonLoading(false);
        }
    }

    async uploadPosterImage(file) {
        try {
            // Create a unique filename
            const fileExtension = file.name.split('.').pop();
            const fileName = `job-posters/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
            
            // Create storage reference
            const storageRef = ref(storage, fileName);
            
            // Upload file
            const snapshot = await uploadBytes(storageRef, file);
            
            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading poster:', error);
            throw new Error('Failed to upload poster image');
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    resetForm() {
        const form = document.getElementById('jobForm');
        if (form) {
            form.reset();
        }
        this.removeFile();
        this.jobData = null;
    }

    setButtonLoading(loading) {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            if (loading) {
                submitBtn.classList.add('loading');
                submitBtn.disabled = true;
            } else {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        }
    }

    setConfirmButtonLoading(loading) {
        const confirmBtn = document.getElementById('confirmPost');
        if (confirmBtn) {
            if (loading) {
                confirmBtn.classList.add('loading');
                confirmBtn.disabled = true;
            } else {
                confirmBtn.classList.remove('loading');
                confirmBtn.disabled = false;
            }
        }
    }

    formatJobType(jobType) {
        const types = {
            'full-time': 'Full Time',
            'part-time': 'Part Time',
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
            'finance': 'Business',
            'health': 'Healthcare',
            'engineering': 'Engineering',
            'marketing': 'Marketing',
            'agriculture': 'Agriculture',
            'construction': 'Construction',
            'other': 'Other'
        };
        return categories[category] || category;
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the job posting functionality
let jobPosting;

document.addEventListener('DOMContentLoaded', function() {
    jobPosting = new JobPosting();
    window.jobPosting = jobPosting;
});