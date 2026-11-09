import { describe, expect, it } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

import { buildOption } from './utils';

describe('buildOption', () => {
  it('builds a box selector option without a feature gate', () => {
    expect(buildOption('docker', 'box', 'Docker', 'Local engine', 'docker')).toEqual({
      id: 'docker',
      icon: 'box',
      label: 'Docker',
      description: 'Local engine',
      value: 'docker',
      feature: undefined,
    });
  });

  it('attaches an optional feature id', () => {
    expect(
      buildOption('be', 'box', 'BE', 'upsell', 1, FeatureId.STACK_PULL_IMAGE)
    ).toMatchObject({ feature: FeatureId.STACK_PULL_IMAGE, value: 1 });
  });
});
