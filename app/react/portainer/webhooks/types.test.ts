import { describe, expect, it } from 'vitest';

import { WebhookType } from './types';

describe('WebhookType', () => {
  it('exposes docker service and container values', () => {
    expect(WebhookType.DockerService).toBe(1);
    expect(WebhookType.DockerContainer).toBe(2);
  });
});
