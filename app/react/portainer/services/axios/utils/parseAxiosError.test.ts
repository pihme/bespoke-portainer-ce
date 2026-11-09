import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import PortainerError from '@/portainer/error';

import { isAxiosError } from './isAxiosError';
import { parseAxiosError } from './parseAxiosError';
import { createMockAxiosError } from './test-utils';

describe('isAxiosError', () => {
  it('returns true for AxiosError instances and false otherwise', () => {
    expect(isAxiosError(createMockAxiosError({ message: 'x' }, 400))).toBe(
      true
    );
    expect(isAxiosError(new Error('plain'))).toBe(false);
    expect(isAxiosError(null)).toBe(false);
  });
});

describe('parseAxiosError', () => {
  it('returns an existing PortainerError unchanged', () => {
    const existing = new PortainerError('already wrapped');
    expect(parseAxiosError(existing)).toBe(existing);
  });

  it('wraps a non-Axios error with the provided message', () => {
    const err = new Error('boom');
    const result = parseAxiosError(err, 'failed to load');
    expect(result).toBeInstanceOf(PortainerError);
    expect(result.message).toBe('failed to load');
    expect(result.err).toBe(err);
  });

  it('combines caller message with Axios details when both are present', () => {
    const axiosError = createMockAxiosError({
      message: 'Not found',
      details: 'stack missing',
    });
    const result = parseAxiosError(axiosError, 'Unable to fetch stack');
    expect(result).toBeInstanceOf(PortainerError);
    expect(result.message).toBe('Unable to fetch stack: stack missing');
    expect(result.err).toBeInstanceOf(Error);
    expect((result.err as Error).message).toBe('Not found');
  });

  it('uses Axios details alone when no caller message is provided', () => {
    const axiosError = createMockAxiosError({
      message: 'Unauthorized',
      details: 'bad token',
    });
    const result = parseAxiosError(axiosError);
    expect(result.message).toBe('bad token');
  });

  it('uses caller message when Axios details are empty', () => {
    const axiosError = createMockAxiosError({ message: '' });
    const result = parseAxiosError(axiosError, 'operation failed');
    // details falls back to message ('') so msg && details is falsy → msg || details
    expect(result.message).toBe('operation failed');
  });

  it('accepts a custom parseError function', () => {
    const axiosError = createMockAxiosError({ message: 'ignored' });
    const parseError = vi.fn(() => ({
      error: new Error('custom'),
      details: 'custom details',
    }));
    const result = parseAxiosError(axiosError, 'prefix', parseError);
    expect(parseError).toHaveBeenCalledWith(axiosError);
    expect(result.message).toBe('prefix: custom details');
    expect((result.err as Error).message).toBe('custom');
  });

  it('falls back when the Axios response has neither statusText nor status', () => {
    const config = {
      url: '',
      method: 'get',
      headers: {},
    } as never;
    const axiosError = {
      name: 'AxiosError',
      message: '',
      config,
      isAxiosError: true,
      toJSON: () => ({}),
      response: {
        data: undefined,
        status: 0,
        statusText: '',
        headers: {},
        config,
      },
    } as AxiosError;

    const result = parseAxiosError(axiosError, 'request failed');
    expect(result).toBeInstanceOf(PortainerError);
    expect(result.message).toBe(
      'request failed: Server returned an error response'
    );
  });
});
