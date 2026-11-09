import { renderHook } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

import { dockerComposeSchema } from './docker-compose-schema';
import {
  getDockerComposeSchema,
  useDockerComposeSchema,
} from './useDockerComposeSchema';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const axiosGet = vi.mocked(axios.get);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe('dockerComposeSchema', () => {
  it('exports a compose specification object', () => {
    expect(dockerComposeSchema.$id).toBe('compose_spec.json');
    expect(dockerComposeSchema.type).toBe('object');
    expect(dockerComposeSchema.properties.services).toBeTruthy();
  });
});

describe('getDockerComposeSchema', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  it('returns the remote schema object', async () => {
    const remote = { $id: 'remote', type: 'object' };
    axiosGet.mockResolvedValue({ data: remote });

    await expect(getDockerComposeSchema()).resolves.toEqual(remote);
  });

  it('falls back to the local schema when the response is not an object', async () => {
    axiosGet.mockResolvedValue({ data: 'not-an-object' });

    await expect(getDockerComposeSchema()).resolves.toEqual(dockerComposeSchema);
  });

  it('falls back to the local schema when the request fails', async () => {
    axiosGet.mockRejectedValue(new Error('offline'));

    await expect(getDockerComposeSchema()).resolves.toEqual(dockerComposeSchema);
  });
});

describe('useDockerComposeSchema', () => {
  it('exposes the local schema as initial query data', () => {
    const { result } = renderHook(() => useDockerComposeSchema(), { wrapper });

    expect(result.current.data).toEqual(dockerComposeSchema);
    expect(result.current.isSuccess).toBe(true);
  });
});
