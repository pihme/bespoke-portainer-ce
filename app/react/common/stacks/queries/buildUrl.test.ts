import { buildStackUrl } from './buildUrl';

describe('REQ-STK-01 buildStackUrl', () => {
  it('builds list, item and action URLs', () => {
    expect(buildStackUrl()).toBe('/stacks');
    expect(buildStackUrl(3)).toBe('/stacks/3');
    expect(buildStackUrl(3, 'file')).toBe('/stacks/3/file');
  });
});
