import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { toRequest } from './toRequest';
import { RestartPolicy } from './types';

describe('REQ-CTR-03 restart policy toRequest', () => {
  it('sets the restart policy name on HostConfig', () => {
    const config: CreateContainerRequest = {
      HostConfig: { RestartPolicy: { Name: 'no', MaximumRetryCount: 0 } },
      NetworkingConfig: {},
    };

    const result = toRequest(config, RestartPolicy.UnlessStopped);

    expect(result.HostConfig.RestartPolicy).toEqual({
      Name: RestartPolicy.UnlessStopped,
      MaximumRetryCount: 0,
    });
  });
});
