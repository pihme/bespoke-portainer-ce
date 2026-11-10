import { describe, expect, it } from 'vitest';

import * as mappers from './mappers';
import { toStatusObject } from './mappers';

describe('workflow query mappers', () => {
  it('maps missing status phases to unknown', () => {
    expect(toStatusObject(undefined)).toEqual({
      artifact: { status: 'unknown', error: undefined },
      source: { status: 'unknown', error: undefined },
      target: { status: 'unknown', error: undefined },
    });
  });

  it('REQ-TAI-019 has no workflow mapper for the removed workflows view', () => {
    expect(mappers).not.toHaveProperty('toWorkflow');
  });
});
