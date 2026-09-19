import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { requiredDatasets } from './school-bundle.mjs';

const schema = JSON.parse(readFileSync(new URL('./core-schema.json', import.meta.url), 'utf8'));
const identifier = (value) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error('Invalid archive schema identifier.');
  return `"${value}"`;
};
const literals = requiredDatasets.map((name) => `'${name}'`).join(', ');
export const schemaCheckSql = `select table_name, column_name, data_type
from information_schema.columns where table_schema = 'public'
and table_name in (${literals}) and column_name <> 'join_code'
order by table_name, ordinal_position`;

// No user-provided identifiers, LIMIT/OFFSET, active filters, or latest-only views.
// JSON aggregation keeps each dataset whole; bigint columns become decimal strings.
export function snapshotSql({ countsOnly = false } = {}) {
  const rows = requiredDatasets.map((name) => {
    const columns = schema[name].flatMap(({ name: column, type }) => [
      `'${column}'`, `t.${identifier(column)}${type === 'bigint' ? '::text' : ''}`,
    ]).join(', ');
    return `select '${name}' as dataset, count(*)::int as total${countsOnly ? ''
      : `, coalesce(jsonb_agg(jsonb_build_object(${columns})), '[]'::jsonb) as records`}
from public.${identifier(name)} t`;
  }).join('\nunion all\n');
  return `with datasets as (${rows})
select jsonb_build_object(
  'capturedAt', transaction_timestamp(),
  'expectedSchoolIds', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from public.schools),
  'sourceCounts', jsonb_object_agg(dataset, total)${countsOnly ? '' : ",\n  'datasets', jsonb_object_agg(dataset, records)"}
) as snapshot from datasets`;
}

function checkSchema(rows) {
  const actual = Object.fromEntries(requiredDatasets.map((table) => [table,
    rows.filter((row) => row.table_name === table).map((row) => ({ name: row.column_name, type: row.data_type }))]));
  if (JSON.stringify(actual) !== JSON.stringify(schema)) throw new Error('Student archive schema changed; review the inventory before export.');
}

// client must be a dedicated server-side database connection with audited read
// access to every school. Never pass an end-user connection or expose this as RPC.
// This function neither obtains credentials nor grants permissions.
export async function captureCoreSnapshot(client, { environment, sourceRevision, captureSupplement }) {
  if (!['staging', 'production'].includes(environment) || !/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error('Source environment and exact code revision are required.');
  }
  let started = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    started = true;
    await client.query("SET LOCAL statement_timeout = '60s'");
    // row_security=off does NOT bypass RLS: it makes filtered reads error instead
    // of silently producing an incomplete archive. The role needs explicit access.
    await client.query('SET LOCAL row_security = off');
    checkSchema((await client.query(schemaCheckSql)).rows);
    const result = await client.query(snapshotSql());
    if (result.rows?.length !== 1 || !result.rows[0].snapshot) throw new Error('Snapshot returned incomplete output.');
    const snapshot = result.rows[0].snapshot;
    for (const table of requiredDatasets) {
      if (!Array.isArray(snapshot.datasets?.[table]) || snapshot.datasets[table].length !== snapshot.sourceCounts?.[table]) {
        throw new Error('Snapshot counts do not reconcile.');
      }
    }
    // Optional internal reader runs inside this same database snapshot, never as
    // a separate transaction that might observe different grades/templates.
    const supplement = captureSupplement ? await captureSupplement(client) : null;
    await client.query('COMMIT');
    started = false;
    return { ...snapshot, format: 'ltg-student-snapshot-v2', scope: 'all-schools',
      consistency: 'repeatable-read', exportId: randomUUID(), environment, sourceRevision,
      // An explicit attachment resolver must fill both fields. Empty is not assumed.
      files: null, fileInventory: null, supplement };
  } catch {
    if (started) { try { await client.query('ROLLBACK'); } catch { /* caller must discard connection */ } }
    // Database errors can include record values; do not put them in CI logs.
    throw new Error('Student snapshot failed; discard this connection and inspect through the protected administrator channel.');
  }
}

