import { escapeHTML, setHTML } from '../lib/ui.js';
import { signIn, safeReturnUrl } from '../lib/supabase-client.js';
import { getRecord } from '../lib/data-service.js';
import { initializeGoogleSignIn } from '../lib/google-sign-in.js';

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  emailInput.value = new URLSearchParams(location.search).get('email') || '';
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  const loginButton = document.getElementById('loginButton');
  const btnLoader = document.getElementById('btnLoader');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const formError = document.getElementById('formError');
  const successMessage = document.getElementById('successMessage');
  const rememberMe = document.getElementById('rememberMe');
  initializeGoogleSignIn({ remember: () => rememberMe.checked });

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
    this.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');

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
    setHTML(messageDiv, `
      No account found with email: <strong>${escapeHTML(email)}</strong>. 
      <a href="register.html?email=${escapeHTML(encodeURIComponent(email))}">Create an account here</a>
    `);

    loginForm.insertBefore(messageDiv, loginForm.firstChild);
  }

  // Supabase user login
  async function loginUser() {
    // Show loading state
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    clearFormError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      const { user } = await signIn(email, password, rememberMe.checked);
      const userData = await getRecord('users', user.id);
      if (userData) {
        const userType = userData.userType;
        showSuccess('Login successful! Redirecting to your dashboard...');

        // Redirect based on user type
        setTimeout(() => {
          const destination = userData.profileCompleted
            ? userType === 'employer' ? 'employer_dashboard.html' : 'seeker_dashboard.html'
            : userType === 'employer' ? 'employer_profile.html' : 'seeker.html';
          const returnUrl = sessionStorage.getItem('returnUrl');
          sessionStorage.removeItem('returnUrl');
          window.location.href = safeReturnUrl(returnUrl, destination);
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

      if (errorCode === 'user_not_found') {
        errorMessage = 'No account found with this email address.';
        showNoAccountMessage(email);
      } else if (errorCode === 'invalid_credentials') {
        errorMessage = 'The email or password is incorrect.';
        showError(passwordError, errorMessage);
      } else if (errorCode === 'email_address_invalid') {
        errorMessage = 'Invalid email address. Please check your email.';
        showError(emailError, errorMessage);
      } else if (errorCode === 'over_request_rate_limit') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
        showFormError(errorMessage);
      } else if (errorCode === 'network_error') {
        errorMessage = 'Network error. Please check your internet connection.';
        showFormError(errorMessage);
      } else if (errorCode === 'email_not_confirmed') {
        showFormError('Please confirm your email using the link in your inbox before logging in.');
      } else {
        showFormError(error.message || errorMessage);
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

  // Auto-fill for testing
  const urlParams = new URLSearchParams(window.location.search);
  const demoEmail = urlParams.get('email');

  if (demoEmail) {
    emailInput.value = demoEmail;
  }


});
