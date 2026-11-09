import { describe, it, expect } from 'vitest';

import { commandArrayToString, commandStringToArray } from './containers';

describe('REQ-CTR-03 containers command helpers', () => {
  it('commandStringToArray splits a shell-style command into argv', () => {
    expect(commandStringToArray('nginx -g "daemon off;"')).toEqual([
      'nginx',
      '-g',
      'daemon off;',
    ]);
  });

  it('commandArrayToString quotes each argv element', () => {
    expect(commandArrayToString(['/bin/sh', '-c', 'echo hi'])).toBe(
      "'/bin/sh' '-c' 'echo hi'"
    );
  });

  it('round-trips a simple argv through string and back', () => {
    const argv = ['echo', 'hello'];
    expect(commandStringToArray(commandArrayToString(argv).replace(/'/g, ''))).toEqual(
      argv
    );
  });
});
