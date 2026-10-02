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
const INTERNAL_ORIGIN = 'https://ltg.invalid';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

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

function hasUnsafePathEncoding(pathname: string) {
  let decoded = pathname;

  for (let pass = 0; pass < 2; pass += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return true;
    }

    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      CONTROL_CHARACTERS.test(decoded)
    ) {
      return true;
    }
  }

  return false;
}

export function safePostLoginRoute(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return '/dashboard';
  }

  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN || hasUnsafePathEncoding(target.pathname)) {
      return '/dashboard';
    }

    if (isPublicRoute(target.pathname)) return '/dashboard';

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/dashboard';
  }
}
