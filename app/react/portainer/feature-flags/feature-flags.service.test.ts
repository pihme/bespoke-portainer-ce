import { describe, expect, it } from 'vitest';

import * as service from './feature-flags.service';
import { isBE } from './feature-flags.service';

describe('feature-flags.service for local CE UI', () => {
  it('exposes isBE from PORTAINER_EDITION', () => {
    expect(isBE).toBe(false);
  });

  it('REQ-TAI-018 has no Business Edition feature gate', () => {
    expect(Object.keys(service)).toEqual(['isBE']);
  });
});
