import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { destination, runRoundtrip } from './synthetic-roundtrip.mjs';

function scenario(change = {}) {
  const calls = [];
  let payload, checksum;
  const run = (service, operation, args) => {
    calls.push({ service, operation, args });
    const value = (flag) => args[args.indexOf(flag) + 1];
    if (operation === 'get-caller-identity') return { Account: change.account ?? destination.account };
    assert.equal(value('--expected-bucket-owner'), destination.account);
    if (operation === 'get-bucket-versioning') return { Status: change.versioning ?? 'Enabled' };
    if (operation === 'get-public-access-block') return { PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: change.publicBlock ?? true, RestrictPublicBuckets: true,
    } };
    if (operation === 'get-bucket-ownership-controls') return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } };
    if (operation === 'get-bucket-encryption') return { ServerSideEncryptionConfiguration: { Rules: [
      { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: change.encryption ?? 'AES256' } },
    ] } };
    if (operation === 'put-object') {
      assert.ok(value('--key').startsWith('staging/synthetic/'));
      assert.equal(value('--if-none-match'), '*');
      payload = readFileSync(value('--body'));
      checksum = value('--checksum-sha256');
      return { VersionId: change.uploadVersion ?? 'test-version' };
    }
    if (operation === 'get-object') {
      assert.equal(value('--version-id'), 'test-version');
      writeFileSync(args.at(-1), change.corrupt ? 'altered data' : payload);
      return { VersionId: change.downloadVersion ?? 'test-version', ContentLength: payload.length,
        ServerSideEncryption: change.downloadEncryption ?? 'AES256', ChecksumSHA256: change.checksum ?? checksum };
    }
    throw new Error(`Unexpected command: ${operation}`);
  };
  return { calls, run, directory: mkdtempSync(join(tmpdir(), 'ltg-archive-unit-')) };
}

test('verifies exact version, bytes and hash without deleting any object', () => {
  const fake = scenario();
  const receipt = runRoundtrip(fake);
  assert.equal(receipt.result, 'synthetic-roundtrip-verified');
  assert.equal(receipt.productionBackupVerified, false);
  assert.equal(fake.calls.filter((c) => /delete/i.test(c.operation)).length, 0);
  const restored = JSON.parse(readFileSync(join(fake.directory, 'synthetic-restored.json')));
  assert.equal(restored.student.active, false);
  assert.equal(restored.gradeHistory.length, 2);
  assert.equal(restored.attempts[0].criticalDefect, true);
});
for (const [name, change] of Object.entries({
  'wrong account': { account: '000000000000' },
  'disabled versioning': { versioning: 'Suspended' },
  'public policy allowed': { publicBlock: false },
  'unexpected encryption': { encryption: 'aws:kms' },
})) test(`refuses upload: ${name}`, () => {
  const fake = scenario(change);
  assert.throws(() => runRoundtrip(fake));
  assert.equal(fake.calls.some((c) => c.operation === 'put-object'), false);
});
for (const [name, change] of Object.entries({
  'missing version': { uploadVersion: 'null' },
  'wrong restored version': { downloadVersion: 'other-version' },
  'tampered bytes': { corrupt: true },
  'bad checksum': { checksum: 'wrong' },
  'unexpected restored encryption': { downloadEncryption: 'aws:kms' },
})) test(`does not report success: ${name}`, () => assert.throws(() => runRoundtrip(scenario(change))));

