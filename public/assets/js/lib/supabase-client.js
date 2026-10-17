import '../vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js';

const { createClient } = globalThis.supabase;

// Keep unchecked "Remember me" sessions in this tab, including token refreshes.
const rememberKey = 'joblink.rememberSession';
const sessionStorageAdapter = {
    getItem(key) {
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    },
    setItem(key, value) {
        const remember = localStorage.getItem(rememberKey) === 'true';
        const target = remember ? localStorage : sessionStorage;
        const other = remember ? sessionStorage : localStorage;
        other.removeItem(key);
        target.setItem(key, value);
    },
    removeItem(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: sessionStorageAdapter, persistSession: true, detectSessionInUrl: true }
});

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user ?? null;
}

export function onAuthStateChanged(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(event)) return;
        // Database calls must run outside Supabase's auth callback lock.
        setTimeout(() => {
            Promise.resolve(callback(session?.user ?? null)).catch(error => {
                console.error('Unable to load the signed-in account:', error);
            });
        }, 0);
    });
    return () => data.subscription.unsubscribe();
}

export async function signIn(email, password, remember = false) {
    sessionStorage.removeItem('joblink.oauthAccountType');
    localStorage.setItem(rememberKey, String(remember));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function googleSignInAvailable() {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Google sign-in could not be checked. Please try again.');
    const settings = await response.json();
    return settings.external?.google === true;
}

export async function signInWithGoogle({ remember = false, accountType = null } = {}) {
    if (!await googleSignInAvailable()) throw new Error('Google sign-in is currently unavailable. Please continue with email.');
    localStorage.setItem(rememberKey, String(remember));
    sessionStorage.removeItem('joblink.oauthAccountType');
    if (['seeker', 'employer'].includes(accountType)) sessionStorage.setItem('joblink.oauthAccountType', accountType);
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: new URL('auth.html', location.href).href, queryParams: { prompt: 'select_account' } }
    });
    if (error) { sessionStorage.removeItem('joblink.oauthAccountType'); throw error; }
    return data;
}

export async function signUp(email, password, fullName, userType) {
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
            data: { full_name: fullName, user_type: userType },
            emailRedirectTo: new URL('auth.html', window.location.href).href
        }
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem(rememberKey);
    sessionStorage.removeItem('joblink.oauthAccountType');
    // Personal profile drafts must not carry over to another account.
    for (const key of ['profileDraft', 'userProfilePicture']) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('joblink.profileDraft:')) sessionStorage.removeItem(key);
    }
}

export function safeReturnUrl(value, fallback) {
    if (!value) return fallback;
    try {
        const target = new URL(value, window.location.href);
        if (target.origin === window.location.origin && /\.html$/.test(target.pathname)
            && !/\/(login|register|auth|forgot_password)\.html$/.test(target.pathname)) {
            return target.href;
        }
    } catch { /* Use the dashboard for invalid return addresses. */ }
    return fallback;
}
