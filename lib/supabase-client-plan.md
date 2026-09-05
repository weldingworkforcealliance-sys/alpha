# Supabase Browser Client Consolidation Plan

Current state: the repository contains a small reusable browser client helper, but most client components instantiate `createBrowserClient(...)` directly.

Decision: standardize on one canonical browser client module in the next cleanup phase rather than changing every client component during Phase 1.

Target module: `lib/supabase-browser.ts` (or a renamed `lib/supabase/client.ts`).

Phase 2 should migrate consumers incrementally, verify auth/session behavior, then remove direct `createBrowserClient(...)` duplication from feature pages.
