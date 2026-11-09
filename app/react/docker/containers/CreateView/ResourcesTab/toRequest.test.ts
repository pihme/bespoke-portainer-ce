import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { Values } from './ResourcesTab';
import { toRequest } from './toRequest';

describe('REQ-CTR-03 resources toRequest', () => {
  const oldConfig: CreateContainerRequest = {
    HostConfig: { DeviceRequests: [] },
    NetworkingConfig: {},
  };

  const values: Values = {
    runtime: { privileged: true, init: true, type: 'runc' },
    devices: [{ pathOnHost: '/dev/null', pathInContainer: '/dev/null' }],
    sysctls: [{ name: 'net.ipv4.ip_forward', value: '1' }],
    securityOpt: ['no-new-privileges'],
    sharedMemorySize: 64,
    gpu: {
      enabled: false,
      useSpecific: false,
      selectedGPUs: ['all'],
      capabilities: ['compute', 'utility'],
    },
    resources: { reservation: 128, limit: 256, cpu: 1 },
  };

  it('maps runtime, devices, sysctls, security and memory limits', () => {
    const result = toRequest(oldConfig, values);

    expect(result.HostConfig.Privileged).toBe(true);
    expect(result.HostConfig.Init).toBe(true);
    expect(result.HostConfig.Runtime).toBe('runc');
    expect(result.HostConfig.Devices).toEqual([
      {
        PathOnHost: '/dev/null',
        PathInContainer: '/dev/null',
        CgroupPermissions: 'rwm',
      },
    ]);
    expect(result.HostConfig.Sysctls).toEqual({
      'net.ipv4.ip_forward': '1',
    });
    expect(result.HostConfig.SecurityOpt).toEqual(['no-new-privileges']);
    expect(result.HostConfig.ShmSize).toBe(64 * 1024 * 1024);
    expect(result.HostConfig.MemoryReservation).toBe(128 * 1024 * 1024);
    expect(result.HostConfig.Memory).toBe(256 * 1024 * 1024);
    expect(result.HostConfig.NanoCpus).toBe(1_000_000_000);
    expect(result.HostConfig.DeviceRequests).toEqual([]);
  });
});
