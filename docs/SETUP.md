# Supabase and local setup

## Start JobLink locally

Run `npm start` from the project folder, then open `http://localhost:8000`. This requires Node.js 20+ and serves only `public/`. No frontend build step or package installation is needed to serve the included assets. An alternative is:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory public
```

Do not serve the repository root: it contains database scripts and development tools. Browser modules must be served over HTTP rather than opened as local files.

## Configure Supabase

1. Create a Free plan project and copy its Project URL and publishable key from the Connect dialog into [`public/assets/js/config/supabase.js`](../public/assets/js/config/supabase.js).
   Use the base Project URL, such as `https://your-project.supabase.co`, without `/rest/v1/`; the SDK adds API paths itself.
2. In the SQL Editor, run the complete [`supabase/setup.sql`](../supabase/setup.sql) file before creating accounts. It creates the tables, signup trigger, access rules, statistics function, and storage buckets. It can be rerun without deleting existing data.
3. In Authentication → URL Configuration, set Site URL to `http://localhost:8000`. Add these Redirect URLs:
   - `http://localhost:8000/auth.html`
   - `http://localhost:8000/forgot_password.html?mode=reset`
4. Enable the Email provider. Confirm the project is active and its Project URL is reachable before testing registration.

The reorganization preserves the page URLs and authentication callbacks. If the SQL has already succeeded, moving the frontend files does not require running it again.

The corrected Project URL and publishable key are configured. Read-only checks on 2026-10-17 confirmed that the homepage and both public job search pages load successfully from the live project. Email signup is enabled with confirmation required. Authentication redirects, email delivery, and private account workflows still need a live account test.

The publishable key is intended for browser use. Keep database passwords, secret keys, and `service_role` keys out of browser files. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Email confirmation and password recovery

The code supports confirmation emails and immediate sessions. When confirmation is enabled, users follow the email link before logging in. The signup trigger creates their profiles without requiring a client session.

Supabase's default email service only delivers to project team addresses and currently allows two messages per hour. Configure custom SMTP for public email delivery. For a private local demo, confirmation can be disabled in the Email provider settings; password reset emails still require delivery. See [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Google sign-in

Google sign-in is implemented on login and signup, but must be enabled in your Google Cloud and Supabase dashboards. Follow the [Google sign-in setup guide](GOOGLE_SIGN_IN.md), starting with the `supabase/google-auth.sql` update for existing projects. Google users choose their JobLink account type once; existing roles are preserved.

## Test the workflows

Create an employer and a seeker account using different email addresses. Complete their profiles, then test posting and editing a job, applying with an optional resume, reviewing the applicant, updating the review status, and withdrawing an application. Also verify logout and Remember Me.

CSV exports download locally. Contact and reference actions open email drafts that users send from their email app. Saved searches store filters in the browser. They do not send automated notifications.

The shared search page is `jobs.html`; old `browse_jobs.html` links redirect to it. Open a vacancy to use its shareable `job.html?id=…` page. Signing in from Apply returns to that vacancy, where a resume is optional and successful submission is confirmed on the page. Search filters and loaded results survive a return to the list.

The UI refresh uses the existing schema. You do not need to rerun the SQL to review the redesigned pages.

## Contacts and hosting

Add verified support details in [`public/assets/js/config/site.js`](../public/assets/js/config/site.js). The support form is unavailable until a support email is configured, then opens email drafts. Supply actual privacy and terms documents before public launch; links to nonexistent legal documents were removed.

Publish the contents of **`public/`** as the website root. Add the deployed frontend address and equivalent callback URLs to Supabase, including any hosting subdirectory. The Supabase Project URL is the backend address, separate from the frontend Site URL.

The fresh setup does not import Firebase data or delete the old Firebase project.
