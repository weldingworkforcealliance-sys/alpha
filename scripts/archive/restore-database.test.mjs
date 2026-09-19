import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from './school-bundle.mjs';
import { verifyIsolatedRecovery } from './restore-isolated.mjs';
import { readFileSync } from 'node:fs';

test('isolated recovery refuses production or another database without starting a write transaction', async () => {
  const calls = [];
  await assert.rejects(verifyIsolatedRecovery({ query: async sql => {
    calls.push(sql); return { rows: [{ name: 'postgres', address: '1.2.3.4' }] };
  } }, [], { entries: [] }));
  assert.equal(calls.length, 1);
});

test('real PostgreSQL restores historical rows and exact certificate bytes without executing archived text',
  { skip: process.env.LTG_ARCHIVE_DB_DRILL !== 'true' }, async () => {
    const { Client } = await import('pg');
    const client = new Client({ host: '127.0.0.1', port: 5432, database: 'ltg_archive_recovery',
      user: 'archive_drill', password: 'synthetic-local-drill-only', connectionTimeoutMillis: 10000 });
    await client.connect();
    try {
      const exportId = '20000000-0000-4000-8000-000000000001';
      const artifacts = [{ name: 'administrative-context.json', bytes: Buffer.from(JSON.stringify({ exportId, environment: 'staging', datasets: {
        grade_history: [{ student: 'synthetic', active: false, score: 0, revision: '9007199254740993' },
          { student: 'synthetic', active: false, score: 76, revision: '9007199254740994', note: "'; DROP SCHEMA public CASCADE; --" }],
        attendance: [{ status: 'present', student: 'synthetic', corrections: [{ before: 'absent', after: 'present' }] }],
      } })) }, { name: 'certificate-test.pdf', bytes: Buffer.from('%PDF-synthetic-not-a-valid-certificate') }];
      const receipt = { exportId, environment: 'staging', entries: artifacts.map(a => ({ name: a.name, sha256: sha256(a.bytes) })) };
      const result = await verifyIsolatedRecovery(client, artifacts, receipt);
      assert.equal(result.recordsVerified, 3); assert.equal(result.artifactsVerified, 2);
      const tables = await client.query("select to_regnamespace('ltg_archive_drill') as schema");
      assert.equal(tables.rows[0].schema, null);
      assert.ok((await client.query("select to_regnamespace('public') as schema")).rows[0].schema);
    } finally { await client.end(); }
  });

test('prepared database reader can read RLS-protected tables but has no write or login privileges',
  { skip: process.env.LTG_ARCHIVE_DB_DRILL !== 'true' }, async () => {
    const { Client } = await import('pg');
    const client = new Client({ host: '127.0.0.1', port: 5432, database: 'ltg_archive_recovery',
      user: 'archive_drill', password: 'synthetic-local-drill-only', connectionTimeoutMillis: 10000 });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA certificate_private; CREATE SCHEMA storage');
      const tables = [...Object.keys(JSON.parse(readFileSync(new URL('./core-schema.json', import.meta.url)))),
        ...Object.keys(JSON.parse(readFileSync(new URL('./context-schema.json', import.meta.url))))];
      for (const table of tables) {
        assert.match(table, /^[a-z_][a-z_0-9]*$/);
        await client.query(`CREATE TABLE public.${table} (id text); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      }
      await client.query('CREATE TABLE certificate_private.templates (id text); CREATE TABLE storage.objects (id text)');
      await client.query("INSERT INTO public.schools VALUES ('synthetic')");
      await client.query(readFileSync(new URL('../../infra/archive-reader.sql', import.meta.url), 'utf8'));
      const permissions = (await client.query("select rolcanlogin,rolsuper,rolcreaterole from pg_roles where rolname='ltg_archive_reader'")).rows[0];
      assert.deepEqual(permissions, { rolcanlogin: false, rolsuper: false, rolcreaterole: false });
      await client.query('SET LOCAL ROLE ltg_archive_reader');
      await client.query('SET LOCAL row_security = off');
      assert.equal((await client.query('SELECT count(*)::int AS count FROM public.schools')).rows[0].count, 1);
      for (const action of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        assert.equal((await client.query('SELECT has_table_privilege(current_user,$1,$2) AS allowed', ['public.schools', action])).rows[0].allowed, false);
      }
      await client.query('SAVEPOINT denied_write');
      await assert.rejects(client.query("INSERT INTO public.schools VALUES ('forbidden')"), e => e.code === '42501');
      await client.query('ROLLBACK TO SAVEPOINT denied_write');
    } finally { await client.query('ROLLBACK'); await client.end(); }
  });

