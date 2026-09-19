import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const destination = Object.freeze({
  account: '551626544567',
  region: 'us-east-2',
  bucket: 'ltg-student-archive-551626544567-us-east-2',
  prefix: 'staging/synthetic/',
});

export function awsCli(service, operation, args) {
  try {
    const output = execFileSync('aws', [service, operation, ...args,
      '--region', destination.region, '--output', 'json', '--no-cli-pager'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return JSON.parse(output || '{}');
  } catch {
    // Never echo credentials, signed URLs, CLI environment, or record contents.
    throw new Error(`AWS ${service}/${operation} failed; check scoped access and configuration.`);
  }
}

export function fixture(exportId) {
  return {
    format: 'ltg-synthetic-archive-probe-v1',
    synthetic: true,
    exportId,
    student: { id: 'synthetic-student-001', name: 'Synthetic Archive Student', active: false },
    enrollment: [{ course: 'SYNTHETIC-SHOP', active: false }],
    attendance: [{ date: '2026-09-01', status: 'present' }],
    attempts: [{ attempt: 1, score: 0, criticalDefect: true }, { attempt: 2, score: 76 }],
    gradeHistory: [{ revision: 1, grade: 65 }, { revision: 2, grade: 76 }],
    certificates: [{ id: 'SYNTHETIC-NOT-A-VALID-CERTIFICATE', issued: false }],
    notes: 'Test data only. This does not certify production export completeness or recovery.',
  };
}

export function runRoundtrip({ run = awsCli, directory = mkdtempSync(join(tmpdir(), 'ltg-archive-probe-')) } = {}) {
  const identity = run('sts', 'get-caller-identity', []);
  if (identity.Account !== destination.account) throw new Error('Unexpected AWS account; no upload attempted.');
  const bucketArgs = ['--bucket', destination.bucket, '--expected-bucket-owner', destination.account];
  const versioning = run('s3api', 'get-bucket-versioning', bucketArgs);
  const access = run('s3api', 'get-public-access-block', bucketArgs).PublicAccessBlockConfiguration;
  const ownership = run('s3api', 'get-bucket-ownership-controls', bucketArgs).OwnershipControls;
  const encryption = run('s3api', 'get-bucket-encryption', bucketArgs).ServerSideEncryptionConfiguration;
  if (versioning.Status !== 'Enabled') throw new Error('Bucket versioning must be enabled.');
  if (!['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets']
    .every((key) => access?.[key] === true)) throw new Error('All public access must be blocked.');
  if (!ownership?.Rules?.some((rule) => rule.ObjectOwnership === 'BucketOwnerEnforced')) {
    throw new Error('Bucket owner enforcement is required.');
  }
  if (!encryption?.Rules?.some((rule) => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256')) {
    throw new Error('Expected S3 managed encryption is not configured.');
  }

  const exportId = randomUUID();
  const payload = Buffer.from(`${JSON.stringify(fixture(exportId), null, 2)}\n`);
  const checksum = createHash('sha256').update(payload).digest('base64');
  const key = `${destination.prefix}${exportId}.json`;
  const source = join(directory, 'synthetic-source.json');
  const restored = join(directory, 'synthetic-restored.json');
  writeFileSync(source, payload, { flag: 'wx', mode: 0o600 });
  const uploaded = run('s3api', 'put-object', [...bucketArgs, '--key', key,
    '--body', source, '--content-type', 'application/json', '--server-side-encryption', 'AES256',
    '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum, '--if-none-match', '*']);
  if (!uploaded.VersionId || uploaded.VersionId === 'null') throw new Error('Upload returned no immutable version identifier.');
  const downloaded = run('s3api', 'get-object', [...bucketArgs, '--key', key,
    '--version-id', uploaded.VersionId, '--checksum-mode', 'ENABLED', restored]);
  const bytes = readFileSync(restored);
  if (downloaded.VersionId !== uploaded.VersionId || downloaded.ServerSideEncryption !== 'AES256'
    || downloaded.ChecksumSHA256 !== checksum || downloaded.ContentLength !== payload.length
    || !bytes.equals(payload)) throw new Error('Downloaded version failed content or encryption verification.');
  const receipt = {
    result: 'synthetic-roundtrip-verified', productionBackupVerified: false,
    account: destination.account, region: destination.region, bucket: destination.bucket,
    key, versionId: uploaded.VersionId, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), verifiedAt: new Date().toISOString(),
  };
  writeFileSync(join(directory, 'verification-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runRoundtrip(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
