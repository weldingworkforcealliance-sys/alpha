import { readFileSync } from 'node:fs';

export const contextSchema = JSON.parse(readFileSync(new URL('./context-schema.json', import.meta.url), 'utf8'));
const quote = value => { if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw Error('Invalid inventory'); return `"${value}"`; };
export const contextSchemaSql = `select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and table_name in (${Object.keys(contextSchema).map(n => `'${n}'`).join(',')}) order by table_name,ordinal_position`;
export function contextDataSql(table) {
  const columns = contextSchema[table]; if (!columns) throw Error('Unreviewed context table');
  const pairs = columns.flatMap(c => [`'${c.name}'`, `t.${quote(c.name)}${c.type === 'bigint' ? '::text' : ''}`]);
  return `select count(*)::int as total,coalesce(jsonb_agg(jsonb_build_object(${pairs.join(',')})),'[]'::jsonb) as records from public.${quote(table)} t`;
}
export const templateSql = `select school_id,layout,encode(pdf,'base64') as base64,created_at from certificate_private.templates order by school_id`;
export const storageSql = 'select count(*)::int as object_count from storage.objects';

export async function captureSupplement(client) {
  const actual = (await client.query(contextSchemaSql)).rows;
  const datasets = {}, sourceCounts = {};
  for (const [table, columns] of Object.entries(contextSchema)) {
    const observed = actual.filter(r => r.table_name === table).map(r => ({ name: r.column_name, type: r.data_type }));
    if (JSON.stringify(observed) !== JSON.stringify(columns)) throw Error('Context schema requires review');
    const rows = (await client.query(contextDataSql(table))).rows;
    if (rows.length !== 1 || !Array.isArray(rows[0].records) || rows[0].total !== rows[0].records.length) throw Error('Incomplete context');
    datasets[table] = rows[0].records; sourceCounts[table] = rows[0].total;
  }
  const storage = (await client.query(storageSql)).rows;
  // Current production inventory has zero Storage objects. Until an actual-byte
  // resolver is installed, future uploads MUST block success instead of vanishing.
  if (storage.length !== 1 || storage[0].object_count !== 0) throw Error('Storage objects require a reviewed file-transfer resolver');
  const templates = (await client.query(templateSql)).rows;
  return { format: 'ltg-archive-context-v1', datasets, sourceCounts, templates,
    storage: { objectCount: 0, checkedInSnapshot: true },
    schema: contextSchema };
}

