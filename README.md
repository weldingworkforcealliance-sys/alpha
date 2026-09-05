# LTG · Welding Education Operating System

LTG is a browser-first operating system for welding education programs. It connects protected curriculum, daily instruction, student assessment, attendance, instructor operations, school administration, and program analytics without requiring a school to abandon the welding resources it already uses.

## Core platform

### Instruction and protected curriculum
- Day-by-day Teaching Console and planner progression
- Protected core curriculum and course outcomes
- Instructor notes, implementation feedback, and review workflows
- Connected Classroom assessments and live grading
- Student display mode and Training Mode
- Paired-course coordination for linked welding classes

### Program operations
- Student attendance with shared class-pair rosters
- End-of-day paired attendance confirmation and instructor notes
- PVHS reporting architecture with production email delivery readiness-gated until configuration/testing is complete
- Employee Time Clock with authenticated clock-in/out, kiosk support, corrections, and audit history
- Weekly payroll-ready time reports for manual payroll entry
- School and Platform Owner operational views

### Vendor-neutral content and resource integration
LTG uses the existing planner-day resource model as the common instructional layer. A resource can now be attributed to a provider/source and classified by integration and licensing metadata.

Built-in source categories include:
- LTG-native and school-created material
- AWS resources and standards references
- Miller educational/equipment resources
- Lincoln Electric educational/equipment resources
- Textbooks and publisher courseware
- Video/media resources
- Welding simulators
- Other external training providers

Supported integration profiles include:
- Native LTG resources
- Authorized URLs and file references
- Simulator launches
- LTI 1.3
- SCORM
- Common Cartridge
- QTI
- Provider APIs

Secure provider integrations are not faked by a dropdown. LTI/API credentials, launch handshakes, licensing, and provider authorization must be configured with the provider before a secure integration becomes launchable.

## Content ownership guardrail

LTG stores authorized links, references, integration metadata, and content a school is permitted to distribute. Referencing AWS, a manufacturer, publisher, textbook, simulator, or other provider does not transfer ownership or create a license. Protected third-party content should remain with the authorized provider unless the school has explicit rights to host or redistribute it.

## Protected-curriculum rule

No instructor note, resource attachment, automated suggestion, school-admin action, or cross-school learning process may silently change approved core curriculum or approved course outcomes. Resource integrations support instruction and implementation around those protected requirements; they do not replace the formal curriculum-review process.

## Technical stack
- Next.js / React
- Supabase Auth, Postgres, RLS, RPCs, and Edge Functions
- Browser-first responsive interface for school-managed devices

The browser application uses the Supabase Project URL and publishable browser key. It contains no service-role or other server secret.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Validation

GitHub Actions runs dependency installation, TypeScript checking, and a Next.js production build for main-branch pushes and pull requests.

## Product definition

**LTG = Welding Education Operating System.**

The product is intentionally broader than a digital teacher guide or welding LMS. The long-term data model connects standards, programs, courses, protected outcomes, planner days, instructional resources, assessments, student competency evidence, attendance, instructor operations, and school/owner analytics in one welding-specific environment.
