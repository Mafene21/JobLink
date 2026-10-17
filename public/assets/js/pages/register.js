import { signUp, signOut } from '../lib/supabase-client.js';
import { initializeGoogleSignIn } from '../lib/google-sign-in.js';

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const userTypeSelect = document.getElementById('userType');
  const signupButton = document.getElementById('signupButton');
  const btnLoader = document.getElementById('btnLoader');
  const successMessage = document.getElementById('successMessage');
  initializeGoogleSignIn({ accountType: () => userTypeSelect.value });

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
    this.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');

    const icon = this.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  // Real-time validation
  fullNameInput.addEventListener('input', validateFullName);
  emailInput.addEventListener('input', validateEmail);
  passwordInput.addEventListener('input', validatePassword);
  userTypeSelect.addEventListener('change', validateUserType);
  document.querySelectorAll('input[name="accountRole"]').forEach(input => input.addEventListener('change', () => {
    userTypeSelect.value = input.value;
    validateUserType();
  }));

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

  function validateForm() {
    const isFullNameValid = validateFullName();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isUserTypeValid = validateUserType();

    return isFullNameValid && isEmailValid && isPasswordValid && isUserTypeValid;
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

  // Supabase user registration
  async function registerUser() {
    // Show loading state
    signupButton.classList.add('loading');
    signupButton.disabled = true;

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const userType = userTypeSelect.value;

    try {
      // The database trigger creates profiles even when email confirmation is required.
      const { session } = await signUp(email, password, fullName, userType);
      if (session) await signOut();
      showSuccess(session
        ? 'Account created. You can now log in.'
        : 'Check your email for a confirmation link before logging in. If you already have an account, log in instead.');
      const link = document.createElement('a');
      link.href = `login.html?email=${encodeURIComponent(email)}`;
      link.textContent = ' Go to login';
      successMessage.appendChild(link);
      signupButton.classList.remove('loading');
      signupButton.disabled = false;
    } catch (error) {
      // Handle errors
      signupButton.classList.remove('loading');
      signupButton.disabled = false;

      const errorCode = error.code;
      let errorMessage = 'An error occurred during registration. Please try again.';

      if (errorCode === 'user_already_exists') {
        errorMessage = 'This email is already registered. Please use a different email or login.';
        showError('emailError', errorMessage);
      } else if (errorCode === 'weak_password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
        showError('passwordError', errorMessage);
      } else if (errorCode === 'email_address_invalid') {
        errorMessage = 'Invalid email address. Please check your email.';
        showError('emailError', errorMessage);
      } else if (errorCode === 'network_error') {
        errorMessage = 'Network error. Please check your internet connection.';
        showError('emailError', errorMessage);
      } else {
        showError('emailError', error.message || errorMessage);
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
    document.querySelector(`input[name="accountRole"][value="${userType}"]`).checked = true;
  }
});
