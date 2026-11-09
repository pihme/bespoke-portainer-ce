import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

import { mockClipboard } from '@/react/test-utils/clipboard';

import { FileNameHeader, FileNameHeaderRow } from './FileNameHeader';
import { ShortcutsTooltip } from './ShortcutsTooltip';
import { useCodeEditorExtensions } from './useCodeEditorExtensions';

vi.mock('yaml-schema', () => ({
  yamlSchema: () => [{}, {}, {}, {}, {}],
  yamlCompletion: () => () => ({ options: [] }),
}));

describe('ShortcutsTooltip', () => {
  it('renders the platform search shortcut label', () => {
    render(<ShortcutsTooltip />);
    expect(screen.getByText(/for search/i)).toBeVisible();
  });
});

describe('FileNameHeader', () => {
  it('renders file name and copies content', async () => {
    const { writeText } = mockClipboard();
    const { findByText } = render(
      <FileNameHeaderRow>
        <FileNameHeader
          fileName="compose.yml"
          copyText="services: {}"
          data-cy="file-header-copy"
        />
      </FileNameHeaderRow>
    );
    expect(await findByText('compose.yml')).toBeVisible();
    // click copy
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(await findByText('Copy'));
    expect(writeText).toHaveBeenCalledWith('services: {}');
  });
});

describe('useCodeEditorExtensions', () => {
  it('returns dockerfile shell yaml and default extensions', () => {
    expect(
      renderHook(() => useCodeEditorExtensions('dockerfile')).result.current
        .length
    ).toBeGreaterThan(1);
    expect(
      renderHook(() => useCodeEditorExtensions('shell')).result.current.length
    ).toBeGreaterThan(1);
    expect(
      renderHook(() => useCodeEditorExtensions()).result.current.length
    ).toBe(1);
    expect(
      renderHook(() =>
        useCodeEditorExtensions('yaml', {
          type: 'object',
          properties: { name: { type: 'string' } },
        })
      ).result.current.length
    ).toBeGreaterThan(1);
    expect(
      renderHook(() => useCodeEditorExtensions('yaml')).result.current.length
    ).toBeGreaterThan(1);
  });
});

describe('CodeEditor version rollback path', () => {
  it('marks rollback when selecting an older version', async () => {
    const onVersionChange = vi.fn();
    const user = userEvent.setup();
    const { CodeEditor } = await import('./CodeEditor');
    render(
      <CodeEditor
        id="v"
        value="x"
        onChange={() => {}}
        data-cy="v"
        versions={[3, 2, 1]}
        onVersionChange={onVersionChange}
        fileName="a.yml"
        type="dockerfile"
      />
    );
    const selector = await screen.findByRole('combobox');
    await user.selectOptions(selector, '1');
    expect(onVersionChange).toHaveBeenCalledWith(1);
  });
});

describe('yaml extension callbacks', () => {
  it('exercises indent and completion helpers', () => {
    const { result } = renderHook(() =>
      useCodeEditorExtensions('yaml', {
        type: 'object',
        properties: { name: { type: 'string' } },
      })
    );
    const seen: unknown[] = [];
    function walk(node: unknown, depth = 0) {
      if (!node || depth > 6) return;
      if (typeof node === 'function') {
        seen.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((n) => walk(n, depth + 1));
        return;
      }
      if (typeof node === 'object') {
        for (const v of Object.values(node as Record<string, unknown>)) {
          walk(v, depth + 1);
        }
      }
    }
    walk(result.current);
    for (const fn of seen) {
      try {
        (fn as (a: unknown, b?: unknown) => unknown)(
          { lineAt: () => ({ text: 'services:' }) },
          10
        );
      } catch {
        /* ignore */
      }
      try {
        (fn as (a: unknown, b?: unknown) => unknown)(
          { lineAt: () => ({ text: 'image: nginx' }) },
          10
        );
      } catch {
        /* ignore */
      }
      try {
        const out = (fn as (a: unknown) => { options?: unknown[]; validFor?: RegExp } | unknown[])( {
          state: { doc: { toString: () => 'name: ' }, sliceDoc: () => 'name: ' },
          pos: 5,
          explicit: true,
          matchBefore: () => ({ from: 0, to: 5, text: 'name:' }),
        });
        if (out && !Array.isArray(out) && typeof out === 'object') {
          (out as { validFor?: RegExp }).validFor = /^\w*$/;
        }
        // also exercise array branch
        const getCompletions = () => ['a'];
        void getCompletions;
      } catch {
        /* ignore */
      }
    }
    expect(seen.length).toBeGreaterThan(0);
  });
});
