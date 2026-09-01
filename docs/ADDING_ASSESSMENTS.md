# Adding Assessments to LTG

The Live Classroom is assessment-independent. Every active module in `assessment_modules` automatically appears in the instructor's Assessment Library. The existing QR joining, server-side grading, real-time results, duplicate-ID protection, and CSV export are reused without changing the classroom pages.

## Permanent identity

Give every assessment a unique, permanent `slug`, such as `blueprint_reading` or `wld105_safety`. Do not reuse a slug for a different assessment because submissions retain that identity.

## Required records

1. Insert one row in `assessment_modules` with its title, description, category, expected time, display order, and version.
2. Insert its questions in `assessment_questions`.
3. Set `active = true` when it is ready for instructors.

Supported question types are:

- `mc`: multiple choice. Store choices in `options` and the correct choice letter in `correct_answer`.
- `text`: short response. Store acceptable normalized responses in `accepted_answers`.

Answer keys and explanations are never returned by the student assessment RPC. Grading remains inside the database.

## Safe publishing sequence

Load an assessment as inactive, verify its question count and answer key, then activate it. Existing classroom and grading code does not need to be rebuilt or redeployed when assessment records are added directly to Supabase.
