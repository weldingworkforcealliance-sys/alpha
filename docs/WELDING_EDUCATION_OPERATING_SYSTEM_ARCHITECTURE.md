# LTG — Welding Education Operating System Architecture

## Product definition

LTG is the operating layer for a welding education program, not a replacement for every publisher, manufacturer, standards body, simulator, textbook, or school curriculum already in use.

The platform should let a school keep the resources it has already selected and connect them to one instructional and operational structure:

`Standard / Curriculum → Program → Course → Protected Outcome → Planner Day → Resource → Instruction / Assessment / Attendance → Analytics`

That structure is the core product advantage. Individual features such as attendance, a time clock, a planner, or quizzes can be copied. The useful system is the relationship between them.

## Resource architecture

LTG extends the existing `course_guide_day_resources` model rather than creating a competing resource system.

### `resource_sources`

A source identifies who or what supplied a learning resource. Sources may be global LTG catalog entries or school-specific providers.

Initial global source categories:
- LTG Native
- AWS
- Miller
- Lincoln Electric
- Textbook / Publisher
- School-Created
- Video / Media
- Welding Simulator
- Other External

Schools can register additional providers without changing the schema. This is how LTG remains vendor-neutral instead of hard-coding one corporate ecosystem.

### Resource integration modes

Each planner-day resource can record one of these integration profiles:
- `native`
- `url`
- `file_reference`
- `simulator_launch`
- `lti_1_3`
- `scorm`
- `common_cartridge`
- `qti`
- `api`

The profile describes how the resource is intended to connect. It does not imply that provider credentials, licenses, or launch handshakes exist.

Direct resources can use the Teaching Console immediately. Secure/provider-managed integrations remain non-launchable until their authorized connection is configured.

### Rights and licensing metadata

Resources also record a rights basis:
- `school_authorized`
- `school_owned`
- `licensed`
- `public`
- `linked_external`
- `permission_required`
- `unknown`

This is deliberately separate from source/provider identity. A school can reference a provider without claiming ownership of that provider's material.

## Protected curriculum and outcomes

Resource integration must never bypass LTG Rule #1.

A resource may:
- support an approved outcome;
- provide a demonstration, reading, video, simulator exercise, assessment, or reference;
- improve implementation, pacing, or instructional method;
- be replaced with another authorized implementation resource when permitted by school governance.

A resource may not silently:
- rewrite a locked course outcome;
- change approved core curriculum;
- substitute a different credential requirement for an approved one;
- convert instructor feedback into an unreviewed curriculum change.

`course_guide_day_resources.outcome_id` provides an optional explicit link to the protected course outcome the resource supports. A database trigger prevents cross-school and cross-course outcome links.

## Data and security model

- Global source records are readable by authenticated school members and the Platform Owner.
- School-specific source records are scoped by school membership.
- Creation/editing of school source records uses existing school-management permissions.
- Planner-day resource insertion/update continues to use the existing instructional-review permission model.
- The new public table has RLS enabled; anonymous access is revoked.
- Provider credentials and secret API keys are not stored in browser-facing resource records.

## Existing resources

The migration classifies all existing planner-day resources into the new source/integration model. Existing Teaching Console behavior is preserved.

Backfill rules include:
- AWS references → AWS
- book references → Textbook / Publisher
- video resources → Video / Media
- internal LTG routes → LTG Native
- other external resources → Other External

Existing resources are therefore not orphaned by the rebrand or architecture change.

## Operational layers already connected to LTG

The Welding Education Operating System currently includes or is actively integrating:
- daily planner / Teaching Console;
- protected outcomes;
- class-connected assessments and live grading;
- paired student attendance;
- end-of-day attendance confirmation;
- instructor time clock;
- weekly payroll-ready reporting;
- training mode;
- school administration;
- Platform Owner reporting foundations.

These operational layers stay independent from any one content vendor.

## Future provider work

The schema is ready to identify secure integration types, but provider-specific integrations still require agreements and technical configuration. Future work may include:
- AWS LTI launch configuration where licensed/authorized;
- publisher LTI or Common Cartridge import workflows;
- simulator API/launch adapters;
- SCORM package hosting where licensing permits;
- QTI assessment import/export;
- provider roster/grade-return integrations;
- centralized license-expiration and integration-health reporting.

The rule is simple: LTG should integrate authorized resources, not scrape, clone, or impersonate the provider that owns them.
