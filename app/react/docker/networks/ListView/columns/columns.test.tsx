import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it } from 'vitest';

import { useColumns } from './index';

describe('useColumns for local Docker networks', () => {
  it('omits the Node column when host column is not visible', () => {
    const { result } = renderHook(() => useColumns(false));
    const headers = result.current.map((c) =>
      typeof c.header === 'string' ? c.header : c.id
    );
    expect(headers).toContain('Name');
    expect(headers).toContain('Driver');
    expect(headers).not.toContain('Node');
  });

  it('includes the Node column when host column is visible', () => {
    const { result } = renderHook(() => useColumns(true));
    const headers = result.current.map((c) =>
      typeof c.header === 'string' ? c.header : c.id
    );
    expect(headers).toContain('Node');
  });
});
