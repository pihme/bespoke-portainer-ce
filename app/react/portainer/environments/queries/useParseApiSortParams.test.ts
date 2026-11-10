import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it } from 'vitest';

import {
  EnvironmentStatus,
  EnvironmentType,
  PlatformType,
} from '@/react/portainer/environments/types';

import { useParseSortGroupApiParams } from './useParseApiSortParams';

describe('useParseSortGroupApiParams', () => {
  it('returns empty params when no filter is selected', () => {
    const { result } = renderHook(() =>
      useParseSortGroupApiParams(null, 'Health')
    );
    expect(result.current).toEqual({});
  });

  describe('Health sort', () => {
    it('maps Up to status=[Up]', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Up', 'Health')
      );
      expect(result.current).toEqual({ status: [EnvironmentStatus.Up] });
    });

    it('maps Down to status=[Down]', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Down', 'Health')
      );
      expect(result.current).toEqual({ status: [EnvironmentStatus.Down] });
    });

    it('maps Outdated to outdated=true (no status)', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Outdated', 'Health')
      );
      expect(result.current).toEqual({ outdated: true });
    });

    it('maps Heartbeat to edge types + status=[Up] so backend returns only edge envs with a valid heartbeat', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Heartbeat', 'Health')
      );
      expect(result.current).toEqual({
        types: [
          EnvironmentType.EdgeAgentOnDocker,
          EnvironmentType.EdgeAgentOnKubernetes,
        ],
        status: [EnvironmentStatus.Up],
      });
    });

    it('returns a fresh types array (not the shared EdgeTypes tuple) for each call', () => {
      const { result: first } = renderHook(() =>
        useParseSortGroupApiParams('Heartbeat', 'Health')
      );
      const { result: second } = renderHook(() =>
        useParseSortGroupApiParams('Heartbeat', 'Health')
      );
      expect(first.current.types).not.toBe(second.current.types);
      expect(first.current.types).toEqual(second.current.types);
    });
  });

  describe('REQ-TAI-013 Group sort', () => {
    it('ignores a group filter: environment groups are removed', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('2', 'Group')
      );
      expect(result.current).toEqual({});
    });
  });

  describe('Platform sort', () => {
    it('maps Docker to platformTypes=[Docker] and clears types', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Docker', 'PlatformType')
      );
      expect(result.current).toEqual({
        types: [],
        platformTypes: [PlatformType.Docker],
      });
    });

    it('returns empty platformTypes for unknown platforms', () => {
      const { result } = renderHook(() =>
        useParseSortGroupApiParams('Unknown', 'PlatformType')
      );
      expect(result.current).toEqual({
        types: [],
        platformTypes: [],
      });
    });
  });
});
