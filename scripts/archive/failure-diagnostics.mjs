// Only fixed identifiers may leave the worker. Never log database/provider errors.
const stages = new Set(['startup', 'credentials', 'database-connect', 'snapshot',
  'prepare', 'retain', 'download-verify', 'recovery-connect', 'recovery', 'success-metric']);
const codes = new Set(['CORE_SCHEMA_MISMATCH', 'CONTEXT_SCHEMA_MISMATCH', 'STORAGE_REQUIRES_RESOLVER']);
export function archiveError(code) {
  if (!codes.has(code)) throw new Error('Unknown archive diagnostic code');
  return Object.assign(new Error('Archive validation failed'), { archiveCode: code });
}
export function failureDiagnostic(stage, error) {
  const safeStage = stages.has(stage) ? stage : 'unknown';
  const code = codes.has(error?.archiveCode) ? error.archiveCode : 'UNCLASSIFIED';
  return `LTG archive FAILED at ${safeStage} (${code}). No success is certified. Record contents and credentials are omitted.`;
}
