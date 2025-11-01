// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
  const signupForm = document.getElementById('signupForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const userTypeSelect = document.getElementById('userType');
  const agreeTermsInput = document.getElementById('agreeTerms');
  const signupButton = document.getElementById('signupButton');
  const btnLoader = document.getElementById('btnLoader');
  const successMessage = document.getElementById('successMessage');

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
      showSuccess('Account created successfully! Redirecting to login...');
      
      // Redirect to login page after a delay
      setTimeout(() => {
        window.location.href = 'login.html';
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