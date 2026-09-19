import { sha256, recoverSchoolBundle } from './school-bundle.mjs';

const canonical = value => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);

// Imports portable archive records into a separate queryable recovery schema,
// verifies every value and attachment, then rolls the drill back. This does not
// restore production application tables, auth accounts, RLS or server settings.
export async function verifyIsolatedRecovery(client, artifacts, receipt) {
  let started = false;
  try {
    const identity = (await client.query("select current_database() as name, inet_server_addr()::text as address")).rows[0];
    if (identity?.name !== 'ltg_archive_recovery' || !['127.0.0.1/32', '127.0.0.1', '::1/128', '::1'].includes(identity.address)) {
      // In a Docker service, inet_server_addr is private bridge address; the
      // caller verifies its actual connected socket is loopback before invoking.
      if (identity?.name !== 'ltg_archive_recovery' || !['127.0.0.1', '::1'].includes(client.connection?.stream?.remoteAddress)) throw Error('Not isolated recovery database');
    }
    await client.query('BEGIN'); started = true;
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('CREATE SCHEMA ltg_archive_drill');
    await client.query('CREATE TABLE ltg_archive_drill.records (ordinal integer primary key, scope text not null, dataset text not null, payload jsonb not null)');
    await client.query('CREATE TABLE ltg_archive_drill.files (ordinal integer primary key, identity text not null, content bytea not null)');
    let rows = 0, files = 0;
    const expectedRows = [], expectedFiles = [];
    async function insertRows(scope, datasets) {
      for (const [table, records] of Object.entries(datasets)) {
        if (!/^[a-z_][a-z_0-9]*$/.test(table) || !Array.isArray(records)) throw Error('Invalid recovery dataset');
        for (const record of records) {
          expectedRows.push({ ordinal: rows, scope, dataset: table, payload: record });
          await client.query('INSERT INTO ltg_archive_drill.records VALUES ($1,$2,$3,$4::jsonb)', [rows++, scope, table, JSON.stringify(record)]);
        }
      }
    }
    const expectedNames = new Set(receipt.entries.map(e => e.name));
    if (expectedNames.size !== receipt.entries.length || artifacts.length !== expectedNames.size) throw Error('Incomplete recovery inventory');
    for (const artifact of artifacts) {
      if (!expectedNames.delete(artifact.name)) throw Error('Duplicate recovered artifact');
      const trusted = receipt.entries.find(e => e.name === artifact.name);
      if (trusted.sha256 !== sha256(artifact.bytes)) throw Error('Recovery digest mismatch');
      if (artifact.name.startsWith('school-') && artifact.name.endsWith('.json')) {
        const schoolId = artifact.name.slice(7, -5);
        const bundle = recoverSchoolBundle(artifact.bytes, { expectedDigest: trusted.sha256, schoolId, exportId: receipt.exportId });
        await insertRows(schoolId, bundle.datasets);
      } else if (artifact.name === 'administrative-context.json') {
        const context = JSON.parse(artifact.bytes);
        if (context.exportId !== receipt.exportId || context.environment !== receipt.environment) throw Error('Context identity mismatch');
        await insertRows('administrative', context.datasets);
      }
      // Preserve exact original artifact bytes as well as queryable records.
      expectedFiles.push({ ordinal: files, identity: artifact.name, content: artifact.bytes });
      await client.query('INSERT INTO ltg_archive_drill.files VALUES ($1,$2,$3)', [files++, artifact.name, artifact.bytes]);
    }
    const actualRows = (await client.query('SELECT * FROM ltg_archive_drill.records ORDER BY ordinal')).rows;
    const actualFiles = (await client.query('SELECT * FROM ltg_archive_drill.files ORDER BY ordinal')).rows;
    if (canonical(actualRows) !== canonical(expectedRows) || actualFiles.length !== expectedFiles.length
      || actualFiles.some((f, i) => f.ordinal !== expectedFiles[i].ordinal || f.identity !== expectedFiles[i].identity || !f.content.equals(expectedFiles[i].content))) throw Error('Restored data does not match');
    await client.query('ROLLBACK'); started = false;
    return { recordsVerified: rows, artifactsVerified: files };
  } catch {
    if (started) { try { await client.query('ROLLBACK'); } catch {} }
    throw Error('Isolated archive recovery drill failed. No production restore was attempted.');
  }
}

