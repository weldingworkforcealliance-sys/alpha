-- Fix Blueprint Reading Day 4 live classroom reference quality.
-- Replace the embedded raster/WebP reference with the production SVG review board.

begin;

update public.assessment_modules
set reference_title='Blueprint Reading Day 4 — Fillet, Groove, and Full Review',
    reference_image_url='/live-activities/blueprint-day4-fillet-groove-review-board.svg',
    reference_body='Use the vector review board. Zoom as needed; all dimensions, notes, hole callouts, weld symbols, section labels, and reference dimensions remain sharp at any scale. Return to the drawing evidence before answering.'
where slug='blueprint_day4';

commit;
