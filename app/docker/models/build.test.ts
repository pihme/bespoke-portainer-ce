import { describe, it, expect } from 'vitest';

import { ImageBuildModel } from './build';

describe('REQ-IMG-03 ImageBuildModel', () => {
  it('collects stream lines and strips ANSI escape sequences from build logs', () => {
    const vm = new ImageBuildModel([
      { stream: 'Step 1/2 : FROM alpine\n', errorDetail: undefined as never },
      {
        stream: '\u001b[31mERROR\u001b[0m colored\n',
        errorDetail: undefined as never,
      },
    ]);

    expect(vm.hasError).toBe(false);
    expect(vm.buildLogs).toEqual([
      'Step 1/2 : FROM alpine\n',
      'ERROR colored\n',
    ]);
  });

  it('records errorDetail messages and marks the build as failed', () => {
    const vm = new ImageBuildModel([
      { stream: 'Step 1/1 : FROM missing\n', errorDetail: undefined as never },
      {
        stream: '',
        errorDetail: { message: 'pull access denied for missing' },
      },
    ]);

    expect(vm.hasError).toBe(true);
    expect(vm.buildLogs).toEqual([
      'Step 1/1 : FROM missing\n',
      'pull access denied for missing',
    ]);
  });

  it('skips empty stream lines without errorDetail', () => {
    const vm = new ImageBuildModel([
      { stream: '', errorDetail: undefined as never },
      { stream: 'done\n', errorDetail: undefined as never },
    ]);

    expect(vm.hasError).toBe(false);
    expect(vm.buildLogs).toEqual(['done\n']);
  });
});
