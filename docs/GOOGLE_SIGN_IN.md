# Enable Google sign-in

The login and signup pages support Google through Supabase Auth. Provider setup is still required in your Google Cloud and Supabase dashboards. You do not need to create an email/password JobLink account before using Google.

## 1. Apply the account setup update

In the existing Supabase project's SQL Editor, run the complete [`supabase/google-auth.sql`](../supabase/google-auth.sql) file **before enabling Google**. It is safe to rerun and preserves existing accounts and roles. A brand-new installation using the current `setup.sql` already includes this update.

This update lets a new Google user choose a JobLink account type once. It creates their profile using their authenticated Google identity, without allowing later role changes or adding sample accounts. It also requests an API schema cache refresh so the new function is available to the frontend.

## 2. Create the Google OAuth client

In [Google Cloud](https://console.cloud.google.com/), select or create a project. Configure the Google Auth Platform branding and audience for JobLink, then create an OAuth client with application type **Web application**. Use the basic OpenID, email, and profile scopes.

Use these addresses for local development:

| Setting in Google | Value |
| --- | --- |
| Authorized JavaScript origin | `http://localhost:8000` |
| Authorized redirect URI | `https://uzmmgcomtmhsclxetrle.supabase.co/auth/v1/callback` |

Save the resulting Client ID and Client Secret. If Google requests test users, add the Google email addresses you will use while testing. See [Supabase's Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 3. Configure Supabase

Open **Authentication → Sign In / Providers → Google**. Enter the Google Client ID and Client Secret, enable the provider, and save. Keep the Client Secret in these provider settings; the frontend continues to use only its publishable Supabase key.

In **Authentication → URL Configuration**, use:

| Supabase setting | Value |
| --- | --- |
| Site URL | `http://localhost:8000` |
| Allowed redirect URL | `http://localhost:8000/auth.html` |

Keep the existing password reset redirect as well. The Google redirect points to Supabase; the Supabase redirect points back to JobLink. These are separate steps. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

For deployment, add the real website origin in Google and its `auth.html` address in Supabase. Keep each sign-in flow on the same website origin from start to finish.

## 4. Test

1. Start JobLink with `npm start` and open `http://localhost:8000/login.html`.
2. Refresh after enabling the provider. The Google button checks the project's public authentication settings and stays unavailable while Google is disabled.
3. Continue with Google. A new user chooses **Find a job** or **Hire people**. A choice already made on the signup page is carried through automatically.
4. Complete the resulting seeker or company profile. Returning users keep their account type and go to their existing workspace.
5. Also test starting from a job's Apply button. After Google sign-in and account setup, it returns to that job. Remember Me is honored when selected on the login page.

Automated tests simulate the OAuth redirect and use isolated database records. They do not replace a real Google consent and login test, and they create no hosted accounts.

## If something fails

- **Google button unavailable:** check that the provider is enabled in Supabase, then refresh the page.
- **Account setup cannot finish:** confirm that `google-auth.sql` succeeded in this same Supabase project.
- **`create_google_account` not found (`PGRST202`):** rerun the complete current `google-auth.sql` file, which includes an API cache refresh. If the file already succeeded, you can also run `notify pgrst, 'reload schema';` in the SQL Editor, wait a few seconds, and retry. See [PostgREST schema cache reloading](https://docs.postgrest.org/en/stable/references/schema_cache.html#schema-cache-reloading-with-notify).
- **`redirect_uri_mismatch`:** compare Google's redirect URI with the exact Supabase callback address above.
- **Redirect reaches the wrong site:** check Supabase's Site URL and allowed redirect URLs.
- **Google blocks access during testing:** review the audience and any test-user requirements in Google Auth Platform.
