import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { awsCli, destination } from './synthetic-roundtrip.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const check = (ok) => { if (!ok) throw new Error('Archive protection or integrity verification failed.'); };
const bucketArgs = ['--bucket', destination.bucket, '--expected-bucket-owner', destination.account];

export function verifyDestination(run = awsCli) {
  check(run('sts', 'get-caller-identity', []).Account === destination.account);
  check(run('s3api', 'get-bucket-versioning', bucketArgs).Status === 'Enabled');
  const block = run('s3api', 'get-public-access-block', bucketArgs).PublicAccessBlockConfiguration;
  check(['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(k => block?.[k] === true));
  check(run('s3api', 'get-bucket-ownership-controls', bucketArgs).OwnershipControls?.Rules?.some(r => r.ObjectOwnership === 'BucketOwnerEnforced'));
  check(run('s3api', 'get-bucket-encryption', bucketArgs).ServerSideEncryptionConfiguration?.Rules?.some(r => r.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256'));
  check(run('s3api', 'get-object-lock-configuration', bucketArgs).ObjectLockConfiguration?.ObjectLockEnabled === 'Enabled');
}

// The uploader always sets ON during the initial PUT. It never calls a hold-
// modification or deletion API. IAM must separately deny OFF and all deletion.
function storeVersion(run, directory, key, bytes, index) {
  const source = join(directory, `${index}-source`), restored = join(directory, `${index}-restored`);
  writeFileSync(source, bytes, { flag: 'wx', mode: 0o600 });
  const checksum = createHash('sha256').update(bytes).digest('base64');
  const uploaded = run('s3api', 'put-object', [...bucketArgs, '--key', key, '--body', source,
    '--content-type', 'application/octet-stream', '--server-side-encryption', 'AES256',
    '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum,
    '--object-lock-legal-hold-status', 'ON', '--if-none-match', '*']);
  check(typeof uploaded.VersionId === 'string' && uploaded.VersionId.length > 0 && uploaded.VersionId !== 'null');
  const exact = [...bucketArgs, '--key', key, '--version-id', uploaded.VersionId];
  const result = run('s3api', 'get-object', [...exact, '--checksum-mode', 'ENABLED', restored]);
  check(result.VersionId === uploaded.VersionId && result.ServerSideEncryption === 'AES256'
    && result.ChecksumSHA256 === checksum && result.ContentLength === bytes.length
    && readFileSync(restored).equals(bytes));
  check(run('s3api', 'get-object-legal-hold', exact).LegalHold?.Status === 'ON');
  return { key, versionId: uploaded.VersionId, bytes: bytes.length, sha256: digest(bytes), legalHold: 'ON' };
}

export function storeRetainedArchive({ environment, exportId, capturedAt, sourceRevision, artifacts,
  run = awsCli, directory = mkdtempSync(join(tmpdir(), 'ltg-retained-archive-')) }) {
  check(['staging', 'production'].includes(environment) && uuid.test(exportId)
    && Number.isFinite(Date.parse(capturedAt)) && /^[0-9a-f]{40}$/.test(sourceRevision));
  check(Array.isArray(artifacts) && artifacts.length > 0 && artifacts.length <= 10000);
  const names = new Set();
  let total = 0;
  for (const artifact of artifacts) {
    check(/^[a-z0-9][a-z0-9._-]{0,119}$/.test(artifact.name) && artifact.name !== 'verified-receipt.json' && !names.has(artifact.name));
    names.add(artifact.name);
    check(Buffer.isBuffer(artifact.bytes) && artifact.bytes.length > 0 && artifact.bytes.length <= 512 * 1024 * 1024);
    total += artifact.bytes.length;
  }
  check(total <= 1024 * 1024 * 1024); // No accidental unbounded upload/spend.
  verifyDestination(run);
  const prefix = environment === 'production' ? 'production/records/' : 'staging/synthetic/retained/';
  const root = `${prefix}${exportId}/`;
  const entries = artifacts.map((a, i) => ({ name: a.name, ...storeVersion(run, directory, `${root}${a.name}`, a.bytes, i) }));
  const receipt = { format: 'ltg-retained-receipt-v1', environment, exportId, capturedAt, sourceRevision,
    account: destination.account, bucket: destination.bucket, region: destination.region,
    verifiedAt: new Date().toISOString(), entries };
  // Completion is written LAST, only after every exact version is downloaded and
  // its hold verified. Failed runs leave retained partial data, never a success marker.
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  const completion = storeVersion(run, directory, `${root}verified-receipt.json`, receiptBytes, entries.length);
  return { ...receipt, completion };
}

// The caller supplies the independently retained completion identity/digest.
// No latest-version lookup, wildcard retrieval, archived path execution, or SQL.
export function recoverRetainedArchive({ receipt: trusted, run = awsCli,
  directory = mkdtempSync(join(tmpdir(), 'ltg-archive-recovery-')) }) {
  check(trusted?.account === destination.account && trusted.bucket === destination.bucket && trusted.region === destination.region);
  check(['production', 'staging'].includes(trusted.environment) && uuid.test(trusted.exportId));
  const root = `${trusted.environment === 'production' ? 'production/records/' : 'staging/synthetic/retained/'}${trusted.exportId}/`;
  function get(entry, index) {
    check(typeof entry?.key === 'string' && entry.key.startsWith(root) && !entry.key.slice(root.length).includes('/')
      && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(entry.key.slice(root.length))
      && typeof entry.versionId === 'string' && entry.versionId !== 'null' && entry.versionId.length > 0
      && /^[0-9a-f]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 512 * 1024 * 1024);
    const path = join(directory, `${index}-recovered`);
    const args = [...bucketArgs, '--key', entry.key, '--version-id', entry.versionId];
    const meta = run('s3api', 'get-object', [...args, '--checksum-mode', 'ENABLED', path]);
    const bytes = readFileSync(path);
    check(meta.VersionId === entry.versionId && meta.ContentLength === entry.bytes && bytes.length === entry.bytes
      && meta.ServerSideEncryption === 'AES256' && digest(bytes) === entry.sha256
      && meta.ChecksumSHA256 === createHash('sha256').update(bytes).digest('base64'));
    check(run('s3api', 'get-object-legal-hold', args).LegalHold?.Status === 'ON');
    return bytes;
  }
  check(trusted.completion?.key === `${root}verified-receipt.json`);
  const receipt = JSON.parse(get(trusted.completion, 'receipt').toString('utf8'));
  check(receipt.format === 'ltg-retained-receipt-v1' && receipt.exportId === trusted.exportId
    && receipt.environment === trusted.environment && receipt.account === destination.account
    && receipt.bucket === destination.bucket && receipt.region === destination.region
    && Array.isArray(receipt.entries) && receipt.entries.length > 0 && receipt.entries.length <= 10000);
  const names = new Set(); let total = 0;
  for (const e of receipt.entries) {
    check(typeof e.name === 'string' && e.key === `${root}${e.name}` && e.name !== 'verified-receipt.json' && !names.has(e.name));
    names.add(e.name); total += e.bytes;
  }
  check(Number.isSafeInteger(total) && total <= 1024 * 1024 * 1024);
  return receipt.entries.map((entry, i) => ({ name: entry.name, bytes: get(entry, i) }));
}

