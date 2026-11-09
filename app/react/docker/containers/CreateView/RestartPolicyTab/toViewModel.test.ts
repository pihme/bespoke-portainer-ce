import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';
import { RestartPolicy } from './types';

describe('REQ-CTR-03 restart policy toViewModel', () => {
  it.each([
    ['always', RestartPolicy.Always],
    ['on-failure', RestartPolicy.OnFailure],
    ['unless-stopped', RestartPolicy.UnlessStopped],
    ['no', RestartPolicy.No],
    [undefined, RestartPolicy.No],
    ['other', RestartPolicy.No],
  ] as const)('maps %s to %s', (name, expected) => {
    const config: ContainerDetailsJSON = {
      HostConfig: {
        RestartPolicy: name === undefined ? undefined : { Name: name },
      },
    };

    expect(toViewModel(config)).toBe(expected);
  });

  it('defaults to no restart', () => {
    expect(getDefaultViewModel()).toBe(RestartPolicy.No);
  });
});
