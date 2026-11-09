import { queryKeys } from './query-keys';

describe('REQ-TPL-03 custom template query keys', () => {
  it('builds the base, list, item and file keys', () => {
    expect(queryKeys.base()).toEqual(['custom-templates']);
    expect(queryKeys.list({ edge: false })).toEqual([
      'custom-templates',
      { params: { edge: false } },
    ]);
    expect(queryKeys.item(4)).toEqual(['custom-templates', 4]);
    expect(queryKeys.file(4, { git: false })).toEqual([
      'custom-templates',
      4,
      'file',
      { git: false },
    ]);
  });
});
