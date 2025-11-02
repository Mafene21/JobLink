// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
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
const googleProvider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const userTypeSelect = document.getElementById('userType');
  const agreeTermsInput = document.getElementById('agreeTerms');
  const signupButton = document.getElementById('signupButton');
  const btnLoader = document.getElementById('btnLoader');
  const successMessage = document.getElementById('successMessage');
  const googleSignupBtn = document.getElementById('googleSignup');

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
  document.getElementById('togglePassword').addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    const icon = this.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  // Real-time validation
  fullNameInput.addEventListener('input', validateFullName);
  emailInput.addEventListener('input', validateEmail);
  passwordInput.addEventListener('input', validatePassword);
  userTypeSelect.addEventListener('change', validateUserType);
  agreeTermsInput.addEventListener('change', validateTerms);

  // Form submission
  signupForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (validateForm()) {
      registerUser();
    }
  });

  // Google Signup
  googleSignupBtn.addEventListener('click', signUpWithGoogle);

  // Validation functions
  function validateFullName() {
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
      showError('emailError', 'Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      showError('emailError', 'Please enter a valid email address');
      return false;
    } else {
      clearError('emailError');
      return true;
    }
  }

  function validatePassword() {
    const password = passwordInput.value;
    
    if (!password) {
      showError('passwordError', 'Password is required');
      return false;
    } else if (password.length < 6) {
      showError('passwordError', 'Password must be at least 6 characters');
      return false;
    } else {
      clearError('passwordError');
      return true;
    }
  }

  function validateUserType() {
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
    if (!agreeTermsInput.checked) {
      showError('termsError', 'You must agree to the terms and conditions');
      return false;
    } else {
      clearError('termsError');
      return true;
    }
  }

  function validateForm() {
    const isFullNameValid = validateFullName();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isUserTypeValid = validateUserType();
    const isTermsValid = validateTerms();
    
    return isFullNameValid && isEmailValid && isPasswordValid && isUserTypeValid && isTermsValid;
  }

  function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }

  // Firebase user registration
  async function registerUser() {
    // Show loading state
    signupButton.classList.add('loading');
    signupButton.disabled = true;
    
    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const userType = userTypeSelect.value;
    
    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Save additional user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        fullName: fullName,
        email: email,
        userType: userType,
        createdAt: serverTimestamp(),
        profileCompleted: false
      });
      
      // Show success message
      showSuccess('Account created successfully! Redirecting to your dashboard...');
      
      // Redirect to appropriate dashboard based on user type
      setTimeout(() => {
        if (userType === 'employer') {
          window.location.href = 'employer_dashboard.html';
        } else {
          window.location.href = 'seeker_dashboard.html';
        }
      }, 2000);
      
    } catch (error) {
      // Handle errors
      signupButton.classList.remove('loading');
      signupButton.disabled = false;
      
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

  // Google Signup function
  async function signUpWithGoogle() {
    try {
      // Show loading state on Google button
      googleSignupBtn.disabled = true;
      googleSignupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Signing up...</span>';
      
      // Show user type selection modal
      const userType = await selectUserType();
      if (!userType) {
        googleSignupBtn.disabled = false;
        googleSignupBtn.innerHTML = '<i class="fab fa-google"></i><span>Sign up with Google</span>';
        return;
      }
      
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        fullName: user.displayName,
        email: user.email,
        userType: userType,
        createdAt: serverTimestamp(),
        profileCompleted: false,
        photoURL: user.photoURL
      });
      
      // Show success message
      showSuccess('Google account linked successfully! Redirecting to your dashboard...');
      
      // Redirect to appropriate dashboard based on user type
      setTimeout(() => {
        if (userType === 'employer') {
          window.location.href = 'employer_dashboard.html';
        } else {
          window.location.href = 'seeker_dashboard.html';
        }
      }, 2000);
      
    } catch (error) {
      // Handle errors
      googleSignupBtn.disabled = false;
      googleSignupBtn.innerHTML = '<i class="fab fa-google"></i><span>Sign up with Google</span>';
      
      const errorCode = error.code;
      let errorMessage = 'An error occurred during Google sign up. Please try again.';
      
      if (errorCode === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign up was cancelled.';
      } else if (errorCode === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (errorCode === 'auth/unauthorized-domain') {
        errorMessage = 'Domain not authorized. Please contact support.';
      }
      
      showError('emailError', errorMessage);
      console.error('Google sign up error:', error);
    }
  }

  // User type selection for Google signup
  function selectUserType() {
    return new Promise((resolve) => {
      // Create modal for user type selection
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
      
      // Add hover effects
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
    successMessage.textContent = message;
    successMessage.style.display = 'block';
  }

  // Auto-fill for testing
  const urlParams = new URLSearchParams(window.location.search);
  const userType = urlParams.get('type');
  
  if (userType === 'employer' || userType === 'seeker') {
    userTypeSelect.value = userType;
  }
});