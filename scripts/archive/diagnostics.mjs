// Only fixed stages enter logs. Never retain a cause, database message, SQL,
// object key, credentials, record values, or caller-provided error properties.
const stages = new Set([
  'configuration', 'credentials', 'database-connect', 'capture', 'database-close',
  'core-transaction', 'core-schema', 'core-read', 'core-counts', 'core-commit',
  'context-schema', 'context-read', 'storage-inventory', 'template-read',
  'prepare', 'retain', 'recover-objects', 'recover-database', 'report', 'metric',
]);
const failures = new WeakMap();
export function archiveFailure(stage, error) {
  const safeStage = failures.get(error) ?? (stages.has(stage) ? stage : 'unknown');
  const failure = new Error(`LTG archive failed at ${safeStage}; no success is certified. Record contents and credentials are omitted.`);
  failures.set(failure, safeStage);
  return failure;
}
