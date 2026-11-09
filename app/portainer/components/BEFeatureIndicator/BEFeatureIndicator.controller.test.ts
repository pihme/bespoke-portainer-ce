import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

const getFeatureDetails = vi.fn();

vi.mock('@@/BEFeatureIndicator/utils', () => ({
  getFeatureDetails: (...args: unknown[]) => getFeatureDetails(...args),
}));

import BeIndicatorController from './BEFeatureIndicator.controller';

describe('BeIndicatorController CE-facing behavior', () => {
  beforeEach(() => {
    getFeatureDetails.mockReset();
  });

  it('initializes with CE defaults before $onInit', () => {
    const ctrl = new BeIndicatorController();
    expect(ctrl.limitedToBE).toBe(false);
    expect(ctrl.url).toBe('');
  });

  it('keeps limitedToBE false for CE-available features', () => {
    getFeatureDetails.mockReturnValue({ url: '', limitedToBE: false });
    const ctrl = new BeIndicatorController();
    ctrl.feature = FeatureId.FORCE_REDEPLOYMENT;
    ctrl.$onInit();
    expect(getFeatureDetails).toHaveBeenCalledWith(
      FeatureId.FORCE_REDEPLOYMENT
    );
    expect(ctrl.limitedToBE).toBe(false);
    expect(ctrl.url).toBe('');
  });

  it('records BE-limited flag without asserting upsell UI internals', () => {
    // deferred-within-package: BE-only advertising URL/upsell chrome
    getFeatureDetails.mockReturnValue({
      url: 'https://www.portainer.io/business-upsell',
      limitedToBE: true,
    });
    const ctrl = new BeIndicatorController();
    ctrl.feature = FeatureId.STACK_PULL_IMAGE;
    ctrl.$onInit();
    expect(ctrl.limitedToBE).toBe(true);
    expect(ctrl.url).toContain('portainer.io');
  });
});
