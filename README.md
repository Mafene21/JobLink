# JobLink

A recruitment website built with HTML, CSS, JavaScript, and Supabase. Job seekers can manage profiles and applications; employers can publish jobs and review candidates.

Website: [joblink-pied.vercel.app](https://joblink-pied.vercel.app).

## Run locally

```sh
npm start
```

Open `http://localhost:8000`. Node.js 20+ is required. The preview serves only `public/`; there is no frontend build step.

See [setup instructions](docs/SETUP.md) for Supabase, authentication, email delivery, and live testing.
To activate Google login, follow [Google sign-in setup](docs/GOOGLE_SIGN_IN.md). The app code is ready; the SQL update and provider configuration must be applied to the hosted project.
See [Vercel deployment](docs/DEPLOYMENT.md) for production settings and authentication redirects.

## Project layout

```text
public/                     Deploy this folder
  *.html                    Website pages; existing URLs are preserved
  assets/
    css/pages/              Page styles
    css/shared.css          Shared accessibility and UI styles
    css/design.css          Shared colors, components, and responsive layouts
    images/                 Local image placeholders
    js/
      config/               Public Supabase configuration and site contacts
      lib/                  Authentication, data, matching, rendering, and CSV
      pages/                Page controllers
      vendor/               Pinned Supabase and DOMPurify modules and licenses
supabase/setup.sql          Database schema, triggers, access rules, and storage
scripts/                    Local preview and dependency vendoring
tests/                      Structure, model, matching, CSV, database, and browser checks
docs/                       Setup guide and project review
```

The project URL and browser publishable key are in [Supabase configuration](public/assets/js/config/supabase.js). Database passwords and secret keys do not belong in frontend files.

## Main screens

- `index.html` introduces JobLink and shows recent vacancies near the top.
- `jobs.html` is the shared public search page. Filters, sorting, and the number of loaded results are kept in the URL. The former `browse_jobs.html` address redirects here.
- `job.html?id=…` shows a shareable vacancy, save controls, and a short application form with an optional private resume. Visitors return to this job after signing in.
- Employer and seeker dashboards keep their existing workflows, using the shared styles. Suggestions explain matching preferences instead of claiming AI predictions.

Profile changes automatically save as drafts in the current tab. Publishing the profile saves it to Supabase and clears the draft. Saved searches stay in the browser; they do not send emails.

## Checks

```sh
npm ci
npm test
npm run test:browser
```

Tests cover local links and imports, data mappings, matching, salary parsing, CSV exports, and database access rules. Database tests run in isolated Postgres through PGlite. Browser tests use the real locally bundled SDK with mocked Supabase responses, including a catalog of more than 1,000 jobs, and do not create live users or jobs.

Browser checks use installed Chrome when available. Otherwise run `npx playwright install chromium`, or set `CHROME_PATH` to a Chromium executable.

DOMPurify and the Supabase SDK are pinned in `package.json` and included locally. After updating either dependency, run `npm run vendor` and rerun the checks. Their upstream licenses are included.

## Current status

The project has been reorganized and the main local workflows improved. The corrected Supabase connection and live public-page reads have been verified. Authentication callbacks, email delivery, and real account and upload workflows still need checking. Contact actions open email drafts rather than sending messages automatically.

See the [project review](docs/PROJECT_REVIEW.md) for completed changes and remaining work.
