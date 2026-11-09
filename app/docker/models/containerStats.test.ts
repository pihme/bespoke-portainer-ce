import { describe, it, expect } from 'vitest';

import { ContainerStatsViewModel } from './containerStats';

describe('REQ-CTR-11 ContainerStatsViewModel', () => {
  it('extracts CPU fields correctly from Linux cgroups v2 stats', () => {
    const vm = new ContainerStatsViewModel({
      read: '2024-01-01T00:00:01Z',
      preread: '2024-01-01T00:00:00Z',
      cpu_stats: {
        cpu_usage: { total_usage: 709734856000 },
        system_cpu_usage: 16006861690000000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 709734581000 },
        system_cpu_usage: 16006857740000000,
      },
      memory_stats: { usage: 0 },
    });

    expect(vm.CurrentCPUTotalUsage).toBe(709734856000);
    expect(vm.PreviousCPUTotalUsage).toBe(709734581000);
    expect(vm.CurrentCPUSystemUsage).toBe(16006861690000000);
    expect(vm.PreviousCPUSystemUsage).toBe(16006857740000000);
    expect(vm.CPUCores).toBe(4);
    expect(vm.isWindows).toBe(false);
    expect(vm.noIOdata).toBe(true);
  });

  it('prefers percpu_usage length over online_cpus for CPUCores', () => {
    const vm = new ContainerStatsViewModel({
      read: '2024-01-01T00:00:01Z',
      preread: '2024-01-01T00:00:00Z',
      cpu_stats: {
        cpu_usage: {
          total_usage: 2000000,
          percpu_usage: [1000000, 1000000],
        },
        system_cpu_usage: 100000000,
        online_cpus: 8,
      },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
      memory_stats: { usage: 0 },
    });

    expect(vm.CPUCores).toBe(2);
  });

  it('falls back to 1 for CPUCores when percpu_usage and online_cpus are absent', () => {
    const vm = new ContainerStatsViewModel({
      read: '2024-01-01T00:00:01Z',
      preread: '2024-01-01T00:00:00Z',
      cpu_stats: {
        cpu_usage: { total_usage: 1000 },
        system_cpu_usage: 10000,
      },
      precpu_stats: { cpu_usage: { total_usage: 500 }, system_cpu_usage: 9000 },
      memory_stats: { usage: 0 },
    });

    expect(vm.CPUCores).toBe(1);
  });

  it('uses privateworkingset and num_procs for Windows memory stats', () => {
    const vm = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { privateworkingset: 12_345_678 },
      num_procs: 8,
      cpu_stats: { cpu_usage: { total_usage: 1 }, system_cpu_usage: 2 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
    });

    expect(vm.isWindows).toBe(true);
    expect(vm.MemoryUsage).toBe(12_345_678);
    expect(vm.MemoryCache).toBe(0);
    expect(vm.NumProcs).toBe(8);
  });

  it('maps Podman memory usage when stats are absent', () => {
    const vm = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { usage: 999 },
      cpu_stats: { cpu_usage: { total_usage: 1 }, system_cpu_usage: 2 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
    });

    expect(vm.isWindows).toBe(false);
    expect(vm.MemoryUsage).toBe(999);
    expect(vm.MemoryCache).toBe(0);
  });

  it('returns zero memory when Linux usage or stats are missing', () => {
    const vm = new ContainerStatsViewModel({
      read: '',
      preread: '',
      memory_stats: { stats: { cache: 10 } },
      cpu_stats: {},
      precpu_stats: {},
    });

    expect(vm.MemoryUsage).toBe(0);
    expect(vm.MemoryCache).toBe(0);
    expect(vm.PreviousCPUTotalUsage).toBe(0);
    expect(vm.CurrentCPUTotalUsage).toBe(0);
  });

  it('subtracts cgroups v1 cache from Linux memory usage', () => {
    const vm = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: {
        usage: 1000,
        stats: { cache: 250 },
      },
      cpu_stats: { cpu_usage: { total_usage: 1 }, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
      networks: {
        eth0: { rx_bytes: 10, tx_bytes: 20 },
        eth1: { rx_bytes: 1, tx_bytes: 2 },
      },
    });

    expect(vm.MemoryCache).toBe(250);
    expect(vm.MemoryUsage).toBe(750);
    expect(vm.Networks).toHaveLength(2);
  });

  it('reads cgroups v1 and v2 block IO ops into BytesRead and BytesWrite', () => {
    const v1 = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { usage: 1, stats: {} },
      cpu_stats: { cpu_usage: { total_usage: 1 } },
      precpu_stats: { cpu_usage: { total_usage: 0 } },
      blkio_stats: {
        io_service_bytes_recursive: [
          { major: 8, minor: 0, op: 'Read', value: 111 },
          { major: 8, minor: 0, op: 'Write', value: 222 },
        ],
      },
    });
    expect(v1.BytesRead).toBe(111);
    expect(v1.BytesWrite).toBe(222);
    expect(v1.noIOdata).toBe(false);

    const v2 = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { usage: 1, stats: {} },
      cpu_stats: { cpu_usage: { total_usage: 1 } },
      precpu_stats: { cpu_usage: { total_usage: 0 } },
      blkio_stats: {
        io_service_bytes_recursive: [
          { major: 8, minor: 0, op: 'read', value: 333 },
          { major: 8, minor: 0, op: 'write', value: 444 },
        ],
      },
    });
    expect(v2.BytesRead).toBe(333);
    expect(v2.BytesWrite).toBe(444);
  });

  it('marks noIOdata when blkio_stats is missing or recursive list is null', () => {
    const missing = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { usage: 1, stats: {} },
      cpu_stats: { cpu_usage: { total_usage: 1 } },
      precpu_stats: { cpu_usage: { total_usage: 0 } },
    });
    expect(missing.noIOdata).toBe(true);

    const nullList = new ContainerStatsViewModel({
      read: 't1',
      preread: 't0',
      memory_stats: { usage: 1, stats: {} },
      cpu_stats: { cpu_usage: { total_usage: 1 } },
      precpu_stats: { cpu_usage: { total_usage: 0 } },
      blkio_stats: { io_service_bytes_recursive: null as never },
    });
    expect(nullList.noIOdata).toBe(true);
    expect(nullList.BytesRead).toBe(0);
    expect(nullList.BytesWrite).toBe(0);
  });
});
