import * as barrel from './index';
import { SidebarItem } from './SidebarItem';

describe('SidebarItem barrel (backwards compatibility)', () => {
  it('re-exports SidebarItem', () => {
    expect(barrel.SidebarItem).toBe(SidebarItem);
  });
});
