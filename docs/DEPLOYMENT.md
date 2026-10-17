# Deploy JobLink to Vercel

The GitHub repository is `Mafene21/JobLink`. Its production branch is `main`, and it is connected to the Vercel project `joblink` in `mafene21-5969`.

Public production website: **https://joblink-pied.vercel.app**. Generated deployment addresses may require a Vercel login; use the public address to test JobLink.

## Project settings

Keep the Vercel Root Directory at the repository root. The checked-in `vercel.json` selects the Other framework preset, skips installation and building, and publishes only `public/`. The browser dependencies are already included in that folder.

Keep `.html` URLs enabled: authentication redirects and existing page links use them. There is no single-page application rewrite. SQL, tests, and documentation stay outside the published output.

Pushing a commit to `main` triggers the existing Vercel Git integration. Check that the production deployment shows the same commit SHA before testing the website. See [Vercel's Git deployment documentation](https://vercel.com/docs/git).

## Authentication on the deployed domain

After confirming the production website address, open Supabase **Authentication → URL Configuration**:

- Set Site URL to `https://joblink-pied.vercel.app`.
- Add `https://joblink-pied.vercel.app/auth.html` to the redirect allowlist.
- Add `https://joblink-pied.vercel.app/forgot_password.html?mode=reset` for password recovery.
- Keep the localhost redirects if you still use local development.

In Google Cloud, add the production website origin to the OAuth client's authorized JavaScript origins. Keep the authorized redirect URI as `https://uzmmgcomtmhsclxetrle.supabase.co/auth/v1/callback`; Google returns to Supabase first, which then returns to JobLink.

These dashboard settings are separate from the source code and cannot be changed with the browser publishable key. The Google Client Secret belongs in Supabase's provider settings.

## Verify a release

Before pushing, run `npm test` and `npm run test:browser`. The browser tests use isolated responses and do not add hosted data.

After deployment, check the homepage, job search, login, and signup. Confirm that CSS and browser modules load, and that `/supabase/setup.sql` and `/package.json` return 404. Then test a real Google login on the production website, including the return to `auth.html`, account setup, and logout. Verify password reset and uploads using your own test accounts.
