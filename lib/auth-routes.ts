const PUBLIC_EXACT_ROUTES = new Set([
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
  return pathname.startsWith('/training/') ? '/training/login' : '/login';
}

export function safePostLoginRoute(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }

  return isPublicRoute(value) ? '/dashboard' : value;
}
