import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('axios', () => {
  const create = vi.fn(() => ({ get: getMock }));
  return { default: { create }, create };
});

vi.mock('axios-cache-interceptor', () => ({
  setupCache: vi.fn(),
  buildMemoryStorage: vi.fn(() => ({})),
}));

vi.mock('@/react/docker/proxy/queries/buildDockerProxyUrl', () => ({
  buildDockerProxyUrl: (id: number, action: string) => `endpoints/${id}/docker/${action}`,
}));

const { dockerMaxAPIVersionInterceptor } = await import('./dockerMaxApiVersionInterceptor');
const { MAX_DOCKER_API_VERSION } = await import('./dockerMaxApiVersion');

describe('dockerMaxAPIVersionInterceptor (backwards compatibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rewrites docker URLs when the environment API version exceeds the max', async () => {
    getMock.mockResolvedValue({ data: { ApiVersion: '1.49' } });
    const config = { url: 'endpoints/7/docker/containers/json' } as any;
    const out = await dockerMaxAPIVersionInterceptor(config);
    expect(out.url).toBe(`endpoints/7/docker/v${MAX_DOCKER_API_VERSION}/containers/json`);
  });

  it('leaves the URL unchanged when the API version is within the max', async () => {
    getMock.mockResolvedValue({ data: { ApiVersion: '1.41' } });
    const config = { url: 'endpoints/7/docker/containers/json' } as any;
    const out = await dockerMaxAPIVersionInterceptor(config);
    expect(out.url).toBe('endpoints/7/docker/containers/json');
  });

  it('passes through non-docker URLs and NaN environment ids', async () => {
    const plain = { url: 'endpoints/1/kubernetes/api' } as any;
    await expect(dockerMaxAPIVersionInterceptor(plain)).resolves.toBe(plain);
    const bad = { url: 'endpoints/abc/docker/version' } as any;
    await expect(dockerMaxAPIVersionInterceptor(bad)).resolves.toBe(bad);
  });

  it('returns the original config when the version lookup fails', async () => {
    getMock.mockRejectedValue(new Error('down'));
    const config = { url: 'endpoints/7/docker/containers/json' } as any;
    await expect(dockerMaxAPIVersionInterceptor(config)).resolves.toBe(config);
  });
});
