# Attendance edit permission repair — 26 September 2026
Gltg staging only (ezlvivmeneefiiwqwgqd). Production unchanged.

The dashboard called mark_all_attendance as authenticated, but its ACL allowed only postgres and service_role. Reproduction returned SQLSTATE 42501. Individual save and reset had the same missing grant; optimistic selections could therefore appear changed without persisting.

Restored authenticated EXECUTE on exactly mark_all_attendance(uuid,text), set_attendance_record(uuid,uuid,text,text,text[],text), and reset_attendance_session(uuid). Existing pair authorization, finalized-session guards, empty search paths, owners and function bodies are unchanged. Anonymous access remains denied. Migration verifies captured definition hashes before applying.

Validation:
- Instructor, lead instructor, school admin and owner each passed reset, mark-all (two rows), and single-record correction in rolled-back transactions.
- Unrelated-school instructor denied; anonymous denied on all three functions; finalized-session bulk edit denied.
- Exact grant rollback verified all three permissions false; reapplication and all seven test groups passed.
- Browser Mark All Present succeeded; database independently confirmed both synthetic students saved as present for 28 September.
- Broad role smoke: 44 observations, including the eight previously documented wrong-lab-fixture precondition errors. Separate correct-fixture lab smoke: all eight checks passed. These are representative database checks, not complete browser journeys.

Scope remaining: full attendance finalization/reporting journey and generic UI error rendering (plain API objects currently become [object Object]) remain open. No emails were sent by this test.

Reference: https://supabase.com/docs/guides/database/functions

SUPERSEDED: see scoped-attendance-readiness-20260926.md. Legacy grants were revoked again after updating the client to use the existing class/date-scoped RPCs.

