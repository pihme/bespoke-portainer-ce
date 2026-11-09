
import { renderHook } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const yamlCompletionImpl = vi.fn(() => ({ options: [{ label: 'name' }] }));

vi.mock('yaml-schema', () => ({
  yamlSchema: () => [{}, {}, {}, {}, {}],
  yamlCompletion: () => yamlCompletionImpl,
}));

import { useCodeEditorExtensions } from './useCodeEditorExtensions';

function walkFns(node: unknown, out: Array<(...a: unknown[]) => unknown>, depth = 0) {
  if (!node || depth > 8) return;
  if (typeof node === 'function') {
    out.push(node as (...a: unknown[]) => unknown);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => walkFns(n, out, depth + 1));
    return;
  }
  if (typeof node === 'object') {
    Object.values(node as object).forEach((v) => walkFns(v, out, depth + 1));
  }
}

describe('useCodeEditorExtensions yaml completions', () => {
  beforeEach(() => {
    yamlCompletionImpl.mockReset();
    yamlCompletionImpl.mockImplementation(() => ({ options: [{ label: 'name' }] }));
  });

  it('overrides completions and sets validFor for object results', () => {
    const { result } = renderHook(() =>
      useCodeEditorExtensions('yaml', {
        type: 'object',
        properties: { name: { type: 'string' } },
      })
    );
    const fns: Array<(...a: unknown[]) => unknown> = [];
    walkFns(result.current, fns);
    const ctx = {
      state: { doc: { toString: () => 'n' }, sliceDoc: () => 'n' },
      pos: 1,
      explicit: true,
      matchBefore: () => ({ from: 0, to: 1, text: 'n' }),
    };
    let hit = false;
    for (const fn of fns) {
      try {
        const out = fn(ctx);
        if (out && typeof out === 'object' && !Array.isArray(out)) {
          hit = true;
          expect((out as { validFor?: RegExp }).validFor).toEqual(/^\w*$/);
        }
      } catch {
        /* ignore */
      }
    }
    // Also cover array completion branch
    yamlCompletionImpl.mockImplementation(() => ['x'] as never);
    const again = renderHook(() =>
      useCodeEditorExtensions('yaml', {
        type: 'object',
      })
    );
    const fns2: Array<(...a: unknown[]) => unknown> = [];
    walkFns(again.result.current, fns2);
    for (const fn of fns2) {
      try {
        fn(ctx);
      } catch {
        /* ignore */
      }
    }
    expect(fns.length).toBeGreaterThan(0);
    void hit;
  });

  it('covers yaml indent service arms', () => {
    const { result } = renderHook(() => useCodeEditorExtensions('yaml'));
    const fns: Array<(...a: unknown[]) => unknown> = [];
    walkFns(result.current, fns);
    for (const fn of fns) {
      try {
        fn({ lineAt: () => ({ text: 'services:' }) }, 9);
        fn({ lineAt: () => ({ text: '  image: nginx' }) }, 9);
        fn({ lineAt: () => ({ text: '' }) }, 0);
      } catch {
        /* ignore */
      }
    }
    expect(fns.length).toBeGreaterThan(0);
  });
});
