# Staging preview validation

Scope: Gltg `ezlvivmeneefiiwqwgqd`, security review draft PR #112. Never promote this preview.

The PR targets `main`; the existing Netlify project's configured production/allowed deployment branch is `product/standalone-mainline-2026-09-11`. That mismatch prevents the normal PR 112 preview from being generated. Do not retarget, merge, or change production branch settings to work around it.

A manual draft can use the existing site `c042bc07-fa6f-426d-8256-ceffee86f5cb` with the unique alias `ltg-security-staging-20260925`. Netlify CLI `deploy` defaults to draft. Never supply `--prod`, `--prod-if-unlocked`, or `--trigger`.

## Isolation requirements

- Build with `--context deploy-preview`; the committed netlify.toml pins the Gltg URL/key, staging banner, and MFA off.
- Pin the same four values for deployed functions using repeated `--env KEY=VALUE` options. The CLI documents that these options affect functions only, so they do not replace build-time configuration.
- For the lab smoke baseline, set `NEXT_PUBLIC_TOWER_ENABLED=true` and `NEXT_PUBLIC_WLD110_SHOP_ENABLED=true` only in this draft build/functions.
- Use only the browser-safe publishable key. Do not import production service keys, mail credentials, or cron secrets.
- Verify the deployment is ready, its context is non-production, and its id differs from the site's published production deployment.
- Run `node staging-hardening/tests/preview-isolation.mjs`. It allowlists only this staging alias and http://127.0.0.1:3007, checks public entry points and protected redirects, and scans the scripts referenced by the login page for non-Gltg Supabase project addresses.
- This bundle scan covers the login page's loaded scripts. It does not certify every lazy-loaded module, worker, callback, or external integration.
- Use a signed-in staging account for each role before certifying authenticated workflows, TOTP enrollment/recovery, or account administration.

## Local packaging

Netlify CLI 27.10.0 and Next.js runtime 5.16.0 compiled the app, but online configuration refresh returned HTTP 403 while retrieving extension metadata. The supported `netlify build --offline --context deploy-preview` mode can be tried for local packaging. Only after a successful complete build should `netlify deploy --no-build --context deploy-preview` upload the generated artifacts, with the site, alias, and function environment values explicitly pinned as above. Do not modify access controls or skip a failed build.

References: [draft deploy flags](https://cli.netlify.com/commands/deploy/), [preview branch requirements](https://docs.netlify.com/deploy/deploy-types/deploy-previews/).


## Result on 25 September 2026

Hosted preview remains BLOCKED. Offline mode passed application compilation and server-function packaging but failed edge middleware packaging on Windows: the runtime could not resolve the generated Turbopack module because its path contained a duplicated Windows drive prefix. No complete draft was published. Do not upload the partial artifacts or disable middleware.

Fallback: the compiled application runs locally on http://127.0.0.1:3007, pinned to Gltg. All 18 HTTP/bundle checks passed: six public pages with staging banners, eleven unauthenticated redirects with no-store, and twelve login-page script bundles containing Gltg as their only concrete Supabase project host. Browser inspection verified login, account setup, and Attendance redirecting to login with its return route preserved. Signed-in workflows, hosted edge behavior, TOTP and recovery remain unverified.

Next hosting step: reproduce packaging on Linux or use a properly configured non-production remote build. Keep production deployment settings and the draft PR base unchanged until the alternative is reviewed. The new test and this runbook change no application behavior.
