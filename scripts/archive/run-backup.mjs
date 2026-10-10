import { archiveFailure } from './diagnostics.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { databaseConfig } from './database-config.mjs';
import { captureCoreSnapshot } from './snapshot-reader.mjs';
import { captureSupplement } from './context-reader.mjs';
import { prepareRecords } from './prepare-records.mjs';
import { storeRetainedArchive, recoverRetainedArchive } from './retained-store.mjs';
import { createTestRecordPdf } from '../../lib/tower-test-record-pdf.ts';
import { createPcccCertificate, usesPcccCertificate } from '../../lib/pccc-certificate-pdf.ts';
import { awsCli } from './synthetic-roundtrip.mjs';
import { verifyIsolatedRecovery } from './restore-isolated.mjs';

// Run from repository root on an ephemeral worker. Never upload its workspace or
// console output as a GitHub artifact. Database rows and PDF bytes stay private.
let client;
let stage = 'configuration';
try {
  const environment = process.env.LTG_ARCHIVE_ENVIRONMENT;
  if (process.env.LTG_ARCHIVE_ENABLED !== 'true') throw Error('Archive disabled');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) throw Error('Missing revision');
  const secretArn = process.env.LTG_ARCHIVE_DATABASE_SECRET;
  if (!/^arn:aws:secretsmanager:us-east-2:551626544567:secret:ltg\/archive\/production\/database-[A-Za-z0-9]{6}$/.test(secretArn ?? '') || environment !== 'production') throw Error('Unapproved database secret');
  stage = 'credentials';
  const secret = awsCli('secretsmanager', 'get-secret-value', ['--secret-id', secretArn]);
  client = new Client(databaseConfig(secret.SecretString, environment));
  stage = 'database-connect';
  await client.connect();
  stage = 'capture';
  const snapshot = await captureCoreSnapshot(client, { environment, sourceRevision, captureSupplement });
  stage = 'database-close';
  await client.end(); client = null;
  stage = 'prepare';
  const prepared = await prepareRecords(snapshot, { renderCertificate: (certificate, school, template) =>
    template && usesPcccCertificate(school, certificate.snapshot)
      ? createPcccCertificate(certificate, template.bytes) : createTestRecordPdf(certificate) });
  stage = 'retain';
  const receipt = storeRetainedArchive({ environment, exportId: snapshot.exportId, capturedAt: snapshot.capturedAt,
    sourceRevision, artifacts: prepared.artifacts });
  stage = 'recover-objects';
  const recovered = recoverRetainedArchive({ receipt });
  if (recovered.length !== prepared.artifacts.length || recovered.some((a, i) => a.name !== prepared.artifacts[i].name || !a.bytes.equals(prepared.artifacts[i].bytes))) throw Error('Recovery mismatch');
  stage = 'recover-database';
  client = new Client({ host: '127.0.0.1', port: 5432, database: 'ltg_archive_recovery', user: 'archive_drill',
    password: 'synthetic-local-drill-only', connectionTimeoutMillis: 10000 });
  await client.connect();
  await verifyIsolatedRecovery(client, recovered, receipt);
  await client.end(); client = null;
  stage = 'report';
  // Contains only destination identities/digests, never student rows or names.
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## LTG student archive verified\n\nEnvironment: ${environment}\n\nExport: ${receipt.exportId}\n\nSchools: ${prepared.bundleCount}\n\nReceipt key: ${receipt.completion.key}\n\nReceipt version: ${receipt.completion.versionId}\n\nReceipt SHA-256: ${receipt.completion.sha256}\n\nExact-version recovery and indefinite holds verified. Operational database restore is a separate process.\n`, { flag: 'a' });
  console.log('LTG archive upload, retention and exact-version recovery verified.');
  stage = 'metric';
  awsCli('cloudwatch', 'put-metric-data', ['--namespace', 'LTG/StudentArchive', '--metric-data', 'MetricName=Success,Value=1,Unit=Count']);
} catch (error) {
  console.error(archiveFailure(stage, error).message);
  process.exitCode = 1;
} finally { if (client) { try { await client.end(); } catch {} } }

