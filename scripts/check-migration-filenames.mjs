import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const migrationDir = join(process.cwd(), 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const legacyDuplicateVersions = new Map([
  ['202609030009', [
    '202609030009_fix_classroom_session_expiration.sql',
    '202609030009_rename_timeclock_adp_export_to_report_download.sql',
  ]],
  ['20260910190000', [
    '20260910190000_allow_assigned_instructor_complete_day.sql',
    '20260910190000_harden_audit_write_surface.sql',
  ]],
  ['20260910193000', [
    '20260910193000_harden_job_card_section_authorization.sql',
    '20260910193000_increase_attendance_report_worker_timeout.sql',
  ]],
]);

const failures = [];
const byVersion = new Map();

for (const file of migrationFiles) {
  const match = /^(\d{12}|\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/.exec(file);
  if (!match) {
    failures.push(`Invalid migration filename: ${file}. Expected <12-or-14-digit-version>_<snake_case_name>.sql`);
    continue;
  }

  const version = match[1];
  const files = byVersion.get(version) ?? [];
  files.push(file);
  byVersion.set(version, files);
}

for (const [version, files] of byVersion.entries()) {
  if (files.length < 2) continue;

  const expected = legacyDuplicateVersions.get(version);
  const actualSorted = [...files].sort();
  const expectedSorted = expected ? [...expected].sort() : null;

  if (!expectedSorted || JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    failures.push(
      `Duplicate migration version ${version}: ${actualSorted.join(', ')}. ` +
      'New migrations must use a unique version prefix; do not rename already-applied legacy migrations without reconciling database migration history.'
    );
  }
}

for (const [version, expectedFiles] of legacyDuplicateVersions.entries()) {
  const actual = [...(byVersion.get(version) ?? [])].sort();
  const expected = [...expectedFiles].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `Legacy migration snapshot changed for ${version}. Expected: ${expected.join(', ')}. Found: ${actual.join(', ') || '(none)'}.`
    );
  }
}

if (failures.length > 0) {
  console.error('\nMigration filename guard failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const duplicateCount = [...byVersion.values()].filter((files) => files.length > 1).length;
console.log(
  `Migration filename guard passed: ${migrationFiles.length} migrations checked; ` +
  `${duplicateCount} documented legacy duplicate version group(s) grandfathered.`
);
