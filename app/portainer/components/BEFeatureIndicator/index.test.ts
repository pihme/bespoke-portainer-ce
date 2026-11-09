import { describe, expect, it, vi } from 'vitest';

vi.mock('./BEFeatureIndicator.controller', () => ({
  default: class {},
}));

import { beFeatureIndicator } from './index';

describe('beFeatureIndicator component options', () => {
  it('exposes CE component wiring with feature binding and transclusion', () => {
    expect(beFeatureIndicator.templateUrl).toBe('./BEFeatureIndicator.html');
    expect(beFeatureIndicator.bindings).toEqual({ feature: '<' });
    expect(beFeatureIndicator.transclude).toBe(true);
    expect(beFeatureIndicator.controller).toBeTruthy();
  });
});
