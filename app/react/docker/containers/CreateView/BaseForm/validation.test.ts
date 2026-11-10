import { describe, expect, it } from 'vitest';

import { validation } from './validation';

const validBase = {
  name: 'web',
  alwaysPull: true,
  autoRemove: false,
  enableWebhook: false,
  nodeName: '',
  ports: [{ containerPort: '80', hostPort: '8080', protocol: 'tcp' as const }],
  publishAllPorts: false,
  image: { image: 'nginx' },
};

describe('REQ-CTR-03 BaseForm validation for create form', () => {
  it('accepts a valid local create payload', async () => {
    const schema = validation();
    await expect(schema.validate(validBase)).resolves.toMatchObject({
      name: 'web',
      image: { image: 'nginx' },
    });
  });

  it('REQ-TAI-005 has no Docker Hub rate limit check on always-pull', async () => {
    const schema = validation({
      isDuplicating: false,
      isDuplicatingPortainer: false,
    });

    await expect(
      schema.validate({ ...validBase, alwaysPull: true })
    ).resolves.toMatchObject({ alwaysPull: true });
  });

  it('REQ-TAI-005 allows duplicating by image name without a registry', async () => {
    const schema = validation({
      isDuplicating: true,
      isDuplicatingPortainer: false,
    });

    await expect(
      schema.validate({ ...validBase, image: { image: 'nginx:1.25' } })
    ).resolves.toMatchObject({ image: { image: 'nginx:1.25' } });
  });

  it('rejects duplicating the Portainer container', async () => {
    const schema = validation({
      isDuplicating: true,
      isDuplicatingPortainer: true,
    });

    await expect(schema.validate(validBase)).rejects.toThrow();
  });
});
