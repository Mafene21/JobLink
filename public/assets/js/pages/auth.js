import { getCurrentUser, safeReturnUrl } from '../lib/supabase-client.js';
import { getRecord, createGoogleAccount } from '../lib/data-service.js';

const status = document.getElementById('authStatus');
const form = document.getElementById('googleAccountForm');
const button = document.getElementById('completeGoogleAccount');
const error = document.getElementById('authError');

function continueToAccount(profile) {
    sessionStorage.removeItem('joblink.oauthAccountType');
    const destination = profile.profileCompleted
        ? profile.userType === 'employer' ? 'employer_dashboard.html' : 'seeker_dashboard.html'
        : profile.userType === 'employer' ? 'employer_profile.html' : 'seeker.html';
    const returnUrl = sessionStorage.getItem('returnUrl');
    sessionStorage.removeItem('returnUrl');
    location.replace(safeReturnUrl(returnUrl, destination));
}

async function finishGoogleAccount(accountType) {
    button.disabled = true;
    error.textContent = '';
    status.textContent = 'Setting up your JobLink account...';
    try {
        const profile = await createGoogleAccount(accountType);
        continueToAccount(profile);
    } catch (failure) {
        error.textContent = failure.message || 'Your account could not be set up. Please try again.';
        status.textContent = 'Choose how you want to use JobLink.';
        button.disabled = false;
    }
}

form.addEventListener('submit', event => {
    event.preventDefault();
    if (!button.disabled) finishGoogleAccount(new FormData(form).get('accountType'));
});

try {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.slice(1));
    const oauthError = query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error');
    if (oauthError) {
        sessionStorage.removeItem('joblink.oauthAccountType');
        throw new Error(`Sign-in was not completed. ${oauthError}`);
    }
    const user = await getCurrentUser();
    if (!user) {
        location.replace('login.html');
    } else {
        const profile = await getRecord('users', user.id);
        if (profile) continueToAccount(profile);
        else if (user.app_metadata?.provider === 'google') {
            status.textContent = 'Choose how you want to use JobLink. This sets your account type.';
            const identity = document.getElementById('authIdentity');
            identity.textContent = `Signed in as ${user.email || user.user_metadata?.full_name || 'your Google account'}`;
            identity.hidden = false;
            form.hidden = false;
            const pendingType = sessionStorage.getItem('joblink.oauthAccountType');
            sessionStorage.removeItem('joblink.oauthAccountType');
            if (['seeker', 'employer'].includes(pendingType)) {
                form.querySelector(`input[value="${pendingType}"]`).checked = true;
                await finishGoogleAccount(pendingType);
            } else form.querySelector('input').focus();
        } else throw new Error('Your account profile could not be found. Please contact support.');
    }
} catch (failure) {
    error.textContent = failure.message || 'Unable to finish sign-in. Please try again.';
    status.textContent = 'Sign-in needs your attention.';
}
