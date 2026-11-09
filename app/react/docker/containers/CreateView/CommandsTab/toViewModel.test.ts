import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-03 commands toViewModel', () => {
  it('returns defaults when Config is missing', () => {
    expect(toViewModel({})).toEqual(getDefaultViewModel());
  });

  it('maps command, entrypoint, console and log config', () => {
    const config: ContainerDetailsJSON = {
      Config: {
        Cmd: ['nginx', '-g', 'daemon off;'],
        Entrypoint: ['/bin/sh', '-c'],
        User: 'root',
        WorkingDir: '/srv',
        OpenStdin: true,
        Tty: false,
      },
      HostConfig: {
        LogConfig: {
          Type: 'json-file',
          Config: { 'max-file': '3' },
        },
      },
    };

    expect(toViewModel(config)).toEqual({
      cmd: "'nginx' '-g' 'daemon off;'",
      entrypoint: "'/bin/sh' '-c'",
      user: 'root',
      workingDir: '/srv',
      console: 'interactive',
      logConfig: {
        type: 'json-file',
        options: [{ option: 'max-file', value: '3' }],
      },
    });
  });

  it('maps tty-only and both console modes and empty log config', () => {
    expect(
      toViewModel({
        Config: { OpenStdin: false, Tty: true },
        HostConfig: { LogConfig: { Type: '', Config: {} } },
      }).console
    ).toBe('tty');

    expect(
      toViewModel({
        Config: { OpenStdin: true, Tty: true },
      }).console
    ).toBe('both');

    expect(
      toViewModel({
        Config: { OpenStdin: false, Tty: false },
        HostConfig: {},
      }).logConfig
    ).toEqual({ type: '', options: [] });
  });
});
