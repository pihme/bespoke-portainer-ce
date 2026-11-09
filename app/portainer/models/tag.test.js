import { describe, it, expect } from 'vitest';

import { TagViewModel } from './tag';

describe('REQ-ENV-14 TagViewModel mapping', () => {
  it('maps ID to Id and escapes the tag name', () => {
    const vm = new TagViewModel({ ID: 12, Name: 'prod' });
    expect(vm.Id).toBe(12);
    expect(vm.Name).toBe('prod');
  });

  it('escapes HTML-sensitive characters in the tag name', () => {
    const vm = new TagViewModel({ ID: 1, Name: '<script>alert(1)</script>' });
    expect(vm.Name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
