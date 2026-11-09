import { describe, it, expect, vi, beforeEach } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./imageHelper.js');

function imageHelper() {
  return factoryState.factory();
}

describe('REQ-IMG-02 ImageHelper tag and image config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isValidTag accepts alphanumerics, underscore, dot and dash after the first char', () => {
    const helper = imageHelper();
    expect(helper.isValidTag('latest')).toBeTruthy();
    expect(helper.isValidTag('1.2.3-rc_1')).toBeTruthy();
  });

  it('isValidTag rejects tags that start with a dot or dash', () => {
    const helper = imageHelper();
    expect(helper.isValidTag('.bad')).toBeFalsy();
    expect(helper.isValidTag('-bad')).toBeFalsy();
  });

  it('createImageConfigForContainer builds fromImage, repo and tag without a registry', () => {
    const helper = imageHelper();
    expect(
      helper.createImageConfigForContainer({ UseRegistry: false, Image: 'nginx' })
    ).toEqual({
      fromImage: 'nginx:latest',
      tag: 'latest',
      repo: 'nginx',
    });
  });

  it('createImageConfigForContainer keeps an explicit tag', () => {
    const helper = imageHelper();
    const cfg = helper.createImageConfigForContainer({
      UseRegistry: false,
      Image: 'library/nginx:1.25',
    });
    expect(cfg.fromImage).toBe('library/nginx:1.25');
    expect(cfg.tag).toBe('1.25');
    expect(cfg.repo).toBe('library/nginx');
  });

  it('removeDigestFromRepository strips an @sha… digest suffix', () => {
    const helper = imageHelper();
    expect(helper.removeDigestFromRepository('nginx@sha256:abc')).toBe('nginx');
    expect(helper.removeDigestFromRepository('nginx:latest')).toBe('nginx:latest');
  });

  it('imageContainsURL detects a registry host in the image reference', () => {
    const helper = imageHelper();
    expect(helper.imageContainsURL('ghcr.io/org/app:1')).toBe(true);
    expect(helper.imageContainsURL('nginx')).toBe(false);
  });
});
