export function databaseConfig(value, environment) {
  const project = ({ production: 'qsmvgyyaemjmklceyikr', staging: 'ezlvivmeneefiiwqwgqd' })[environment];
  let input;
  try { input = JSON.parse(value); } catch { throw Error('Archive database configuration is missing or invalid.'); }
  if (!project || input.project !== project || input.database !== 'postgres' || input.port !== 5432
    || typeof input.password !== 'string' || input.password.length < 24
    || !(input.host === `db.${project}.supabase.co` && input.user === 'ltg_archive_reader'
      || /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(input.host)
        && input.user === `ltg_archive_reader.${project}`)) {
    throw Error('Archive database destination or reader role does not match the approved environment.');
  }
  // Do not pass arbitrary connection-string SSL options; pg lets them replace
  // explicit TLS settings. No option can disable certificate verification here.
  return { host: input.host, port: input.port, database: input.database,
    user: input.user, password: input.password,
    ssl: { rejectUnauthorized: true, ...(input.ca ? { ca: input.ca } : {}) },
    enableChannelBinding: true, connectionTimeoutMillis: 15000,
    application_name: 'ltg-student-archive', options: '-c default_transaction_read_only=on' };
}

