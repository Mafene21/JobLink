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
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  orderBy
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
const auth = getAuth(app);
const db = getFirestore(app);

class ManageJobs {
    constructor() {
        this.currentUser = null;
        this.companyData = null;
        this.jobs = [];
        this.filteredJobs = [];
        this.selectedJobs = new Set();
        this.currentPage = 1;
        this.jobsPerPage = 10;
        this.filters = {
            search: '',
            status: 'all',
            type: 'all',
            sortBy: 'newest'
        };
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.loadCompanyData();
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadJobs();
                this.updateStats();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadCompanyData() {
        try {
            const companyDoc = await getDoc(doc(db, 'companies', this.currentUser.uid));
            if (companyDoc.exists()) {
                this.companyData = companyDoc.data();
                this.updateCompanyLogo();
            }
        } catch (error) {
            console.error('Error loading company data:', error);
        }
    }

    updateCompanyLogo() {
        const companyLogoNav = document.getElementById('companyLogoNav');
        if (this.companyData?.logoUrl && this.companyData.logoUrl !== 'https://via.placeholder.com/150x150?text=Company+Logo') {
            companyLogoNav.src = this.companyData.logoUrl;
        }
    }

    async loadJobs() {
        const tableBody = document.getElementById('jobsTableBody');
        
        try {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading jobs...</span>
                    </td>
                </tr>
            `;

            console.log('Loading jobs for employer:', this.currentUser.uid);
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('employerId', '==', this.currentUser.uid)
            );
            
            const querySnapshot = await getDocs(jobsQuery);
            console.log('Found', querySnapshot.size, 'jobs');
            
            this.jobs = [];
            querySnapshot.forEach((doc) => {
                const job = { 
                    id: doc.id, 
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || new Date())
                };
                this.jobs.push(job);
            });
            
            this.applyFilters();
            this.renderTable();
            
        } catch (error) {
            console.error('Error loading jobs:', error);
            this.showErrorState(tableBody, error);
        }
    }

    applyFilters() {
        this.filteredJobs = this.jobs.filter(job => {
            // Search filter
            const searchTerm = this.filters.search.toLowerCase();
            const matchesSearch = !searchTerm || 
                job.title?.toLowerCase().includes(searchTerm) ||
                job.location?.toLowerCase().includes(searchTerm) ||
                job.description?.toLowerCase().includes(searchTerm);

            // Status filter
            const matchesStatus = this.filters.status === 'all' || job.status === this.filters.status;

            // Type filter
            const matchesType = this.filters.type === 'all' || job.type === this.filters.type;

            return matchesSearch && matchesStatus && matchesType;
        });

        // Sort jobs
        this.sortJobs();
    }

    sortJobs() {
        switch (this.filters.sortBy) {
            case 'newest':
                this.filteredJobs.sort((a, b) => b.createdAt - a.createdAt);
                break;
            case 'oldest':
                this.filteredJobs.sort((a, b) => a.createdAt - b.createdAt);
                break;
            case 'applicants':
                this.filteredJobs.sort((a, b) => (b.applicantCount || 0) - (a.applicantCount || 0));
                break;
            case 'title':
                this.filteredJobs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
        }
    }

    renderTable() {
        const tableBody = document.getElementById('jobsTableBody');
        
        if (this.filteredJobs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <i class="fas fa-briefcase"></i>
                        <h3>No Jobs Found</h3>
                        <p>No jobs match your current filters. Try adjusting your search criteria.</p>
                        <button class="btn btn-primary" onclick="manageJobs.clearFilters()">
                            Clear Filters
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.jobsPerPage;
        const endIndex = startIndex + this.jobsPerPage;
        const paginatedJobs = this.filteredJobs.slice(startIndex, endIndex);

        let tableHTML = '';
        
        paginatedJobs.forEach(job => {
            const isSelected = this.selectedJobs.has(job.id);
            tableHTML += this.createTableRow(job, isSelected);
        });

        tableBody.innerHTML = tableHTML;
        this.bindTableEvents();
        this.renderPagination();
        this.updateBulkActions();
    }

    createTableRow(job, isSelected) {
        const createdAt = job.createdAt;
        const formattedDate = this.formatDate(createdAt);
        const statusBadge = this.getStatusBadge(job.status);
        const applicantCount = job.applicantCount || 0;
        const viewCount = job.viewCount || 0;

        return `
            <tr data-job-id="${job.id}" class="${isSelected ? 'selected' : ''}">
                <td class="select-column">
                    <input type="checkbox" class="job-checkbox" ${isSelected ? 'checked' : ''} data-job-id="${job.id}">
                </td>
                <td class="job-title">
                    <div class="job-title-content">
                        <strong>${job.title || 'Untitled Job'}</strong>
                        ${job.jobImageUrl ? `
                        <div class="job-image-preview">
                            <img src="${job.jobImageUrl}" alt="${job.title}" onerror="this.style.display='none'">
                        </div>
                        ` : ''}
                    </div>
                </td>
                <td class="job-type">${this.formatJobType(job.type)}</td>
                <td class="job-location">${job.location || 'Remote'}</td>
                <td class="job-applicants">${applicantCount}</td>
                <td class="job-views">${viewCount}</td>
                <td class="job-status">${statusBadge}</td>
                <td class="job-date">${formattedDate}</td>
                <td class="job-actions">
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" data-job-id="${job.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-edit" data-job-id="${job.id}" title="Edit Job">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" data-job-id="${job.id}" title="Delete Job">
                            <i class="fas fa-trash"></i>
                        </button>
                        ${job.status !== 'closed' ? `
                        <button class="btn-status" data-job-id="${job.id}" data-current-status="${job.status}">
                            ${job.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    getStatusBadge(status) {
        const statusMap = {
            'active': { class: 'status-active', text: 'Active' },
            'paused': { class: 'status-paused', text: 'Paused' },
            'closed': { class: 'status-closed', text: 'Closed' },
            'draft': { class: 'status-draft', text: 'Draft' }
        };
        
        const statusInfo = statusMap[status] || statusMap.draft;
        return `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
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

    formatDate(date) {
        if (!date) return 'N/A';
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    bindTableEvents() {
        // Checkbox events
        document.querySelectorAll('.job-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const jobId = e.target.dataset.jobId;
                if (e.target.checked) {
                    this.selectedJobs.add(jobId);
                } else {
                    this.selectedJobs.delete(jobId);
                }
                this.updateBulkActions();
            });
        });

        // Action button events
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('.btn-view').dataset.jobId;
                this.showJobDetails(jobId);
            });
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('.btn-edit').dataset.jobId;
                this.editJob(jobId);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('.btn-delete').dataset.jobId;
                this.showDeleteConfirmation(jobId);
            });
        });

        document.querySelectorAll('.btn-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('.btn-status').dataset.jobId;
                const currentStatus = e.target.closest('.btn-status').dataset.currentStatus;
                this.toggleJobStatus(jobId, currentStatus);
            });
        });
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredJobs.length / this.jobsPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <div class="pagination-info">
                Showing ${((this.currentPage - 1) * this.jobsPerPage) + 1} to 
                ${Math.min(this.currentPage * this.jobsPerPage, this.filteredJobs.length)} 
                of ${this.filteredJobs.length} jobs
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="manageJobs.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                paginationHTML += `
                    <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="manageJobs.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="manageJobs.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `</div>`;
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
    }

    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const selectedCount = document.getElementById('selectedCount');
        const selectAllCheckbox = document.getElementById('selectAllJobs');

        if (this.selectedJobs.size > 0) {
            bulkActions.style.display = 'block';
            selectedCount.textContent = `${this.selectedJobs.size} job${this.selectedJobs.size > 1 ? 's' : ''} selected`;
            selectAllCheckbox.checked = this.selectedJobs.size === this.filteredJobs.length;
        } else {
            bulkActions.style.display = 'none';
            selectAllCheckbox.checked = false;
        }
    }

    updateStats() {
        const activeJobs = this.jobs.filter(job => job.status === 'active').length;
        const totalApplicants = this.jobs.reduce((sum, job) => sum + (job.applicantCount || 0), 0);
        const totalViews = this.jobs.reduce((sum, job) => sum + (job.viewCount || 0), 0);

        document.getElementById('activeJobsCount').textContent = activeJobs;
        document.getElementById('totalJobsCount').textContent = this.jobs.length;
        document.getElementById('totalApplicantsCount').textContent = totalApplicants;
        document.getElementById('totalViewsCount').textContent = totalViews;
    }

    async showJobDetails(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('jobDetailsModal');
        const content = document.getElementById('jobDetailsContent');
        const title = document.getElementById('modalJobTitle');

        title.textContent = job.title || 'Job Details';
        
        content.innerHTML = this.createJobDetailsHTML(job);
        modal.style.display = 'flex';

        // Set edit button action
        document.getElementById('editJobBtn').onclick = () => {
            this.editJob(jobId);
        };
    }

    createJobDetailsHTML(job) {
        const createdAt = job.createdAt;
        const formattedDate = createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `
            <div class="job-details-content">
                ${job.jobImageUrl ? `
                <div class="job-detail-section">
                    <div class="job-image-large">
                        <img src="${job.jobImageUrl}" alt="${job.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;">
                    </div>
                </div>
                ` : ''}
                
                <div class="job-detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Job Title</span>
                            <span class="detail-value">${job.title || 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Job Type</span>
                            <span class="detail-value">${this.formatJobType(job.type)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${job.location || 'Remote'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Salary</span>
                            <span class="detail-value">${job.salary || 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${this.getStatusBadge(job.status)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Posted Date</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                    </div>
                </div>

                <div class="job-detail-section">
                    <h4>Job Description</h4>
                    <p style="line-height: 1.6; white-space: pre-wrap;">${job.description || 'No description provided.'}</p>
                </div>

                <div class="job-detail-section">
                    <h4>Requirements</h4>
                    <p style="line-height: 1.6; white-space: pre-wrap;">${job.requirements || 'No requirements specified.'}</p>
                </div>

                <div class="job-detail-section">
                    <h4>Statistics</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Total Applicants</span>
                            <span class="detail-value">${job.applicantCount || 0}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Views</span>
                            <span class="detail-value">${job.viewCount || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    editJob(jobId) {
        window.location.href = `job_posting.html?edit=${jobId}`;
    }

    showDeleteConfirmation(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('deleteModal');
        const jobInfo = document.getElementById('jobToDeleteInfo');

        jobInfo.innerHTML = `
            <strong>${job.title || 'Untitled Job'}</strong><br>
            <small>Type: ${this.formatJobType(job.type)} | Location: ${job.location || 'Remote'} | Applicants: ${job.applicantCount || 0}</small>
        `;

        modal.style.display = 'flex';

        document.getElementById('confirmDelete').onclick = () => {
            this.deleteJob(jobId);
        };
    }

    async deleteJob(jobId) {
        try {
            await deleteDoc(doc(db, 'jobs', jobId));
            this.hideModal('deleteModal');
            this.showToast('Job deleted successfully');
            
            // Remove from local arrays
            this.jobs = this.jobs.filter(job => job.id !== jobId);
            this.selectedJobs.delete(jobId);
            
            this.applyFilters();
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Error deleting job:', error);
            this.showToast('Error deleting job', 'error');
        }
    }

    async toggleJobStatus(jobId, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        
        try {
            await updateDoc(doc(db, 'jobs', jobId), {
                status: newStatus,
                updatedAt: new Date()
            });
            
            this.showToast(`Job ${newStatus === 'active' ? 'activated' : 'paused'} successfully`);
            
            // Update local data
            const job = this.jobs.find(j => j.id === jobId);
            if (job) {
                job.status = newStatus;
            }
            
            this.applyFilters();
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Error updating job status:', error);
            this.showToast('Error updating job status', 'error');
        }
    }

    bindEvents() {
        // Select all checkbox
        document.getElementById('selectAllJobs').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.job-checkbox').forEach(checkbox => {
                checkbox.checked = isChecked;
                const jobId = checkbox.dataset.jobId;
                if (isChecked) {
                    this.selectedJobs.add(jobId);
                } else {
                    this.selectedJobs.delete(jobId);
                }
            });
            this.updateBulkActions();
        });

        // Filter events
        document.getElementById('jobSearch').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderTable();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderTable();
        });

        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
            this.renderTable();
        });

        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.filters.sortBy = e.target.value;
            this.applyFilters();
            this.renderTable();
        });

        // Clear filters
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Bulk actions
        document.getElementById('bulkActivate').addEventListener('click', () => {
            this.bulkUpdateStatus('active');
        });

        document.getElementById('bulkPause').addEventListener('click', () => {
            this.bulkUpdateStatus('paused');
        });

        document.getElementById('bulkClose').addEventListener('click', () => {
            this.bulkUpdateStatus('closed');
        });

        document.getElementById('bulkDelete').addEventListener('click', () => {
            this.showBulkDeleteConfirmation();
        });

        // Other buttons
        document.getElementById('postNewJobBtn').addEventListener('click', () => {
            window.location.href = 'job_posting.html';
        });

        document.getElementById('refreshJobs').addEventListener('click', () => {
            this.loadJobs();
        });

        // Modal close events
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                modal.style.display = 'none';
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Logout
        document.querySelector('.logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
    }

    clearFilters() {
        document.getElementById('jobSearch').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('sortBy').value = 'newest';
        
        this.filters = {
            search: '',
            status: 'all',
            type: 'all',
            sortBy: 'newest'
        };
        
        this.currentPage = 1;
        this.applyFilters();
        this.renderTable();
    }

    async bulkUpdateStatus(newStatus) {
        const jobsToUpdate = Array.from(this.selectedJobs);
        
        try {
            const updatePromises = jobsToUpdate.map(jobId => 
                updateDoc(doc(db, 'jobs', jobId), {
                    status: newStatus,
                    updatedAt: new Date()
                })
            );
            
            await Promise.all(updatePromises);
            
            // Update local data
            this.jobs.forEach(job => {
                if (this.selectedJobs.has(job.id)) {
                    job.status = newStatus;
                }
            });
            
            this.showToast(`${jobsToUpdate.length} jobs ${newStatus} successfully`);
            this.selectedJobs.clear();
            this.applyFilters();
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Error bulk updating jobs:', error);
            this.showToast('Error updating jobs', 'error');
        }
    }

    showBulkDeleteConfirmation() {
        const modal = document.getElementById('bulkDeleteModal');
        const countElement = document.getElementById('bulkDeleteCount');
        
        countElement.textContent = this.selectedJobs.size;
        modal.style.display = 'flex';

        document.getElementById('confirmBulkDelete').onclick = () => {
            this.bulkDeleteJobs();
        };
    }

    async bulkDeleteJobs() {
        const jobsToDelete = Array.from(this.selectedJobs);
        
        try {
            const deletePromises = jobsToDelete.map(jobId => 
                deleteDoc(doc(db, 'jobs', jobId))
            );
            
            await Promise.all(deletePromises);
            
            this.hideModal('bulkDeleteModal');
            this.showToast(`${jobsToDelete.length} jobs deleted successfully`);
            
            // Update local data
            this.jobs = this.jobs.filter(job => !this.selectedJobs.has(job.id));
            this.selectedJobs.clear();
            
            this.applyFilters();
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Error bulk deleting jobs:', error);
            this.showToast('Error deleting jobs', 'error');
        }
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('successToast');
        const messageElement = document.getElementById('toastMessage');
        
        messageElement.textContent = message;
        
        if (type === 'error') {
            toast.style.borderLeftColor = 'var(--accent)';
            toast.querySelector('i').className = 'fas fa-exclamation-circle';
            toast.querySelector('i').style.color = 'var(--accent)';
        } else {
            toast.style.borderLeftColor = 'var(--success)';
            toast.querySelector('i').className = 'fas fa-check-circle';
            toast.querySelector('i').style.color = 'var(--success)';
        }
        
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                toast.style.display = 'none';
                toast.style.animation = '';
            }, 300);
        }, 3000);
    }

    showErrorState(tableBody, error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Jobs</h3>
                    <p>There was a problem loading your job postings. Please try again.</p>
                    <button class="btn btn-primary" onclick="manageJobs.loadJobs()">
                        <i class="fas fa-refresh"></i>
                        Try Again
                    </button>
                </td>
            </tr>
        `;
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
}

let manageJobs;
document.addEventListener('DOMContentLoaded', function() {
    manageJobs = new ManageJobs();
});