import { describe, expect, it } from 'vitest';

import { isEditableTableMeta } from './isEditableTableMeta';

describe('isEditableTableMeta (backwards compatibility)', () => {
  it('returns true only when all editable meta methods are present', () => {
    expect(isEditableTableMeta(undefined)).toBe(false);
    expect(isEditableTableMeta(null)).toBe(false);
    expect(isEditableTableMeta('x')).toBe(false);
    expect(isEditableTableMeta({})).toBe(false);
    expect(
      isEditableTableMeta({
        getEditableRow: () => 0,
        getEditableRowOriginalData: () => undefined,
        editRow: () => {},
        updateRow: () => {},
        revertRow: () => {},
      })
    ).toBe(false);
    expect(
      isEditableTableMeta({
        getEditableRow: () => 0,
        getEditableRowOriginalData: () => undefined,
        editRow: () => {},
        updateRow: () => {},
        revertRow: () => {},
        acceptRow: () => {},
      })
    ).toBe(true);
  });
});
