import { describe, expect, it } from 'vitest';

import { autoUpdateValidation } from './validation';

describe('autoUpdateValidation', () => {
  it('accepts default auto-update values', async () => {
    await expect(autoUpdateValidation().validate({})).resolves.toMatchObject({
      RepositoryAutomaticUpdates: false,
      RepositoryAutomaticUpdatesForce: false,
      ForcePullImage: false,
    });
  });

  it('accepts enabled webhook values', async () => {
    await expect(
      autoUpdateValidation().validate({
        RepositoryAutomaticUpdates: true,
        RepositoryAutomaticUpdatesForce: true,
        ForcePullImage: true,
        RepositoryWebhookId: 'id-1',
      })
    ).resolves.toMatchObject({
      RepositoryAutomaticUpdates: true,
      RepositoryAutomaticUpdatesForce: true,
      ForcePullImage: true,
      RepositoryWebhookId: 'id-1',
    });
  });
});
