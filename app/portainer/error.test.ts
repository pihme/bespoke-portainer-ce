import PortainerError, { isPortainerError } from './error';

describe('PortainerError', () => {
  it('sets message and optional nested err, and marks isPortainerError', () => {
    const nested = new Error('nested');
    const err = new PortainerError('boom', nested);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PortainerError);
    expect(err.message).toBe('boom');
    expect(err.err).toBe(nested);
    expect(err.isPortainerError).toBe(true);
  });

  it('allows constructing without a nested err', () => {
    const err = new PortainerError('alone');

    expect(err.message).toBe('alone');
    expect(err.err).toBeUndefined();
    expect(err.isPortainerError).toBe(true);
  });
});

describe('isPortainerError', () => {
  it('returns true for PortainerError instances', () => {
    expect(isPortainerError(new PortainerError('x'))).toBe(true);
  });

  it('returns true for duck-typed objects with isPortainerError true', () => {
    expect(isPortainerError({ isPortainerError: true, message: 'x' })).toBe(
      true
    );
  });

  it('returns false for null, undefined, primitives, plain Error, and false flag', () => {
    expect(isPortainerError(null)).toBe(false);
    expect(isPortainerError(undefined)).toBe(false);
    expect(isPortainerError('error')).toBe(false);
    expect(isPortainerError(42)).toBe(false);
    expect(isPortainerError(new Error('plain'))).toBe(false);
    expect(isPortainerError({ message: 'no flag' })).toBe(false);
    expect(isPortainerError({ isPortainerError: false })).toBe(false);
    // Observed: && chain returns the flag value when truthy checks pass.
    expect(isPortainerError({ isPortainerError: 0 })).toBeFalsy();
  });
});
