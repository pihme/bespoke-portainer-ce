import { describe, it, expect } from 'vitest';

import { ImageLayerViewModel } from './imageLayer';

describe('REQ-IMG-06 ImageLayerViewModel', () => {
  it('stores history order and layer fields for the details page', () => {
    const layer = {
      Id: 'layer-1',
      Created: '2024-01-01T00:00:00Z',
      CreatedBy: '/bin/sh -c #(nop) CMD ["nginx"]',
      Size: 2048,
      Comment: '',
      Tags: ['nginx:latest'],
    };

    const vm = new ImageLayerViewModel(3, layer);

    expect(vm.Order).toBe(3);
    expect(vm.Id).toBe('layer-1');
    expect(vm.Created).toBe('2024-01-01T00:00:00Z');
    expect(vm.CreatedBy).toBe('/bin/sh -c #(nop) CMD ["nginx"]');
    expect(vm.Size).toBe(2048);
    expect(vm.Comment).toBe('');
    expect(vm.Tags).toEqual(['nginx:latest']);
  });
});
