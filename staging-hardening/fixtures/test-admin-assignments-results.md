# Staging account setup — 26 September 2026
Target: Gltg (ezlvivmeneefiiwqwgqd) only.

Repaired the missing profile for the existing synthetic school administrator, added instructor assignments for the two existing Tower test sections, and created synthetic employee STAGING-ADMIN-01. School membership role and authentication settings were unchanged. Setup was first exercised in a rolled-back transaction, then committed.

Browser verification: personal CLOCK IN succeeded; personal CLOCK OUT succeeded; attendance report displayed Complete. Independent database read returned open_punches=0 and closed_punches=1. Dashboard displayed the assigned instructor, TOWER-TH class, sample lesson and resource, and a two-minute completed time total.

Scope limits: this is one school-admin browser journey. Kiosk/PIN, correction, other roles, and the complete Attendance workflow remain unverified. No production changes or promotion occurred.

The additive fixture is test-admin-assignments.sql. It deliberately refuses rerun when the profile exists. The completed synthetic punch is retained as test evidence. Do not delete the repaired profile or employee after activity; a future cleanup should deactivate the exact synthetic assignments and employee and retain history.

