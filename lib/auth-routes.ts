const PUBLIC_EXACT_ROUTES = new Set([
  '/shop/student',
  '/lab/student',
  '/',
  '/login',
  '/account-setup',
  '/reset-password',
  '/training/login',
  '/demo',
]);

const PUBLIC_ROUTE_PREFIXES = ['/join/', '/job/', '/demo/'];

export function isPublicRoute(pathname: string) {
  return (
    PUBLIC_EXACT_ROUTES.has(pathname) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function loginRouteFor(pathname: string) {
  return pathname === '/training' || pathname.startsWith('/training/')
    ? '/training/login'
    : '/login';
}

export function safePostLoginRoute(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') ||
      /[\\\u0000-\u001f\u007f]/.test(value)) {
    return '/dashboard';
  }

  const origin = 'https://ltg.invalid';
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || isPublicRoute(target.pathname)) return '/dashboard';
    return value;
  } catch {
    return '/dashboard';
  }
}
