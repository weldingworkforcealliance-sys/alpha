import { describe, expect, it } from 'vitest';
import { isPublicRoute, loginRouteFor, safePostLoginRoute } from '../lib/auth-routes';

describe('server route protection', () => {
  it('keeps only intentional entry routes public', () => {
    expect(isPublicRoute('/lab/student')).toBe(true);
    expect(isPublicRoute('/lab/student/admin')).toBe(false);
    expect(isPublicRoute('/lab/instructor')).toBe(false);
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/join/ABC123')).toBe(true);
    expect(isPublicRoute('/job/ABC123')).toBe(true);
    expect(isPublicRoute('/demo')).toBe(true);
    expect(isPublicRoute('/demo/programs')).toBe(true);
    expect(isPublicRoute('/demo/nursing')).toBe(true);
    expect(isPublicRoute('/demolition')).toBe(false);
    expect(isPublicRoute('/dashboard')).toBe(false);
    expect(isPublicRoute('/owner/admin')).toBe(false);
  });

  it('uses the training login for protected training pages', () => {
    expect(loginRouteFor('/training')).toBe('/training/login');
    expect(loginRouteFor('/training/session/123/teacher')).toBe('/training/login');
    expect(loginRouteFor('/planner')).toBe('/login');
  });

  it('allows safe protected return targets only', () => {
    expect(safePostLoginRoute('/planner?day=3')).toBe('/planner?day=3');
    expect(safePostLoginRoute('https://attacker.example')).toBe('/dashboard');
    expect(safePostLoginRoute('//attacker.example')).toBe('/dashboard');
    expect(safePostLoginRoute('/login')).toBe('/dashboard');
  });

  it.each(['/\\attacker.example', '/\t/attacker.example', '/\n/attacker.example', '/\r/attacker.example', '//attacker.example', 'https://attacker.example', '', '/path\u0000'])('rejects unsafe login target %j after query decoding', (target) => {
    const query = new URLSearchParams({ next: target });
    expect(safePostLoginRoute(new URLSearchParams(query.toString()).get('next'))).toBe('/dashboard');
  });

  it.each(['/planner?day=3', '/gradebook#student', '/planner?label=a%20b', '/planner?return=https://example.com', '/%5cattacker.example', '/%2fattacker.example'])('preserves a same-origin destination %s', (target) => {
    const result = safePostLoginRoute(target);
    expect(result).toBe(target);
    expect(new URL(result, 'https://ltgeducation.com').origin).toBe('https://ltgeducation.com');
  });

  it.each(['/login?next=/planner', '/login#form', '/gradebook/../login', '/demo/programs'])('avoids returning to public entry route %s', (target) => {
    expect(safePostLoginRoute(target)).toBe('/dashboard');
  });
});
