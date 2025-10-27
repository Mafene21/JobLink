// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc 
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

  // Firebase user login
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

  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    
    // Remove any no-account message
    const noAccountMessage = document.querySelector('.no-account-message');
    if (noAccountMessage) {
      noAccountMessage.remove();
    }
  }

  // Social login buttons
  document.querySelector('.btn-google').addEventListener('click', function() {
    showFormError('Google login will be available soon.');
  });

  document.querySelector('.btn-linkedin').addEventListener('click', function() {
    showFormError('LinkedIn login will be available soon.');
  });

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
  }
});