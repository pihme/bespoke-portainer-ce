import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { dockerImagesHandlers } from './images';

const server = setupServer(...dockerImagesHandlers);

describe('dockerImagesHandlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns empty image lists for docker and legacy endpoint routes', async () => {
    const dockerImages = await fetch('/api/docker/1/images');
    expect(dockerImages.ok).toBe(true);
    await expect(dockerImages.json()).resolves.toEqual([]);

    const legacy = await fetch('/api/endpoints/1/docker/images/json');
    expect(legacy.ok).toBe(true);
    await expect(legacy.json()).resolves.toEqual([]);
  });
});
