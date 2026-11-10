import { describe, it, expect } from 'vitest';

import {
  buildImageFullURI,
  buildImageFullURIFromModel,
  fullURIIntoRepoAndTag,
  getUniqueTagListFromImages,
  imageContainsURL,
  parseViewModel,
} from './utils';

describe('fullURIIntoRepoAndTag', () => {
  it('splits registry/image-repo:tag correctly', () => {
    const result = fullURIIntoRepoAndTag('registry.example.com/my-image:v1.0');
    expect(result).toEqual({
      repo: 'registry.example.com/my-image',
      tag: 'v1.0',
    });
  });

  it('splits image-repo:tag correctly', () => {
    const result = fullURIIntoRepoAndTag('nginx:latest');
    expect(result).toEqual({ repo: 'nginx', tag: 'latest' });
  });

  it('splits image-repo:port/image correctly', () => {
    const result = fullURIIntoRepoAndTag('registry.example.com:5000/my-image');
    expect(result).toEqual({
      repo: 'registry.example.com:5000/my-image',
      tag: 'latest',
    });
  });

  it('splits image-repo:port/image:tag correctly', () => {
    const result = fullURIIntoRepoAndTag(
      'registry.example.com:5000/my-image:v1'
    );
    expect(result).toEqual({
      repo: 'registry.example.com:5000/my-image',
      tag: 'v1',
    });
  });

  it('splits registry:port/image-repo:tag correctly', () => {
    const result = fullURIIntoRepoAndTag(
      'registry.example.com:5000/my-image:v2.1'
    );
    expect(result).toEqual({
      repo: 'registry.example.com:5000/my-image',
      tag: 'v2.1',
    });
  });

  it('handles empty string input', () => {
    const result = fullURIIntoRepoAndTag('');
    expect(result).toEqual({ repo: '', tag: 'latest' });
  });

  it('handles input with multiple colons', () => {
    const result = fullURIIntoRepoAndTag('registry:5000/namespace/image:v1.0');
    expect(result).toEqual({
      repo: 'registry:5000/namespace/image',
      tag: 'v1.0',
    });
  });

  it('handles input with @ symbol (digest)', () => {
    const result = fullURIIntoRepoAndTag(
      'myregistry.azurecr.io/image@sha256:123456'
    );
    expect(result).toEqual({
      repo: 'myregistry.azurecr.io/image@sha256',
      tag: '123456',
    });
  });
});

describe('parseViewModel and tag helpers', () => {
  it('parses responses and falls back to digests', () => {
    expect(
      parseViewModel({
        Id: 'sha256:1',
        RepoTags: ['nginx:latest'],
        RepoDigests: [],
      } as never)
    ).toMatchObject({ Used: false, RepoTags: ['nginx:latest'] });

    expect(
      parseViewModel({
        Id: 'sha256:2',
        RepoTags: undefined,
        RepoDigests: ['repo@sha256:abc'],
      } as never).RepoTags[0]
    ).toContain(':<none>');
  });

  it('lists unique tags and detects URL-like image names', () => {
    expect(
      getUniqueTagListFromImages([
        { RepoTags: ['nginx:latest', 'nginx:<none>'] },
        { RepoTags: ['nginx:latest', 'redis:alpine'] },
        {},
      ])
    ).toEqual(['nginx:latest', 'redis:alpine']);

    expect(imageContainsURL('ghcr.io/org/app')).toBe(true);
    expect(imageContainsURL('localhost:5000/app')).toBe(true);
    expect(imageContainsURL('nginx')).toBe(false);
  });

  it('REQ-TAI-005 builds full URIs from the image name only', () => {
    expect(buildImageFullURI('nginx')).toBe('nginx:latest');
    expect(buildImageFullURI('nginx:1.25')).toBe('nginx:1.25');
    expect(() => buildImageFullURI('')).toThrow(/Missing image/);

    expect(buildImageFullURIFromModel({ Image: 'redis' })).toBe('redis:latest');
    expect(buildImageFullURI('registry.local/app')).toBe(
      'registry.local/app:latest'
    );
    expect(buildImageFullURI('registry.local:5000/app:2')).toBe(
      'registry.local:5000/app:2'
    );
  });
});
