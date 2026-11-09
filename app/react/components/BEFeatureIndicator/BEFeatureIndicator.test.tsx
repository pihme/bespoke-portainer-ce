import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isLimitedToBE: vi.fn(),
}));

import { isLimitedToBE } from '@/react/portainer/feature-flags/feature-flags.service';

import { BEFeatureIndicator } from './BEFeatureIndicator';
import { getFeatureDetails } from './utils';

describe('getFeatureDetails', () => {
  beforeEach(() => {
    vi.mocked(isLimitedToBE).mockReset();
  });

  it('returns an empty object when no feature id is given', () => {
    expect(getFeatureDetails()).toEqual({});
  });

  it('builds an upsell URL and limited flag for a feature id', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(true);
    expect(getFeatureDetails(FeatureId.STACK_WEBHOOK)).toEqual({
      url: `https://www.portainer.io/business-upsell?from=${FeatureId.STACK_WEBHOOK}`,
      limitedToBE: true,
    });
  });

  it('reports limitedToBE false when the feature is available on CE', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(false);
    expect(getFeatureDetails(FeatureId.STACK_WEBHOOK).limitedToBE).toBe(false);
  });
});

describe('BEFeatureIndicator CE-facing behavior', () => {
  beforeEach(() => {
    vi.mocked(isLimitedToBE).mockReset();
  });

  it('hides the business badge when the feature is available on CE', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(false);
    const children = vi.fn(() => <span>body</span>);

    render(
      <BEFeatureIndicator featureId={FeatureId.STACK_WEBHOOK}>
        {children}
      </BEFeatureIndicator>
    );

    expect(screen.queryByText('Business Feature')).not.toBeInTheDocument();
    expect(children).toHaveBeenCalledWith(false);
    expect(screen.getByText('body')).toBeVisible();
  });

  it('shows the business badge link when the feature is limited to BE', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(true);

    render(
      <BEFeatureIndicator
        featureId={FeatureId.STACK_WEBHOOK}
        className="extra"
      />
    );

    const link = screen.getByRole('link', { name: /Business Feature/i });
    expect(link).toHaveAttribute(
      'href',
      `https://www.portainer.io/business-upsell?from=${FeatureId.STACK_WEBHOOK}`
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('can hide the briefcase icon while still showing the label', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(true);

    render(
      <BEFeatureIndicator
        featureId={FeatureId.STACK_WEBHOOK}
        showIcon={false}
      />
    );

    expect(screen.getByText('Business Feature')).toBeVisible();
    expect(document.querySelector('.be-indicator-icon')).toBeNull();
  });
});
