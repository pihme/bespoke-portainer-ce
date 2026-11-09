import { columnHelper } from './helper';

describe('REQ-CTR-01 containers datatable column helper', () => {
  it('exposes a typed column helper for container rows', () => {
    expect(columnHelper).toBeDefined();
    expect(typeof columnHelper.accessor).toBe('function');
    expect(typeof columnHelper.display).toBe('function');
  });
});
