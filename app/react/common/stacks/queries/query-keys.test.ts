import { queryKeys } from './query-keys';

describe('REQ-STK-01 stack query keys', () => {
  it('builds base, stack and file keys', () => {
    expect(queryKeys.base()).toEqual(['stacks']);
    expect(queryKeys.stack(4)).toEqual(['stacks', 4]);
    expect(queryKeys.stackFile(4, { version: 1 })).toEqual([
      'stacks',
      4,
      'file',
      { version: 1 },
    ]);
  });
});
