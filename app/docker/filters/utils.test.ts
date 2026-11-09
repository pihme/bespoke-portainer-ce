import { describe, expect, it } from 'vitest';

import {
  hideShaSum,
  joinCommand,
  trimContainerName,
  trimSHA,
  trimVersionTag,
} from './utils';

describe('REQ-CTR-01 local Docker list filter utils', () => {
  describe('trimVersionTag', () => {
    it('returns empty or falsy names unchanged', () => {
      expect(trimVersionTag('')).toBe('');
      expect(trimVersionTag(undefined as unknown as string)).toBeUndefined();
    });

    it('returns a name without a tag unchanged', () => {
      expect(trimVersionTag('nginx')).toBe('nginx');
      expect(trimVersionTag('library/nginx')).toBe('library/nginx');
    });

    it('strips the last :tag when it is not a host port', () => {
      expect(trimVersionTag('nginx:1.25')).toBe('nginx');
      expect(trimVersionTag('library/nginx:latest')).toBe('library/nginx');
    });

    it('keeps a registry host:port path that looks like a tag position', () => {
      // hostIdx (after host:port/) is after the colon in host:port
      expect(trimVersionTag('localhost:5000/nginx')).toBe('localhost:5000/nginx');
    });
  });

  describe('trimSHA', () => {
    it('returns empty string for falsy input', () => {
      expect(trimSHA('')).toBe('');
      expect(trimSHA(undefined as unknown as string)).toBe('');
    });

    it('shortens a leading sha256: digest to twelve hex chars', () => {
      expect(trimSHA('sha256:0123456789abcdef0123456789abcdef')).toBe(
        '0123456789ab'
      );
    });

    it('strips an @sha256 digest suffix from a tagged image', () => {
      expect(trimSHA('nginx@sha256:deadbeef')).toBe('nginx');
      expect(trimSHA('nginx:latest')).toBe('nginx:latest');
    });
  });

  describe('joinCommand', () => {
    it('joins argv with spaces', () => {
      expect(joinCommand(['nginx', '-g', 'daemon off;'])).toBe(
        'nginx -g daemon off;'
      );
    });

    it('returns empty string for null or undefined command', () => {
      expect(joinCommand(null)).toBe('');
      expect(joinCommand(undefined)).toBe('');
    });

    it('returns empty string for an empty argv', () => {
      expect(joinCommand([])).toBe('');
    });
  });

  describe('hideShaSum', () => {
    it('strips an @sha… digest suffix', () => {
      expect(hideShaSum('nginx@sha256:abc')).toBe('nginx');
      expect(hideShaSum('nginx:latest')).toBe('nginx:latest');
    });

    it('defaults to empty string', () => {
      expect(hideShaSum()).toBe('');
    });
  });

  describe('trimContainerName', () => {
    it('strips a leading slash from Docker Names entries', () => {
      expect(trimContainerName('/web')).toBe('web');
    });

    it('returns a name without a leading slash unchanged', () => {
      expect(trimContainerName('web')).toBe('web');
    });

    it('returns empty string for missing names', () => {
      expect(trimContainerName(undefined)).toBe('');
      expect(trimContainerName('')).toBe('');
    });
  });
});
