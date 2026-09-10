const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

const publicRoutes = [
  '/',
  '/login',
  '/account-setup',
  '/reset-password',
  '/training/login',
  '/demo',
];

const protectedRoutes = [
  ['/dashboard', '/login'],
  ['/agenda', '/login'],
  ['/resources', '/login'],
  ['/classroom', '/login'],
  ['/attendance', '/login'],
  ['/time-clock', '/login'],
  ['/reports', '/login'],
  ['/school', '/login'],
  ['/owner', '/login'],
  ['/accounts', '/login'],
  ['/training', '/training/login'],
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
for (const route of publicRoutes) {
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

for (const [route, expectedLoginPath] of protectedRoutes) {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) {
      failures.push(`${route}: expected an unauthenticated redirect, received HTTP ${response.status}`);
      continue;
    }

    const location = response.headers.get('location');
    if (!location) {
      failures.push(`${route}: redirect did not include a Location header`);
      continue;
    }

    const redirectUrl = new URL(location, baseUrl);
    if (redirectUrl.pathname !== expectedLoginPath) {
      failures.push(
        `${route}: expected redirect to ${expectedLoginPath}, received ${redirectUrl.pathname}`
      );
    }

    if (redirectUrl.searchParams.get('next') !== route) {
      failures.push(
        `${route}: redirect did not preserve the requested route in the next parameter`
      );
    }

    const cacheControl = response.headers.get('cache-control') ?? '';
    if (!cacheControl.toLowerCase().includes('no-store')) {
      failures.push(`${route}: protected redirect is missing Cache-Control no-store`);
    }
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error('\nRuntime route smoke test failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Runtime route smoke test passed: ${publicRoutes.length} public entry points returned HTTP 200 and ${protectedRoutes.length} protected routes redirected unauthenticated requests correctly.`
);
