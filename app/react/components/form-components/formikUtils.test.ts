import { describe, expect, it } from 'vitest';

import { isArrayErrorType, isErrorType } from './formikUtils';

describe('formikUtils', () => {
  describe('isErrorType', () => {
    it('returns false for undefined or string', () => {
      expect(isErrorType(undefined)).toBe(false);
      expect(isErrorType('bad')).toBe(false);
    });

    it('returns true for an object error', () => {
      expect(isErrorType({ name: 'required' })).toBe(true);
    });
  });

  describe('isArrayErrorType', () => {
    it('returns false for undefined or string', () => {
      expect(isArrayErrorType(undefined)).toBe(false);
      expect(isArrayErrorType('bad')).toBe(false);
    });

    it('returns true for array errors', () => {
      expect(isArrayErrorType([{ name: 'required' }])).toBe(true);
      expect(isArrayErrorType(['a', 'b'])).toBe(true);
    });
  });
});
