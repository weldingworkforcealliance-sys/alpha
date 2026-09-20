# WLD 110 original slide delivery

The existing three resource URLs and their 23 daily selections remain unchanged. Each day shows its mapped original purchased slides, delivered through `/api/wld110-courseware-slide` using the signed-in instructor's Supabase session. Safety Day 11 has three slides; the other day/chapter views have four.

The selected inventory is 26 Chapter 2 Safety slides, 23 Chapter 4 SMAW slides, and 28 Chapter 8 OFC slides. `WLD110_SLIDE_ASSET_MANIFEST.json` records each source filename, source file hash, original slide number, rendered image hash, dimensions, and byte count. Purchased PowerPoint files and rendered image bytes stay outside the public repository.

The source decks contain 61, 80, and 103 slides respectively. The supplied originals were opened read-only in Microsoft PowerPoint and the 77 selected slides were exported at 1920 × 1440, then encoded as WebP at quality 90. No slide content was redrawn or edited. The source deck itself repeats some figures, including OFC Table 8-1; those original source selections are preserved.

## Storage and authentication

`public.instructor_courseware_slide_assets` is the existing private storage mechanism. It stores WebP bytes as base64 with SHA-256 hashes; it is not a public Storage bucket. Existing row-level security permits the PCCC instructor roles and platform owner. Anonymous users have no table privileges. Authenticated users have SELECT only, and the instructor policy still filters every read. Delivery verifies each image hash and uses `private, no-store` so a cached image cannot substitute for a later authorization check.

The asset population only changes rows for the mapped PCCC chapter/slide keys. The legacy OFC slide 13 is outside the current mappings and remains untouched in production. No curriculum, outcomes, modules, schedule segments, planner links, or resource URLs are changed by asset population.

## Verification

- `tests/wld110-courseware-resources.test.ts` exercises all 69 day/chapter views, exact image endpoints, chapter bounds, advertised source ranges, duplicate selections, and previous/next navigation.
- `tests/wld110-courseware-slide.test.ts` covers invalid identifiers, anonymous access, denied row access, hash failure, verified bytes, and private cache headers.
- `supabase/wld110-courseware-access-test.sql` checks the real staging row policies using the approved temporary preview accounts; it rolls back the cross-school test.
- `supabase/wld110-resource-audit.sql` checks live resource links and the Night WLD 110 timing/curriculum authority. The release audit also explicitly requires all 23 days, since an empty view must not count as a pass.

Release remains gated on complete asset checks, CI, instructor and non-instructor preview verification, responsive visual inspection, and unchanged live curriculum/timing fingerprints. The final release audit records deployment and post-production results separately.
