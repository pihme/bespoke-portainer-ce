import { beforeEach, describe, expect, it } from 'vitest';

import { Edition, FeatureId, FeatureState } from './enums';
import {
  init,
  isBE,
  isLimitedToBE,
  selectShow,
} from './feature-flags.service';

describe('feature-flags.service for local CE UI', () => {
  beforeEach(async () => {
    await init(Edition.CE);
  });

  it('exposes isBE from PORTAINER_EDITION', () => {
    expect(isBE).toBe(false);
  });

  it('selectShow is visible when no feature id is given', () => {
    expect(selectShow()).toBe(FeatureState.VISIBLE);
    expect(selectShow(undefined)).toBe(FeatureState.VISIBLE);
  });

  it('selectShow hides unknown feature ids', () => {
    expect(selectShow('not-a-real-feature' as FeatureId)).toBe(
      FeatureState.HIDDEN
    );
  });

  it('selectShow marks BE-only features as LIMITED_BE under CE', () => {
    expect(selectShow(FeatureId.CONTAINER_WEBHOOK)).toBe(
      FeatureState.LIMITED_BE
    );
    expect(isLimitedToBE(FeatureId.CONTAINER_WEBHOOK)).toBe(true);
    expect(isLimitedToBE()).toBe(false);
  });

  it('selectShow makes features visible when current edition is BE', async () => {
    await init(Edition.BE);
    expect(selectShow(FeatureId.CONTAINER_WEBHOOK)).toBe(FeatureState.VISIBLE);
    expect(isLimitedToBE(FeatureId.CONTAINER_WEBHOOK)).toBe(false);
  });
});
