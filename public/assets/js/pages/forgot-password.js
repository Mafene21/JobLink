import { supabase, getCurrentUser, signOut } from '../lib/supabase-client.js';

const resetMode = new URLSearchParams(location.search).get('mode') === 'reset';
const status = document.getElementById('resetStatus');
const email = document.getElementById('email');
const password = document.getElementById('password');
const button = document.getElementById('resetButton');
if (resetMode) {
    document.getElementById('emailGroup').hidden = true;
    document.getElementById('passwordGroup').hidden = false;
    email.required = false;
    password.required = true;
    button.textContent = 'Save new password';
    status.textContent = 'Choose your new password.';
}
document.getElementById('resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    try {
        if (resetMode) {
            if (!await getCurrentUser()) throw new Error('This reset link has expired. Please request another one.');
            const { error } = await supabase.auth.updateUser({ password: password.value });
            if (error) throw error;
            await signOut();
            status.textContent = 'Password updated. You can now log in.';
            document.getElementById('resetForm').hidden = true;
        } else {
            const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
                redirectTo: new URL('forgot_password.html?mode=reset', location.href).href
            });
            if (error) throw error;
            status.textContent = 'If an account exists for this address, you will receive a reset link.';
        }
    } catch (error) {
        status.textContent = error.message || 'Unable to reset your password. Please try again.';
    } finally {
        button.disabled = false;
    }
});
