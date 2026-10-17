import { googleSignInAvailable, signInWithGoogle } from './supabase-client.js';

// Shared by login and registration; account choice is optional here because a
// first Google login can choose it on the callback screen instead.
export function initializeGoogleSignIn({ accountType = () => null, remember = () => false } = {}) {
    const button = document.getElementById('googleSignIn');
    const status = document.getElementById('googleSignInStatus');
    const error = document.getElementById('googleSignInError');
    button.addEventListener('click', async () => {
        button.disabled = true;
        error.textContent = '';
        status.textContent = 'Opening Google sign-in...';
        try { await signInWithGoogle({ accountType: accountType(), remember: remember() }); }
        catch (failure) {
            error.textContent = failure.message || 'Google sign-in could not be started. Please try again.';
            status.textContent = '';
            button.disabled = false;
        }
    });
    googleSignInAvailable().then(available => {
        button.disabled = !available;
        status.textContent = available ? '' : 'Google sign-in is currently unavailable. You can continue with email.';
    }).catch(() => {
        button.disabled = false;
        status.textContent = 'Google sign-in could not be checked. Try again or continue with email.';
    });
}
