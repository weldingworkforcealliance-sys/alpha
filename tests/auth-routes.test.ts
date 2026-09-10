import { describe, expect, it } from 'vitest';
import { isPublicRoute, loginRouteFor, safePostLoginRoute } from '../lib/auth-routes';

describe('server route protection', () => {
  it('keeps only intentional entry routes public', () => {
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
    expect(loginRouteFor('/training/session/123/teacher')).toBe('/training/login');
    expect(loginRouteFor('/planner')).toBe('/login');
  });

  it('allows safe protected return targets only', () => {
    expect(safePostLoginRoute('/planner?day=3')).toBe('/planner?day=3');
    expect(safePostLoginRoute('https://attacker.example')).toBe('/dashboard');
    expect(safePostLoginRoute('//attacker.example')).toBe('/dashboard');
    expect(safePostLoginRoute('/login')).toBe('/dashboard');
  });
});
