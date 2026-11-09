import { describe, expect, it, vi } from 'vitest';
import { Row } from '@tanstack/react-table';

import { multiple } from './filter-types';

type Item = { status: string };

function rowWith(status: string): Row<Item> {
  return {
    getValue: vi.fn((columnId: string) => {
      expect(columnId).toBe('status');
      return status;
    }),
  } as unknown as Row<Item>;
}

describe('multiple filter (backwards compatibility)', () => {
  it('returns true when the filter value list is empty', () => {
    expect(multiple(rowWith('running'), 'status', [])).toBe(true);
  });

  it('returns true when the row value is included in the filter list', () => {
    expect(multiple(rowWith('running'), 'status', ['running', 'stopped'])).toBe(
      true
    );
  });

  it('returns false when the row value is not included in the filter list', () => {
    expect(multiple(rowWith('paused'), 'status', ['running'])).toBe(false);
  });
});
