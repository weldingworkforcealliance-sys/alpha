import { buildSchoolBundles, recoverSchoolBundle, sha256 } from './school-bundle.mjs';
import { contextSchema } from './context-reader.mjs';

const encode = data => Buffer.from(JSON.stringify(data));
function check(ok) { if (!ok) throw Error('Archive record or supporting-file inventory is incomplete.'); }

// School bundles remain core-records-only. Their companion administrative
// context artifact preserves shared curriculum, audit history and template bytes.
// Neither artifact is an automatic restore of the running LTG application.
export async function prepareRecords(snapshot, { renderCertificate }) {
  const supplement = snapshot.supplement;
  check(supplement?.format === 'ltg-archive-context-v1'
    && supplement.storage?.checkedInSnapshot === true && supplement.storage.objectCount === 0
    && JSON.stringify(supplement.schema) === JSON.stringify(contextSchema));
  check(Object.keys(supplement.datasets).length === Object.keys(contextSchema).length);
  for (const table of Object.keys(contextSchema)) {
    check(Array.isArray(supplement.datasets[table]) && supplement.datasets[table].length === supplement.sourceCounts[table]);
  }
  check(Array.isArray(supplement.templates));
  const schools = new Set(snapshot.expectedSchoolIds), templates = new Map();
  const files = [], fileInventory = [], artifacts = [];
  function addFile({ id, schoolId, sourceVersion, bytes, kind }) {
    check(schools.has(schoolId) && Buffer.isBuffer(bytes) && bytes.length > 0);
    const sum = sha256(bytes);
    files.push({ id, schoolId, sourceVersion, base64: bytes.toString('base64') });
    fileInventory.push({ id, schoolId, sourceVersion, bytes: bytes.length, sha256: sum, kind });
    artifacts.push({ name: `${kind}-${sha256(Buffer.from(id))}.pdf`, bytes });
  }
  for (const template of supplement.templates) {
    check(schools.has(template.school_id) && !templates.has(template.school_id)
      && template.layout === 'pccc-guided-bend-v2' && typeof template.base64 === 'string');
    const base64 = template.base64.replace(/\s/g, ''), bytes = Buffer.from(base64, 'base64');
    check(bytes.toString('base64') === base64 && bytes.subarray(0, 5).toString() === '%PDF-');
    templates.set(template.school_id, { ...template, bytes });
    addFile({ id: `template:${template.school_id}`, schoolId: template.school_id,
      sourceVersion: sha256(bytes), bytes, kind: 'template' });
  }
  const sections = new Map(snapshot.datasets.sections.map(r => [r.id, r.school_id]));
  const books = new Map(snapshot.datasets.gradebooks.map(r => [r.id, sections.get(r.section_id)]));
  for (const certificate of snapshot.datasets.tower_certificates) {
    const schoolId = books.get(certificate.gradebook_id);
    check(schools.has(schoolId));
    const bytes = Buffer.from(await renderCertificate(certificate, schoolId, templates.get(schoolId)));
    check(bytes.subarray(0, 5).toString() === '%PDF-');
    addFile({ id: `certificate:${certificate.id}`, schoolId,
      sourceVersion: `${snapshot.sourceRevision}:${sha256(encode(certificate))}`, bytes, kind: 'certificate' });
  }
  const complete = { ...snapshot, files, fileInventory };
  const bundles = buildSchoolBundles(complete);
  for (const bundle of bundles) {
    recoverSchoolBundle(bundle.bytes, { expectedDigest: bundle.sha256, schoolId: bundle.schoolId, exportId: bundle.exportId });
    artifacts.push({ name: `school-${bundle.schoolId}.json`, bytes: bundle.bytes });
  }
  artifacts.push({ name: 'administrative-context.json', bytes: encode({
    ...supplement, exportId: snapshot.exportId, environment: snapshot.environment,
    capturedAt: snapshot.capturedAt, sourceRevision: snapshot.sourceRevision,
    access: 'archive-administrator-only',
    certificateFiles: 'Rendered from immutable certificate snapshots using the archived source revision and template; not evidence of prior delivery.',
    limitations: ['External linked teaching resources are referenced, not mirrored.',
      'Core school bundles require this administrative context for curriculum and audit history.',
      'Not an operational database restore or a backup of account passwords, email configuration or deployment secrets.'],
  }) });
  return { artifacts, bundleCount: bundles.length, fileCount: files.length };
}

