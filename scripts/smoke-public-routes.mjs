const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

const routes = [
  '/',
  '/login',
  '/account-setup',
  '/reset-password',
  '/training/login',
  '/demo',
];

async function waitForServer() {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
      lastError = new Error(`Server returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Next.js server did not become ready at ${baseUrl}: ${lastError?.message ?? 'unknown error'}`);
}

await waitForServer();

const failures = [];
for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    const body = await response.text();

    if (response.status !== 200) {
      failures.push(`${route}: expected HTTP 200, received ${response.status}`);
      continue;
    }

    if (body.length < 200) {
      failures.push(`${route}: response body was unexpectedly short (${body.length} bytes)`);
    }
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error('\nPublic route smoke test failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public route smoke test passed: ${routes.length} public entry points returned HTTP 200.`);
