import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { getConsoleConfig, toRequest } from './toRequest';
import { Values } from './types';

function baseValues(overrides: Partial<Values> = {}): Values {
  return {
    cmd: null,
    entrypoint: null,
    user: '',
    workingDir: '',
    console: 'none',
    logConfig: { type: '', options: [] },
    ...overrides,
  };
}

describe('REQ-CTR-03 commands toRequest', () => {
  const oldConfig: CreateContainerRequest = {
    HostConfig: {},
    NetworkingConfig: {},
    Cmd: ['old'],
    Entrypoint: ['old-entry'],
  };

  it('sets command, entrypoint, user, working dir and console flags', () => {
    const result = toRequest(
      oldConfig,
      baseValues({
        cmd: 'nginx -g "daemon off;"',
        entrypoint: '/bin/sh -c',
        user: '1000',
        workingDir: '/app',
        console: 'both',
        logConfig: {
          type: 'json-file',
          options: [{ option: 'max-size', value: '10m' }],
        },
      })
    );

    expect(result.Cmd).toEqual(['nginx', '-g', 'daemon off;']);
    expect(result.Entrypoint).toEqual(['/bin/sh', '-c']);
    expect(result.User).toBe('1000');
    expect(result.WorkingDir).toBe('/app');
    expect(result.OpenStdin).toBe(true);
    expect(result.Tty).toBe(true);
    expect(result.HostConfig.LogConfig).toEqual({
      Type: 'json-file',
      Config: { 'max-size': '10m' },
    });
  });

  it('clears Cmd and Entrypoint when values are null', () => {
    const result = toRequest(oldConfig, baseValues());

    expect(result.Cmd).toBeUndefined();
    expect(result.Entrypoint).toBeUndefined();
  });

  it('omits LogConfig for the default logging driver', () => {
    const result = toRequest(
      {
        ...oldConfig,
        HostConfig: {
          LogConfig: { Type: 'json-file', Config: {} },
        },
      },
      baseValues({ logConfig: { type: '', options: [] } })
    );

    expect(result.HostConfig.LogConfig).toBeUndefined();
  });

  it.each([
    ['both', { OpenStdin: true, Tty: true }],
    ['interactive', { OpenStdin: true, Tty: false }],
    ['tty', { OpenStdin: false, Tty: true }],
    ['none', { OpenStdin: false, Tty: false }],
  ] as const)('maps console %s', (setting, expected) => {
    expect(getConsoleConfig(setting)).toEqual(expected);
  });
});
