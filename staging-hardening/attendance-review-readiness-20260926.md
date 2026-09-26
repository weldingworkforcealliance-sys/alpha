# Attendance review and manager correction checkpoint
26 September 2026; Gltg staging only. Production unchanged.

History previously summed overlapping status and flag totals, counting a left-early student twice. The badge now counts each attendance record needing review once, using final status when available. Browser verification: the finalized synthetic session displays 1 needs review instead of 2.

Manager correction browser check passed: a synthetic note update required a reason, saved against finalized attendance, and retained the finalized state. Audit-log verification found the reason and old/new notes. Rolled-back role tests allow school admin and owner while rejecting instructor and lead instructor.

Historical correction finalization now uses finalize_section_attendance with the selected date. The scoped database path passed in the preceding checkpoint; creating and finalizing a new historical session through this screen was not exercised here.

Reports through 28 September show two active students, one finalized session, one present record and 50% attendance, matching the synthetic records. Download CSV was clicked without a console error, but the embedded browser emitted no download event and no matching CSV appeared in Downloads. File export remains unverified; no speculative export code change was made.

Validation: eight focused tests passed, including two new review-count behavior tests; build/typecheck and edited-file lint passed. No database migration was needed. The earlier 275-test suite result belongs to the preceding checkpoint.

Next: verify CSV download in a supported browser or investigate embedded-browser download handling. Staging readiness remains incomplete.

