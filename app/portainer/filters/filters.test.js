import { describe, expect, it } from 'vitest';

import {
  TIME_FORMAT,
  arrayToStr,
  endpointTypeName,
  formatDate,
  getPairKey,
  getPairValue,
  humanize,
  ipAddress,
  isoDate,
  isoDateFromTimestamp,
  labelsToStr,
  parseIsoDate,
  truncate,
  truncateLeftRight,
} from './filters';

describe('portainer.app filters for local Docker UI', () => {
  describe('truncateLeftRight', () => {
    it('returns short text unchanged', () => {
      expect(truncateLeftRight('hello')).toBe('hello');
    });

    it('truncates long text with a middle marker', () => {
      const text = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP';
      expect(truncateLeftRight(text, 20, 5, 5)).toBe('abcde[...]LMNOP');
    });

    it('uses defaults when max left and right are not numbers', () => {
      const text = 'x'.repeat(60);
      const out = truncateLeftRight(text, NaN, NaN, NaN);
      expect(out.startsWith('x'.repeat(25))).toBe(true);
      expect(out).toContain('[...]');
      expect(out.endsWith('x'.repeat(25))).toBe(true);
    });
  });

  describe('humanize', () => {
    it('formats byte sizes', () => {
      expect(humanize(1024)).toMatch(/1(\.0)?\s?KB|1(\.0)?\s?kB/i);
      expect(humanize(0)).toMatch(/0/);
    });

    it('returns undefined for missing bytes', () => {
      expect(humanize(undefined)).toBeUndefined();
    });
  });

  describe('date helpers', () => {
    it('formats unix timestamps and iso dates', () => {
      expect(isoDateFromTimestamp(0)).toMatch(/1970/);
      expect(isoDate('2020-01-02T03:04:05Z')).toMatch(/2020/);
      expect(parseIsoDate('2020-01-02 03:04:05', TIME_FORMAT)).toBeInstanceOf(
        Date
      );
      expect(formatDate('2020-01-02 03:04:05 +0000')).toMatch(/2020/);
    });
  });

  describe('pair helpers', () => {
    it('splits keys and values on a separator', () => {
      expect(getPairKey('FOO=bar', '=')).toBe('FOO');
      expect(getPairValue('FOO=bar', '=')).toBe('bar');
      expect(getPairKey('noseparator', '=')).toBe('noseparator');
      expect(getPairValue('noseparator', '=')).toBe('');
    });
  });

  describe('ipAddress', () => {
    it('strips the CIDR suffix', () => {
      expect(ipAddress('10.0.0.5/24')).toBe('10.0.0.5');
    });
  });

  describe('array and label stringifiers', () => {
    it('joins arrays and labels', () => {
      expect(arrayToStr(['a', 'b'], ',')).toBe('a,b');
      expect(arrayToStr(undefined, ',')).toBe('');
      expect(labelsToStr([{ key: 'a', value: '1' }, { key: 'b', value: '2' }], ';')).toBe(
        'a:1;b:2'
      );
      expect(labelsToStr(undefined, ';')).toBe('');
    });
  });

  describe('endpointTypeName', () => {
    it('names docker and related local environment types', () => {
      expect(endpointTypeName(1)).toBe('Docker');
      expect(endpointTypeName(2)).toBe('Agent');
      expect(endpointTypeName(6)).toBe('Agent');
      expect(endpointTypeName(3)).toBe('Azure ACI');
      expect(endpointTypeName(5)).toBe('Kubernetes');
      expect(endpointTypeName(4)).toBe('Edge Agent');
      expect(endpointTypeName(7)).toBe('Edge Agent');
      expect(endpointTypeName(99)).toBe('');
    });
  });

  describe('truncate', () => {
    it('returns short text unchanged', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('truncates with a custom end marker', () => {
      expect(truncate('abcdefghijklmnop', 8, '..')).toBe('abcdef..');
    });

    it('uses defaults for length and end', () => {
      expect(truncate('abcdefghijklmnop', NaN)).toBe('abcdefg...');
    });
  });
});
