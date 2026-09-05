-- Route planner-linked Blueprint assessments through the dedicated locked launcher.

update public.course_guide_day_resources
set resource_url = replace(
      resource_url,
      '/classroom?assessment=blueprint_day',
      '/classroom/planner?assessment=blueprint_day'
    ),
    resource_notes = 'Launches only this planner-linked Blueprint Reading assessment for the selected class, then creates a fresh QR student join session with automatic grading, live progress, and retained reports.'
where resource_url like '/classroom?assessment=blueprint_day%';
