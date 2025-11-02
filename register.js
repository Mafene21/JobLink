// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp
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

// Configure Google Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Track Google login attempts
let googleLoginInProgress = false;

document.addEventListener('DOMContentLoaded', function() {
  // Domain authorization check
  setupDomainAuthorization();

  // Get elements based on page (login or register)
  const loginForm = document.getElementById('loginForm') || document.getElementById('signupForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  const loginButton = document.getElementById('loginButton') || document.getElementById('signupButton');
  const btnLoader = document.getElementById('btnLoader');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const formError = document.getElementById('formError');
  const successMessage = document.getElementById('successMessage');
  const rememberMe = document.getElementById('rememberMe');
  const googleLoginBtn = document.querySelector('.btn-google') || document.getElementById('googleSignup');
  const linkedinLoginBtn = document.querySelector('.btn-linkedin');
  const userTypeSelect = document.getElementById('userType');
  const agreeTermsInput = document.getElementById('agreeTerms');
  const fullNameInput = document.getElementById('fullName');

  // Mobile navigation toggle
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.navbar') && navMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      }
    });
  }

  // Toggle password visibility
  if (togglePassword) {
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const icon = this.querySelector('i');
      icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
  }

  // Real-time validation for login
  if (emailInput) {
    emailInput.addEventListener('input', function() {
      validateEmail();
      clearFormError();
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      validatePassword();
      clearFormError();
    });
  }

  // Real-time validation for registration
  if (fullNameInput) {
    fullNameInput.addEventListener('input', validateFullName);
  }
  if (userTypeSelect) {
    userTypeSelect.addEventListener('change', validateUserType);
  }
  if (agreeTermsInput) {
    agreeTermsInput.addEventListener('change', validateTerms);
  }

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (validateForm()) {
        if (loginForm.id === 'loginForm') {
          loginUser();
        } else {
          registerUser();
        }
      }
    });
  }

  // Google Login/Signup
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function() {
      if (!googleLoginInProgress) {
        if (googleLoginBtn.id === 'googleSignup') {
          signUpWithGoogle();
        } else {
          loginWithGoogle();
        }
      }
    });
  }

  // LinkedIn Login (placeholder)
  if (linkedinLoginBtn) {
    linkedinLoginBtn.addEventListener('click', function() {
      showFormError('LinkedIn login will be available soon.');
    });
  }

  // Validation functions
  function validateFullName() {
    if (!fullNameInput) return true;
    
    const fullName = fullNameInput.value.trim();
    
    if (!fullName) {
      showError('fullNameError', 'Full name is required');
      return false;
    } else if (fullName.length < 2) {
      showError('fullNameError', 'Full name must be at least 2 characters');
      return false;
    } else if (!fullName.includes(' ')) {
      showError('fullNameError', 'Please enter your full name (first and last)');
      return false;
    } else {
      clearError('fullNameError');
      return true;
    }
  }

  function validateEmail() {
    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      showError(emailError, 'Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      showError(emailError, 'Please enter a valid email address');
      return false;
    } else {
      clearError(emailError);
      return true;
    }
  }

  function validatePassword() {
    const password = passwordInput.value;
    
    if (!password) {
      showError(passwordError, 'Password is required');
      return false;
    } else if (password.length < 6) {
      showError(passwordError, 'Password must be at least 6 characters');
      return false;
    } else {
      clearError(passwordError);
      return true;
    }
  }

  function validateUserType() {
    if (!userTypeSelect) return true;
    
    const userType = userTypeSelect.value;
    
    if (!userType) {
      showError('userTypeError', 'Please select account type');
      return false;
    } else {
      clearError('userTypeError');
      return true;
    }
  }

  function validateTerms() {
    if (!agreeTermsInput) return true;
    
    if (!agreeTermsInput.checked) {
      showError('termsError', 'You must agree to the terms and conditions');
      return false;
    } else {
      clearError('termsError');
      return true;
    }
  }

  function validateForm() {
    if (loginForm.id === 'loginForm') {
      const isEmailValid = validateEmail();
      const isPasswordValid = validatePassword();
      return isEmailValid && isPasswordValid;
    } else {
      const isFullNameValid = validateFullName();
      const isEmailValid = validateEmail();
      const isPasswordValid = validatePassword();
      const isUserTypeValid = validateUserType();
      const isTermsValid = validateTerms();
      return isFullNameValid && isEmailValid && isPasswordValid && isUserTypeValid && isTermsValid;
    }
  }

  function showError(errorElement, message) {
    const element = typeof errorElement === 'string' ? document.getElementById(errorElement) : errorElement;
    if (element) {
      element.textContent = message;
      element.style.display = 'block';
    }
  }

  function clearError(errorElement) {
    const element = typeof errorElement === 'string' ? document.getElementById(errorElement) : errorElement;
    if (element) {
      element.textContent = '';
      element.style.display = 'none';
    }
  }

  function clearFormError() {
    if (formError) {
      formError.textContent = '';
      formError.style.display = 'none';
    }
  }

  function showFormError(message) {
    if (formError) {
      formError.textContent = message;
      formError.style.display = 'block';
    }
  }

  function showNoAccountMessage(email) {
    const existingMessage = document.querySelector('.no-account-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-account-message';
    messageDiv.innerHTML = `
      No account found with email: <strong>${email}</strong>. 
      <a href="register.html?email=${encodeURIComponent(email)}">Create an account here</a>
    `;
    
    if (loginForm) {
      loginForm.insertBefore(messageDiv, loginForm.firstChild);
    }
  }

  // Firebase user login with email/password
  async function loginUser() {
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    clearFormError();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    try {
      const persistence = rememberMe ? (rememberMe.checked ? browserLocalPersistence : browserSessionPersistence) : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;
        
        showSuccess('Login successful! Redirecting to your dashboard...');
        
        setTimeout(() => {
          if (userType === 'employer') {
            window.location.href = 'employer-dashboard.html';
          } else {
            window.location.href = 'seeker-dashboard.html';
          }
        }, 1500);
      } else {
        showFormError('User data not found. Please contact support.');
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
      }
      
    } catch (error) {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      
      const errorCode = error.code;
      let errorMessage = 'An error occurred during login. Please try again.';
      
      if (errorCode === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
        showNoAccountMessage(email);
      } else if (errorCode === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
        showError(passwordError, errorMessage);
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email.';
        showError(emailError, errorMessage);
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
        showFormError(errorMessage);
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
        showFormError(errorMessage);
      } else {
        showFormError(errorMessage);
      }
      
      console.error('Login error:', error);
    }
  }

  // Firebase user registration
  async function registerUser() {
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    
    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const userType = userTypeSelect.value;
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        fullName: fullName,
        email: email,
        userType: userType,
        createdAt: serverTimestamp(),
        profileCompleted: false
      });
      
      showSuccess('Account created successfully! Redirecting to your dashboard...');
      
      setTimeout(() => {
        if (userType === 'employer') {
          window.location.href = 'employerdashboard.html';
        } else {
          window.location.href = 'seeker_dashboard.html';
        }
      }, 2000);
      
    } catch (error) {
      loginButton.classList.remove('loading');
      loginButton.disabled = false;
      
      const errorCode = error.code;
      let errorMessage = 'An error occurred during registration. Please try again.';
      
      if (errorCode === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email or login.';
        showError('emailError', errorMessage);
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
        showError('passwordError', errorMessage);
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email.';
        showError('emailError', errorMessage);
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
        showError('emailError', errorMessage);
      } else {
        showError('emailError', errorMessage);
      }
      
      console.error('Registration error:', error);
    }
  }

  // Google Login function
  async function loginWithGoogle() {
    if (googleLoginInProgress) return;
    googleLoginInProgress = true;
    
    try {
      googleLoginBtn.disabled = true;
      const originalContent = googleLoginBtn.innerHTML;
      googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
      
      clearFormError();
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await handleSuccessfulGoogleLogin(user);
      
    } catch (error) {
      await handleGoogleAuthError(error);
    } finally {
      googleLoginInProgress = false;
    }
  }

  // Google Signup function
  async function signUpWithGoogle() {
    if (googleLoginInProgress) return;
    googleLoginInProgress = true;
    
    try {
      googleLoginBtn.disabled = true;
      const originalContent = googleLoginBtn.innerHTML;
      googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
      
      clearFormError();
      
      const userType = await selectUserType();
      if (!userType) {
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = '<i class="fab fa-google"></i> Sign up with Google';
        googleLoginInProgress = false;
        return;
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        fullName: user.displayName,
        email: user.email,
        userType: userType,
        createdAt: serverTimestamp(),
        profileCompleted: false,
        photoURL: user.photoURL
      });
      
      showSuccess('Google account linked successfully! Redirecting to your dashboard...');
      
      setTimeout(() => {
        if (userType === 'employer') {
          window.location.href = 'employer_dashboard.html';
        } else {
          window.location.href = 'seeker_dashboard.html';
        }
      }, 2000);
      
    } catch (error) {
      await handleGoogleAuthError(error);
    } finally {
      googleLoginInProgress = false;
    }
  }

  async function handleSuccessfulGoogleLogin(user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;
        
        showSuccess('Google login successful! Redirecting to your dashboard...');
        
        setTimeout(() => {
          if (userType === 'employer') {
            window.location.href = 'employer_dashboard.html';
          } else {
            window.location.href = 'seeker_dashboard.html';
          }
        }, 1500);
      } else {
        await createUserDocumentFromGoogle(user);
      }
      
    } catch (dbError) {
      console.error('Firestore error:', dbError);
      showFormError('Error accessing user data. Please try again.');
      resetGoogleButton();
    }
  }

  async function createUserDocumentFromGoogle(user) {
    try {
      showFormError('Setting up your account for the first time...');
      
      await setDoc(doc(db, 'users', user.uid), {
        fullName: user.displayName || 'Google User',
        email: user.email,
        userType: 'seeker',
        createdAt: new Date(),
        profileCompleted: false,
        photoURL: user.photoURL,
        isGoogleUser: true,
        lastLogin: new Date()
      });
      
      showSuccess('Account setup complete! Redirecting to your dashboard...');
      
      setTimeout(() => {
        window.location.href = 'seeker_dashboard.html';
      }, 1500);
      
    } catch (error) {
      console.error('Error creating user document:', error);
      showFormError('Error setting up account. Please contact support.');
      resetGoogleButton();
    }
  }

  async function handleGoogleAuthError(error) {
    console.error('Google auth error:', error);
    
    const errorCode = error.code;
    const currentDomain = window.location.hostname;
    
    let errorMessage = 'Authentication failed. Please try again.';
    
    switch (errorCode) {
      case 'auth/unauthorized-domain':
        errorMessage = `
          🔒 Domain Not Authorized
          Current domain: ${currentDomain}
          
          Please use an authorized domain like:
          • localhost:5500 (computer)
          • 192.168.1.100:5500 (mobile - same WiFi)
          • ngrok.io URL
          
          Or ask developer to add "${currentDomain}" to Firebase.
        `;
        break;
      case 'auth/popup-closed-by-user':
        errorMessage = 'Google Sign-In was cancelled.';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection.';
        break;
      case 'auth/missing-or-invalid-nonce':
        errorMessage = 'Security token issue. Refreshing page...';
        setTimeout(() => window.location.reload(), 2000);
        return;
      default:
        errorMessage = `Authentication Error: ${error.message}`;
    }
    
    showFormError(errorMessage);
    resetGoogleButton();
  }

  function resetGoogleButton() {
    if (googleLoginBtn) {
      googleLoginBtn.disabled = false;
      googleLoginBtn.innerHTML = googleLoginBtn.id === 'googleSignup' 
        ? '<i class="fab fa-google"></i> Sign up with Google'
        : '<i class="fab fa-google"></i> Google';
    }
  }

  // User type selection for Google signup
  function selectUserType() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      modal.innerHTML = `
        <div style="
          background: white;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 90%;
          text-align: center;
        ">
          <h3 style="margin-bottom: 20px; color: #1e293b;">Select Account Type</h3>
          <p style="margin-bottom: 25px; color: #64748b;">Please choose how you want to use JobMatch Connect</p>
          <button class="user-type-option" data-type="seeker" style="
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1rem;
            font-weight: 600;
          ">
            <i class="fas fa-user-tie" style="margin-right: 10px;"></i>
            Job Seeker
          </button>
          <button class="user-type-option" data-type="employer" style="
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1rem;
            font-weight: 600;
          ">
            <i class="fas fa-building" style="margin-right: 10px;"></i>
            Employer
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const options = modal.querySelectorAll('.user-type-option');
      options.forEach(option => {
        option.addEventListener('mouseenter', function() {
          this.style.borderColor = '#2563eb';
          this.style.backgroundColor = '#dbeafe';
        });
        
        option.addEventListener('mouseleave', function() {
          this.style.borderColor = '#e2e8f0';
          this.style.backgroundColor = 'white';
        });
        
        option.addEventListener('click', function() {
          const selectedType = this.getAttribute('data-type');
          document.body.removeChild(modal);
          resolve(selectedType);
        });
      });
    });
  }

  function showSuccess(message) {
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
    }
    
    const noAccountMessage = document.querySelector('.no-account-message');
    if (noAccountMessage) {
      noAccountMessage.remove();
    }
  }

  // Domain authorization setup
  function setupDomainAuthorization() {
    const currentDomain = window.location.hostname;
    const authorizedDomains = [
      'localhost',
      '127.0.0.1',
      '192.168.1.100', // Replace with your actual IP
      '192.168.1.',    // Your local network
      '10.0.0.',       // Alternative network
      'ngrok.io',
      'loca.lt',
      'joblink-babb6.firebaseapp.com'
    ];

    const isAuthorized = authorizedDomains.some(domain => 
      domain.endsWith('.*') ? currentDomain.startsWith(domain.replace('.*', '')) : 
      domain.endsWith('.') ? currentDomain.startsWith(domain) :
      currentDomain === domain
    );

    console.log('Domain Authorization Check:', {
      currentDomain,
      isAuthorized,
      authorizedDomains
    });

    if (!isAuthorized) {
      showDomainHelp(currentDomain, authorizedDomains);
    }

    return isAuthorized;
  }

  function showDomainHelp(currentDomain, authorizedDomains) {
    const helpHTML = `
      <div class="domain-alert">
        <div class="alert-header">
          <i class="fas fa-info-circle"></i>
          <span>Domain Authorization Needed</span>
        </div>
        <div class="alert-content">
          <p><strong>Current Domain:</strong> <code>${currentDomain}</code></p>
          <p>Google Sign-In may not work on this domain.</p>
          
          <div class="authorized-domains">
            <h4>✅ Authorized Domains:</h4>
            <ul>
              ${authorizedDomains.map(domain => `<li><code>${domain}</code></li>`).join('')}
            </ul>
          </div>

          <div class="quick-fixes">
            <h4>🚀 Quick Fixes:</h4>
            <div class="fix-option">
              <strong>Option A:</strong> Use <code>http://localhost:5500</code> on computer
            </div>
            <div class="fix-option">
              <strong>Option B:</strong> Use <code>http://192.168.1.100:5500</code> on mobile
            </div>
            <div class="fix-option">
              <strong>Option C:</strong> Use ngrok: <code>ngrok http 5500</code>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingAlert = document.querySelector('.domain-alert');
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.innerHTML = helpHTML;
    
    const form = document.querySelector('.login-form, .signup-form');
    if (form) {
      form.prepend(alertDiv);
    }
  }

  // Auto-fill for testing
  const urlParams = new URLSearchParams(window.location.search);
  const demoEmail = urlParams.get('email');
  
  if (demoEmail && emailInput) {
    emailInput.value = demoEmail;
  }
  
  if (urlParams.get('demo') === 'true' && emailInput && passwordInput) {
    emailInput.value = 'demo@jobmatch.com';
    passwordInput.value = 'password123';
  }

  // Cleanup when page unloads
  window.addEventListener('beforeunload', function() {
    googleLoginInProgress = false;
  });
});