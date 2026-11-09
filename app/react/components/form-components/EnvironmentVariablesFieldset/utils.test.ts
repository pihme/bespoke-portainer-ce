import { describe, expect, it } from 'vitest';

import {
  convertToArrayOfStrings,
  parseArrayOfStrings,
  parseDotEnvFile,
} from './utils';

describe('EnvironmentVariablesFieldset utils', () => {
  it('parseDotEnvFile skips blanks and comments', () => {
    expect(
      parseDotEnvFile('# comment\n\nFOO=bar\nBAZ=\nONLY\n')
    ).toEqual([
      { name: 'FOO', value: 'bar', needsDeletion: false },
      { name: 'BAZ', value: '', needsDeletion: false },
      { name: 'ONLY' },
    ]);
  });

  it('parseArrayOfStrings handles empty and name-only entries', () => {
    expect(parseArrayOfStrings()).toEqual([]);
    expect(parseArrayOfStrings(['NOEQ', 'A=1'])).toEqual([
      { name: 'NOEQ' },
      { name: 'A', value: '1', needsDeletion: false },
    ]);
  });


  it('covers empty-array and non-matching parse edges', () => {
    expect(parseArrayOfStrings(null as unknown as string[])).toEqual([]);
    // force null match path via malformed "=" only content that fails KEY_VALUE_REGEX length
    expect(parseArrayOfStrings(['='])).toEqual([]);
    expect(convertToArrayOfStrings(null as unknown as [])).toEqual([]);
  });

  it('convertToArrayOfStrings drops empty names and formats values', () => {
    expect(convertToArrayOfStrings([])).toEqual([]);
    expect(
      convertToArrayOfStrings([
        { name: '', value: 'x' },
        { name: 'A', value: '1' },
        { name: 'B', value: '' },
        { name: 'C' },
      ])
    ).toEqual(['A=1', 'B=', 'C']);
  });
});
