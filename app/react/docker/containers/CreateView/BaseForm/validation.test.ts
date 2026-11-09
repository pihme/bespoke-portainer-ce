import { describe, expect, it } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import { validation } from './validation';

const validBase = {
  name: 'web',
  alwaysPull: true,
  accessControl: {
    ownership: ResourceControlOwnership.ADMINISTRATORS,
    authorizedUsers: [],
    authorizedTeams: [],
  },
  autoRemove: false,
  enableWebhook: false,
  nodeName: '',
  ports: [{ containerPort: '80', hostPort: '8080', protocol: 'tcp' as const }],
  publishAllPorts: false,
  image: { image: 'nginx', registryId: 0, useRegistry: true },
};

describe('REQ-CTR-03 BaseForm validation for create form', () => {
  it('accepts a valid local create payload', async () => {
    const schema = validation();
    await expect(schema.validate(validBase)).resolves.toMatchObject({
      name: 'web',
      image: { image: 'nginx' },
    });
  });

  it('rejects pull when Docker Hub is rate limited', async () => {
    const schema = validation({
      isAdmin: false,
      isDuplicating: false,
      isDuplicatingPortainer: false,
      isDockerhubRateLimited: true,
    });

    await expect(
      schema.validate({ ...validBase, alwaysPull: true })
    ).rejects.toThrow(/Rate limit exceeded/);
  });

  it('allows duplicating when a registry id is present', async () => {
    const schema = validation({
      isAdmin: false,
      isDuplicating: true,
      isDuplicatingPortainer: false,
      isDockerhubRateLimited: false,
    });

    await expect(
      schema.validate({
        ...validBase,
        image: { image: 'nginx', registryId: 3, useRegistry: true },
      })
    ).resolves.toMatchObject({
      image: { registryId: 3 },
    });
  });

  it('rejects duplicating the Portainer container', async () => {
    const schema = validation({
      isAdmin: false,
      isDuplicating: true,
      isDuplicatingPortainer: true,
      isDockerhubRateLimited: false,
    });

    await expect(schema.validate(validBase)).rejects.toThrow();
  });
});
