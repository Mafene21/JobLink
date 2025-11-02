// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
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
  setDoc
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

// Configure Google Provider with custom parameters to prevent nonce issues
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: ''
});

// Add scopes
googleProvider.addScope('email');
googleProvider.addScope('profile');

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  const loginButton = document.getElementById('loginButton');
  const btnLoader = document.getElementById('btnLoader');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const formError = document.getElementById('formError');
  const successMessage = document.getElementById('successMessage');
  const rememberMe = document.getElementById('rememberMe');
  const googleLoginBtn = document.querySelector('.btn-google');
  const linkedinLoginBtn = document.querySelector('.btn-linkedin');

  // Track Google login attempts to prevent duplicates
  let googleLoginInProgress = false;

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
  togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    const icon = this.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  // Real-time validation
  emailInput.addEventListener('input', function() {
    validateEmail();
    clearFormError();
  });

  passwordInput.addEventListener('input', function() {
    validatePassword();
    clearFormError();
  });

  // Form submission
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (validateForm()) {
      loginUser();
    }
  });

  // Google Login with protection against duplicate clicks
  googleLoginBtn.addEventListener('click', function() {
    if (!googleLoginInProgress) {
      loginWithGoogle();
    }
  });

  // LinkedIn Login (placeholder)
  linkedinLoginBtn.addEventListener('click', function() {
    showFormError('LinkedIn login will be available soon.');
  });

  // Validation functions
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
    const password = passwordInput.value.trim();
    
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

  function validateForm() {
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    
    return isEmailValid && isPasswordValid;
  }

  function showError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  function clearError(errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }

  function clearFormError() {
    formError.textContent = '';
    formError.style.display = 'none';
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.style.display = 'block';
  }

  function showNoAccountMessage(email) {
    // Remove any existing message
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
    
    loginForm.insertBefore(messageDiv, loginForm.firstChild);
  }

  // Firebase user login with email/password
  async function loginUser() {
    // Show loading state
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    clearFormError();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    try {
      // Set persistence based on remember me checkbox
      const persistence = rememberMe.checked ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user data from Firestore to determine user type
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;
        
        showSuccess('Login successful! Redirecting to your dashboard...');
        
        // Redirect based on user type
        setTimeout(() => {
          if (userType === 'employer') {
            window.location.href = 'employer_dashboard.html';
          } else {
            window.location.href = 'seeker_dashboard.html';
          }
        }, 1500);
      } else {
        // User document doesn't exist (shouldn't happen in normal flow)
        showFormError('User data not found. Please contact support.');
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
      }
      
    } catch (error) {
      // Handle errors
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

  // Google Login function with enhanced error handling
  async function loginWithGoogle() {
    if (googleLoginInProgress) {
      return; // Prevent multiple simultaneous logins
    }

    googleLoginInProgress = true;
    
    try {
      // Show loading state on Google button
      googleLoginBtn.disabled = true;
      const originalContent = googleLoginBtn.innerHTML;
      googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
      
      // Clear any existing errors
      clearFormError();
      
      console.log('Starting Google Sign-In...');
      
      // Add a small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('Google login successful for:', user.email);
      
      await handleSuccessfulGoogleLogin(user);
      
    } catch (error) {
      await handleGoogleLoginError(error);
    } finally {
      googleLoginInProgress = false;
    }
  }

  async function handleSuccessfulGoogleLogin(user) {
    try {
      // Check if user document exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userType = userData.userType;
        
        showSuccess('Google login successful! Redirecting to your dashboard...');
        
        // Redirect based on user type
        setTimeout(() => {
          if (userType === 'employer') {
            window.location.href = 'employer_dashboard.html';
          } else {
            window.location.href = 'seeker_dashboard.html';
          }
        }, 1500);
      } else {
        // User signed in with Google but no Firestore document - create one
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
      
      // Create a basic user document with default as job seeker
      await setDoc(doc(db, 'users', user.uid), {
        fullName: user.displayName || 'Google User',
        email: user.email,
        userType: 'seeker', // Default to job seeker
        createdAt: new Date(),
        profileCompleted: false,
        photoURL: user.photoURL,
        isGoogleUser: true,
        lastLogin: new Date()
      });
      
      showSuccess('Account setup complete! Redirecting to your dashboard...');
      
      // Redirect to seeker dashboard (default)
      setTimeout(() => {
        window.location.href = 'seeker_dashboard.html';
      }, 1500);
      
    } catch (error) {
      console.error('Error creating user document:', error);
      showFormError('Error setting up account. Please contact support.');
      resetGoogleButton();
    }
  }

  async function handleGoogleLoginError(error) {
    console.error('Google login error details:', error);
    
    const errorCode = error.code;
    let errorMessage = 'Login failed. Please try again.';
    let shouldResetButton = true;
    
    switch (errorCode) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Google login was cancelled.';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'Popup was blocked. Please allow popups for this site or try email login.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection.';
        break;
      case 'auth/unauthorized-domain':
        errorMessage = 'This domain is not authorized for Google Sign-In. Please contact support.';
        break;
      case 'auth/missing-or-invalid-nonce':
        errorMessage = 'Security token issue. Please refresh the page and try again.';
        // Force page refresh after delay
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        shouldResetButton = false;
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Login process was cancelled. Please try again.';
        break;
      case 'auth/account-exists-with-different-credential':
        errorMessage = 'An account already exists with this email. Please use email login.';
        break;
      default:
        if (error.message.includes('nonce')) {
          errorMessage = 'Security error. Refreshing page...';
          setTimeout(() => window.location.reload(), 2000);
          shouldResetButton = false;
        } else {
          errorMessage = `Login error: ${error.message}`;
        }
    }
    
    showFormError(errorMessage);
    
    if (shouldResetButton) {
      resetGoogleButton();
    }
  }

  function resetGoogleButton() {
    googleLoginBtn.disabled = false;
    googleLoginBtn.innerHTML = '<i class="fab fa-google"></i> Google';
  }

  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    
    // Remove any no-account message
    const noAccountMessage = document.querySelector('.no-account-message');
    if (noAccountMessage) {
      noAccountMessage.remove();
    }
  }

  // Auto-fill for testing
  const urlParams = new URLSearchParams(window.location.search);
  const demoEmail = urlParams.get('email');
  
  if (demoEmail) {
    emailInput.value = demoEmail;
  }
  
  if (urlParams.get('demo') === 'true') {
    emailInput.value = 'demo@jobmatch.com';
    passwordInput.value = 'password123';
  }

  // Add a cleanup function when page unloads
  window.addEventListener('beforeunload', function() {
    googleLoginInProgress = false;
  });
});