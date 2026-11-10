import { describe, expect, it } from 'vitest';

import * as constants from './constants';
import {
  API_ENDPOINT_AUTH,
  API_ENDPOINT_ENDPOINTS,
  API_ENDPOINT_STACKS,
  PAGINATION_MAX_ITEMS,
  PREDEFINED_NETWORKS,
  STACK_NAME_VALIDATION_REGEX,
} from './constants';

describe('app constants', () => {
  it('exposes Portainer API endpoint prefixes and shared limits', () => {
    expect(API_ENDPOINT_AUTH).toBe('api/auth');
    expect(API_ENDPOINT_ENDPOINTS).toBe('api/endpoints');
    expect(API_ENDPOINT_STACKS).toBe('api/stacks');
    expect(PAGINATION_MAX_ITEMS).toBe(10);
    expect(PREDEFINED_NETWORKS).toEqual(
      expect.arrayContaining(['bridge', 'host', 'none'])
    );
    expect(new RegExp(STACK_NAME_VALIDATION_REGEX).test('my-stack_1')).toBe(
      true
    );
    expect(new RegExp(STACK_NAME_VALIDATION_REGEX).test('Bad Stack')).toBe(
      false
    );
  });

  it('REQ-TAI-013 exposes no environment group or tag API prefix', () => {
    expect(constants).not.toHaveProperty('API_ENDPOINT_ENDPOINT_GROUPS');
    expect(constants).not.toHaveProperty('API_ENDPOINT_TAGS');
  });

  it('REQ-TAI-014 exposes no container webhook API prefix', () => {
    expect(constants).not.toHaveProperty('API_ENDPOINT_WEBHOOKS');
  });
});
