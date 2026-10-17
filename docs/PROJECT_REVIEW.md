# Project review

## Completed

- Separated deployable browser files in `public/` from SQL, tests, scripts, and documentation.
- Preserved page URLs. The old `seeker.html` address redirects to the single profile form.
- Removed duplicate profile styles and dashboard matching code.
- Added shared matching, safe HTML rendering, delegated button actions, CSV generation, and local placeholder images.
- Escaped template values, sanitized HTML with a pinned local DOMPurify module, removed inline event attributes, and added Content Security Policy metadata.
- Removed browser console logging of full profiles and applications.
- Restricted resume URLs to links generated from private storage paths.
- Implemented job editing in the posting form while preserving the existing job and poster.
- Replaced simulated exports with CSV downloads and protected exported cells against spreadsheet formula execution.
- Replaced simulated messages and hardcoded EmailJS integration with explicit email drafts.
- Implemented FAQ search and browser-saved search filters; removed claims of automated job notifications.
- Repaired missing-page links, added application and resume guidance, and removed invented traction numbers and contact details.
- Improved navigation buttons, focus indicators, dialog labels, image fallbacks, and external links.
- Added structure checks and browser regressions for editing, downloads, navigation, and injected markup.
- Fixed public search to include the full active catalog, fetched in batches of 500, rather than searching only the first 12 or 1,000 rows.
- Made both Load More buttons append results and reset correctly when filters change; corrected empty-result counts.
- Unified skills and free-text requirements across posting, cards, and job details.
- Corrected comma-separated and abbreviated UGX salary comparisons, removed dollar filters, and kept undisclosed or foreign-currency salaries out of UGX comparisons.
- Added optional experience levels to the job form so the existing experience filter can match posted jobs.
- Deferred company profile requests until opening job details and reused responses for the same employer; fixed the company logo fallback.
- Added persistent, retryable loading errors so connection failures are not presented as an empty catalog.
- Configured the corrected Supabase Project URL and verified the publishable key, authentication settings, public jobs table, and aggregate statistics against the live project.
- Checked the homepage and both public job search pages with live Supabase responses; all loaded successfully without browser errors.
- Published the Supabase migration and UI changes to GitHub and Vercel. Added static hosting configuration that serves only `public/`, preserves `.html` addresses, and supplies response security headers. The public production address is `https://joblink-pied.vercel.app`.

## UI and interaction refresh

- Added `assets/css/design.css` for consistent colors, typography, controls, cards, and focus styles across the project.
- Shortened the homepage and placed vacancies before the explanatory sections; removed the large statistics cards from the introduction.
- Consolidated browsing into `jobs.html`; `browse_jobs.html` preserves existing links through a redirect, including query parameters.
- Added mobile filter controls, removable filter chips, and consistent salary, experience, and category options.
- Stored search state and loaded result pages in the URL, with scroll restoration when returning from job details.
- Added `job.html?id=…` with complete requirements, deadlines, share links, save/unsave actions, and a short application form.
- Preserved selected jobs across sign-in and supported applying without an uploaded resume. Added inline file errors and persistent submission confirmation.
- Replaced AI and percentage claims on suggestion cards with actual matching reasons; compacted mobile dashboard statistics.
- Moved account role selection to the beginning of signup and added automatic drafts for profile editing.
- Added shared dialog focus entry, keyboard containment, background interaction prevention, Escape handling, and focus restoration. Added reduced-motion styling.
- Browser regressions cover signed-out application journeys, direct applications, optional and private resumes, saved jobs, search history, dialog navigation, mobile layouts, and a catalog of 1,003 jobs.

These changes do not alter the database schema or require rerunning `supabase/setup.sql`.

## Google sign-in

- Added Google buttons to login and signup using Supabase Auth. The buttons check whether the provider is enabled before offering sign-in.
- Added first-time account selection, automatic seeker/company profile creation, and redirects back to the selected job. Returning users retain their account role and Remember Me preference.
- Added `supabase/google-auth.sql` for the existing database; the full setup also includes the change. No sample accounts or jobs are inserted.
- Verified that the live project has both email and Google enabled. The account setup RPC is registered and rejects signed-out calls with the expected permission error. The sign-in endpoint redirects to Google with this project's Supabase callback URL. A real Google consent, callback, and account setup still need testing.

## Owner information and external setup still needed

- Configure authentication callbacks and email delivery; run live account and upload checks.
- Test a real Google login, including Google consent, the return to JobLink, and first-time account setup. The Google provider is enabled and the account setup function is registered. See `docs/GOOGLE_SIGN_IN.md`.
- Supply verified support contacts, brand information, and real privacy/terms documents for public use.
- Decide whether automated notifications, internal messaging, and support ticket handling are needed. Current contact actions open email drafts.

## Later improvements

- Move search filters and pagination into server queries as the catalog grows. Public search currently fetches the full active catalog in batches and filters it in the browser; this avoids missing results but increases initial loading work for large catalogs.
- Replace per-job dashboard queries with aggregate endpoints for larger employer accounts.
- Add file replacement cleanup and account deletion, after deciding how application history and attachments should be retained.
- Add error monitoring and a dependency update routine before public operation.
- Verify security headers and authentication redirects on the final deployed domain.

Database checks use isolated Postgres. Automated browser checks use mocked Supabase responses. A separate read-only check on 2026-10-17 verified the three public pages against the live project. No live users, jobs, or uploads were created by these checks; full hosted account workflows still need testing.
