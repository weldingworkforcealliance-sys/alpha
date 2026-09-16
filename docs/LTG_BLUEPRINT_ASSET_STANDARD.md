# LTG Blueprint Asset Standard

This is the default standard for every blueprint, fabrication print, shop drawing, and dimension-heavy visual added to LTG after 2026-09-15.

## Approved-source rule

- Use the exact approved drawing. Do not redraw, reinterpret, infer, or change dimensions unless the user explicitly approves a revision.
- The same controlling print must be used in planner resources, Live Classroom, project packets, QC records, and final rubrics.
- If an approved print is missing, mark the activity blocked rather than inventing geometry or dimensions.

## Resolution / file format

- Prefer vector SVG for drawings that originate as vectors.
- For raster prints, use lossless PNG.
- Never use a low-resolution raster as the master blueprint asset.
- Minimum raster width: 1400 px for a simple one-page print.
- Preferred raster width: 2400-3000 px for text-heavy or dimension-heavy prints.
- Before release, verify all dimension text is readable at normal desktop view and remains readable when zoomed.

## LTG display behavior

- Preserve the source aspect ratio.
- Display high-resolution raster prints at or below their native resolution. Do not force a small source image to fill a wider container.
- Put large prints inside a scrollable blueprint pane rather than shrinking dimension text until it is illegible.
- Maximize / zoom views must use the original full-resolution asset, not a thumbnail or transformed preview.
- Do not depend on CSS sharpening or pixelated rendering to rescue a low-resolution source.

## Project packet behavior

- Embed the same controlling blueprint used by Live Classroom.
- The blueprint should be visually separated from worksheets, rubrics, and QC forms.
- A project packet may scale the print down for printing, but the on-screen version must retain access to full native resolution.
- Do not use temporary Drive thumbnails as the final production source. Promote the approved high-resolution file into LTG's own static resources first.

## QA gate before publishing

A blueprint package is not complete until all of the following pass:

1. Correct approved drawing is present.
2. No blank blueprint / print / drawing resource URLs remain for the assigned days.
3. Blueprint opens directly from the planner.
4. Blueprint appears inside the connected Live Classroom assessment when the questions depend on it.
5. Dimension text and drill / weld callouts are readable on desktop at normal view.
6. Maximize / zoom remains readable and does not substitute a thumbnail.
7. Project packet uses the same drawing version as Live Classroom.
8. Any blueprint-based assessment has enough drawing information on screen to answer every question.
9. No stale project drawing remains after a project is removed from a schedule variant.

## Reference implementation

The successful Steel Dice test on 2026-09-15 established the baseline: a 1448 x 1086 high-resolution source was readable in LTG where the earlier 710 x 532 raster was not. Future assets should meet or exceed that effective source resolution, with 2400-3000 px width preferred for dense prints.
