# FABTECH Welding Demo: LTG Teaching View v2 UX Lab

**Staging only:** /demo/welding/ux-lab. **Original FABTECH demo remains unchanged:** /demo/welding.

## Purpose

Compare the original FABTECH teaching demo with the proposed Teaching View v2, using the same 5-day WLD 105/WLD 110 course snapshot and temporary browser-session data. The actual LTG production teacher planner, student records, certification records, curriculum, and FABTECH signup/contact data must remain untouched.

## v2 Design

- A/B toggle Original FABTECH / Teaching View v2. The selected course/day and temporary demo data survive switching.
- Class selection is one dropdown in the header.
- Desktop menu: Today, Attendance, Grading Tower, Live Classroom, Resources, More (Agenda, Time Clock, Reports, School).
- Mobile bottom navigation: Today, Attendance, Grading, More.
- Start Today, Attendance, Grading, Complete Day grouped at the top of the lesson (two-by-two at normal widths). V2 Complete Day requires pair attendance finalized first. The original demo retains its existing behavior.
- Instructor Punch In/Out has its own compact sidebar card, with an IN/OUT indicator and running hours. The duplicate Current Class / course / day panel was removed because the header already provides that information. Mobile keeps direct punch access in the compact header, while the full Time Clock remains under More. The teaching start/finish timer is separate from the employee punch clock.
- Objective, visible welding safety, and timed instructor steps appear above secondary resources.
- Student actions, coaching guidance, AWS alignment, and follow-up notes are available on demand.
- Sample 5-criterion grading tests navigation and data entry only. Sample grades are not official WLD 110 results.
- Existing cross-device Live Classroom QR joining and time clock are retained.

## Test Script

1. Open the v2 UX Lab and view WLD 105 Day 1. Switch to Original and back, confirming day/course content stays consistent.
2. Switch class to WLD 110 via the header dropdown. Confirm the existing lesson title, objective, and timing.
3. Click Start Today. Locate the day's safety control, teaching plan, and resources.
4. Try Complete Day before finalizing attendance. Confirm it directs you to the existing Attendance workspace and provides a clear explanation.
5. Carry initial attendance to final and finalize. Return Today and complete the day.
6. Open Grading Tower, score one synthetic student using five criteria, return Today.
7. Launch Live Classroom from the lesson or menu. Confirm existing QR/student joining is still available.
8. Compare original/v2 on a phone. Check single-column lesson steps, bottom navigation, More sheet, and attendance roster without horizontal scrolling.
9. Open Evaluate this layout, note one unnecessary item and one missing action, and copy the review to share.

## Evaluation Criteria

- Time and taps to identify current class/day.
- Time and taps to start, finalize attendance, and complete a day.
- Whether safety remains immediately visible.
- Whether instructor can find resources, grading, and classroom activities in two interactions or fewer.
- Whether mobile navigation remains usable without a large permanent menu.
- Whether optional notes/outcomes are discoverable but not dominating the lesson.

## Limits

The UX Lab is accessible only on Netlify staging deployments. It uses demo WLD 105/110 material, not Anthony's protected WLD 205 guide. Only browser-local temporary records and isolated public demo classroom sessions are used. Any UI feedback is copied by the reviewer and is not sent automatically. Automated checks do not replace hands-on desktop and phone testing or instructor acceptance.
