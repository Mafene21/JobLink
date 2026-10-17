import { getRecord, updateRecord, getAccountUser, insertRecord, uploadFile } from '../lib/data-service.js';
import { escapeHTML, setHTML } from '../lib/ui.js';


class JobPosting {
    constructor() {
        this.currentUser = null;
        this.selectedFile = null;
        this.jobData = null;
        this.init().catch(error => {
            console.error('Unable to load this page:', error);
            this.showToast(error.message || 'Unable to load your account. Please try again.', 'error');
        });
    }

    async init() {
        this.currentUser = await getAccountUser('employer');
        if (!this.currentUser) return;
        this.bindEvents();
        this.setupFileUpload();
        this.editJobId = new URLSearchParams(location.search).get('edit');
        if (this.editJobId) {
            const job = await getRecord('jobs', this.editJobId);
            if (!job || job.employerId !== this.currentUser.id) throw new Error('You cannot edit this job.');
            this.originalJob = job;
            const fields = { jobTitle: job.title, companyName: job.companyName, category: job.category,
                location: job.location, jobType: job.jobType, experienceLevel: job.experienceLevel, requirements: job.requirements,
                description: job.description, salary: job.salary, applicationDeadline: job.applicationDeadline,
                requiredSkills: (job.requiredSkills || []).join(', ') };
            for (const [id, value] of Object.entries(fields)) {
                const input = document.getElementById(id);
                if (input) input.value = Array.isArray(value) ? value.join('\n') : value || '';
            }
            document.querySelector('h2').textContent = 'Edit Job';
            document.querySelector('#submitBtn .btn-text').textContent = 'Preview Changes';
        }
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
                window.location.href = 'job_posting.html';
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
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showToast('Please select a valid image file (JPG, JPEG, PNG)', 'error');
            return;
        }

        // Validate file size (2MB max)
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        if (file.size > maxSize) {
            this.showToast('File size must be less than 2MB', 'error');
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
            setHTML(posterPreview, `
                <div class="preview-item">
                    <div class="preview-info">
                        <i class="fas fa-file-image"></i>
                        <span>${escapeHTML(file.name)}</span>
                    </div>
                    <div class="preview-actions">
                        <button type="button" data-controller="jobPosting" data-method="removeFile">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `);
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
            setHTML(posterPreview, '');
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
            requiredSkills: document.getElementById('requiredSkills').value.split(/[,;\n]+/).map(skill => skill.trim()).filter(Boolean),
            companyName: document.getElementById('companyName').value.trim(),
            category: document.getElementById('category').value,
            location: document.getElementById('location').value.trim(),
            jobType: document.getElementById('jobType').value,
            experienceLevel: document.getElementById('experienceLevel').value,
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
                setHTML(posterImage, `<img src="${escapeHTML(e.target.result)}" alt="Job Poster">`);
            };
            reader.readAsDataURL(formData.posterFile);
        } else {
            setHTML(posterImage, `
                <div class="no-image">
                    <i class="fas fa-image"></i>
                    <p>No poster uploaded</p>
                </div>
            `);
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
        if (!this.jobData) return;
        this.setConfirmButtonLoading(true);
        try {
            const posterUrl = this.jobData.posterFile ? await this.uploadPosterImage(this.jobData.posterFile) : this.originalJob?.posterUrl || '';
            const payload = {
                title: this.jobData.jobTitle, companyName: this.jobData.companyName,
                category: this.jobData.category, location: this.jobData.location, jobType: this.jobData.jobType,
                requirements: this.jobData.requirements, experienceLevel: this.jobData.experienceLevel, description: this.jobData.description,
                salary: this.jobData.salary || 'Negotiable', applicationDeadline: this.jobData.applicationDeadline || null,
                requiredSkills: this.jobData.requiredSkills, posterUrl,
                employerId: this.currentUser.id, status: this.originalJob?.status || 'active'
            };
            if (this.editJobId) await updateRecord('jobs', this.editJobId, payload);
            else await insertRecord('jobs', payload);
            this.closePreviewModal();
            this.showSuccessModal();
            if (this.editJobId) {
                document.querySelector('#successModal h3').textContent = 'Job Updated Successfully';
                document.querySelector('#successModal p').textContent = 'Your changes have been saved.';
            }
        } catch (error) { this.showToast(error.message || 'Unable to save this job.', 'error'); }
        finally { this.setConfirmButtonLoading(false); }
    }

    async uploadPosterImage(file) {
        const { url } = await uploadFile('job-posters', 'posters', file);
        return url;
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
        setHTML(toast, `
            <div class="toast-content">
                <i class="fas fa-${escapeHTML(type === 'error' ? 'exclamation-triangle' : 'check-circle')}"></i>
                <span>${escapeHTML(message)}</span>
            </div>
        `);

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
