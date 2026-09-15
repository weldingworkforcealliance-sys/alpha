import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Children, isValidElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { formatError } from '../lib/format-error';
import { pageEffect, pageHandler } from './helpers/page-handler';

const pages = [
  ['app/accounts/page.tsx', 7, 'Account management could not be loaded', 'Account management failed to load.'],
  ['app/accounts/diagnostics/page.tsx', 9, 'Invitation diagnostics could not be loaded', 'Invitation diagnostics could not be loaded.'],
] as const;

// Evaluate the real page with hooks supplied by the test. The initial client
// factories are inert; effects are exercised separately below.
function renderPage(path: string, errorIndex: number, error: string, loading = false) {
  let stateIndex = 0;
  const reload = vi.fn();
  const push = vi.fn();
  const dependencies: Record<string, unknown> = {
    'react/jsx-runtime': jsxRuntime,
    react: {
      useState: (initial: unknown) => {
        const index = stateIndex++;
        const value = index === 2 ? loading : index === errorIndex ? error
          : typeof initial === 'function' ? initial() : initial;
        return [value, vi.fn()];
      },
      useMemo: (compute: () => unknown) => compute(),
      useEffect: vi.fn(),
    },
    'next/navigation': { useRouter: () => ({ push }) },
    '@/lib/supabase-browser': { getSupabase: () => ({}) },
    '@supabase/supabase-js': { createClient: () => ({}) },
    '@/lib/format-error': { formatError },
  };
  const exports: { default?: () => ReactNode } = {};
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    exports, process: { env: {} }, window: { location: { reload } },
    require: (name: string) => {
      if (!(name in dependencies)) throw new Error(`Unexpected page dependency: ${name}`);
      return dependencies[name];
    },
  });
  if (!exports.default) throw new Error('Page export is missing');
  const element = exports.default();
  const buttons = new Map<string, () => void>();
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return;
      if (child.type === 'button' && child.props.onClick) {
        buttons.set(String(child.props.children), child.props.onClick);
      }
      visit(child.props.children);
    });
  }
  visit(element);
  return { html: renderToStaticMarkup(element), buttons, reload, push };
}

describe.each(pages)('%s load recovery', (path, errorIndex, title, fallback) => {
  it('renders the sanitized error, exposes Retry, and retains dashboard recovery', () => {
    const error = formatError({
      message: 'relation private.memberships does not exist', details: 'secret', hint: 'secret',
    }, fallback);
    const h = renderPage(path, errorIndex, error);
    expect(h.html).toContain(title);
    expect(h.html).toContain(`<p role="alert">${fallback}</p>`);
    expect(h.html).not.toContain('Access denied');
    expect(h.html).not.toContain('secret');
    expect(h.html).not.toContain('private.memberships');
    expect(h.html).not.toContain('<input');
    expect(h.buttons.has('Retry')).toBe(true);
    h.buttons.get('Retry')!();
    expect(h.reload).toHaveBeenCalledOnce();
    h.buttons.get('Return to Dashboard')!();
    expect(h.push).toHaveBeenCalledWith('/dashboard');
  });

  it('preserves genuine access denial without offering a misleading retry', () => {
    const h = renderPage(path, errorIndex, '');
    expect(h.html).toContain('Access denied');
    expect(h.html).toContain('Platform Owner, School Admin, or Program Lead access.');
    expect(h.html).not.toContain('role="alert"');
    expect(h.html).not.toContain('<input');
    expect(h.buttons.has('Retry')).toBe(false);
    expect(h.buttons.has('Return to Dashboard')).toBe(true);
  });

  it('keeps the loading screen until authorization checks finish', () => {
    const h = renderPage(path, errorIndex, fallback, true);
    expect(h.html).toContain('Loading ');
    expect(h.html).not.toContain('role="alert"');
    expect(h.buttons.size).toBe(0);
  });

  async function runSessionLookup(error: unknown, rejected = false) {
    const setError = vi.fn();
    const setLoading = vi.fn();
    const replace = vi.fn();
    const rpc = vi.fn();
    const from = vi.fn();
    const getSession = rejected
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue({ data: { session: null }, error });
    const context = {
      supabase: { auth: { getSession }, rpc, from },
      setError, setLoading, formatError, router: { replace },
    };
    const load = pageHandler<() => Promise<void>>(path, 'load', context);
    pageEffect(path, { ...context, load })();
    await vi.waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
    return { setError, replace, rpc, from };
  }

  it.each([false, true])('surfaces session lookup failures (rejected=%s) without redirecting', async (rejected) => {
    const h = await runSessionLookup({
      message: 'relation private.sessions does not exist', details: 'secret',
    }, rejected);
    expect(h.setError).toHaveBeenLastCalledWith(fallback);
    expect(h.replace).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.from).not.toHaveBeenCalled();
  });

  it('still redirects a genuinely signed-out visitor to login', async () => {
    const h = await runSessionLookup(null);
    expect(h.setError).toHaveBeenCalledExactlyOnceWith('');
    expect(h.replace).toHaveBeenCalledWith('/login');
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.from).not.toHaveBeenCalled();
  });
});

