import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { destination } from './synthetic-roundtrip.mjs';
import { storeRetainedArchive, recoverRetainedArchive } from './retained-store.mjs';

function fake(change = {}) {
  const calls = [], objects = new Map();
  const run = (_service, operation, args) => {
    calls.push({ operation, args });
    const value = flag => args[args.indexOf(flag) + 1];
    if (operation === 'get-caller-identity') return { Account: change.account ?? destination.account };
    assert.equal(value('--expected-bucket-owner'), destination.account);
    if (operation === 'get-bucket-versioning') return { Status: change.versioning ?? 'Enabled' };
    if (operation === 'get-public-access-block') return { PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: change.publicBlock ?? true, RestrictPublicBuckets: true } };
    if (operation === 'get-bucket-ownership-controls') return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } };
    if (operation === 'get-bucket-encryption') return { ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] } };
    if (operation === 'get-object-lock-configuration') return { ObjectLockConfiguration: { ObjectLockEnabled: change.lock ?? 'Enabled' } };
    const key = value('--key');
    if (operation === 'put-object') {
      assert.equal(value('--if-none-match'), '*');
      assert.equal(value('--object-lock-legal-hold-status'), 'ON');
      assert.equal(value('--server-side-encryption'), 'AES256');
      if (objects.has(key)) throw Error('PreconditionFailed');
      const bytes = readFileSync(value('--body'));
      objects.set(key, { bytes, versionId: `version-${objects.size + 1}`, checksum: value('--checksum-sha256') });
      return { VersionId: change.missingVersion ? 'null' : objects.get(key).versionId };
    }
    const object = objects.get(key);
    assert.ok(object);
    assert.equal(value('--version-id'), object.versionId);
    if (operation === 'get-object-legal-hold') return { LegalHold: { Status: change.hold ?? 'ON' } };
    if (operation === 'get-object') {
      const corrupt = change.corrupt || (change.corruptReceipt && key.endsWith('verified-receipt.json'));
      writeFileSync(args.at(-1), corrupt ? Buffer.from('altered') : object.bytes);
      return { VersionId: change.wrongVersion ? 'wrong' : object.versionId,
        ContentLength: object.bytes.length, ChecksumSHA256: change.badChecksum ? 'bad' : object.checksum,
        ServerSideEncryption: change.encryption ?? 'AES256' };
    }
    throw Error('Unexpected AWS operation');
  };
  return { run, calls, objects, directory: mkdtempSync(join(tmpdir(), 'ltg-retained-test-')) };
}
const options = () => ({ environment: 'staging', exportId: '20000000-0000-4000-8000-000000000001',
  capturedAt: '2026-09-19T16:00:00Z', sourceRevision: 'a'.repeat(40), artifacts: [
    { name: 'student-records.json', bytes: Buffer.from('{"synthetic":true,"active":false,"revisions":[0,76]}') },
    { name: 'certificate.pdf', bytes: Buffer.from('%PDF-synthetic-test-not-valid-certificate') },
  ] });

test('every artifact and completion receipt has a verified hold and exact-version recovery', () => {
  const s = fake(), source = options();
  const receipt = storeRetainedArchive({ ...source, ...s });
  assert.equal(receipt.entries.length, 2);
  assert.ok(receipt.completion.key.endsWith('/verified-receipt.json'));
  const recovered = recoverRetainedArchive({ receipt, run: s.run });
  assert.deepEqual(recovered, source.artifacts);
  assert.equal(s.calls.filter(c => c.operation === 'put-object').length, 3);
  assert.ok(!s.calls.some(c => /delete|put-object-legal-hold|retention/.test(c.operation)));
});

for (const change of [{ account: 'wrong' }, { versioning: 'Suspended' }, { publicBlock: false }, { lock: 'Disabled' }]) {
  test(`refuses destination before uploading: ${JSON.stringify(change)}`, () => {
    const s = fake(change); assert.throws(() => storeRetainedArchive({ ...options(), ...s }));
    assert.ok(!s.calls.some(c => c.operation === 'put-object'));
  });
}
for (const change of [{ missingVersion: true }, { wrongVersion: true }, { corrupt: true }, { badChecksum: true }, { encryption: 'wrong' }, { hold: 'OFF' }]) {
  test(`never writes a completion receipt after failed protection: ${JSON.stringify(change)}`, () => {
    const s = fake(change); assert.throws(() => storeRetainedArchive({ ...options(), ...s }));
    assert.ok(![...s.objects.keys()].some(k => k.endsWith('verified-receipt.json')));
  });
}
test('receipt corruption cannot report completed backup', () => {
  assert.throws(() => storeRetainedArchive({ ...options(), ...fake({ corruptReceipt: true }) }));
});
test('same export ID cannot overwrite an existing record and later correction stays independent', () => {
  const s = fake(), first = storeRetainedArchive({ ...options(), ...s });
  assert.throws(() => storeRetainedArchive({ ...options(), run: s.run }));
  const second = storeRetainedArchive({ ...options(), exportId: '20000000-0000-4000-8000-000000000002', run: s.run });
  assert.notEqual(first.completion.key, second.completion.key);
  assert.deepEqual(recoverRetainedArchive({ receipt: first, run: s.run }), options().artifacts);
});
test('rejects path traversal and duplicate names before upload', () => {
  for (const artifacts of [[{ name: '../secret', bytes: Buffer.from('x') }], [options().artifacts[0], options().artifacts[0]]]) {
    const s = fake(); assert.throws(() => storeRetainedArchive({ ...options(), artifacts, ...s })); assert.equal(s.calls.length, 0);
  }
});
test('rejects receipt pointing outside its destination before download', () => {
  const s = fake(), receipt = storeRetainedArchive({ ...options(), ...s });
  receipt.completion.key = 'production/records/other/export.json';
  const count = s.calls.length; assert.throws(() => recoverRetainedArchive({ receipt, run: s.run }));
  assert.equal(s.calls.length, count);
});
test('authentic receipt with invalid archived paths is rejected without following those paths', () => {
  const s = fake(), receipt = storeRetainedArchive({ ...options(), ...s });
  const object = s.objects.get(receipt.completion.key), data = JSON.parse(object.bytes);
  data.entries[0].name = '../other.json'; data.entries[0].key = `${receipt.completion.key.replace('verified-receipt.json', '')}../other.json`;
  object.bytes = Buffer.from(JSON.stringify(data));
  object.checksum = createHash('sha256').update(object.bytes).digest('base64');
  receipt.completion.bytes = object.bytes.length;
  receipt.completion.sha256 = createHash('sha256').update(object.bytes).digest('hex');
  assert.throws(() => recoverRetainedArchive({ receipt, run: s.run }));
});

