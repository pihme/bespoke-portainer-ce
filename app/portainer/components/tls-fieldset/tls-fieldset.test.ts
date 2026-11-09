import { beforeEach, describe, expect, it, vi } from 'vitest';

const { angularMock, withFormValidation } = vi.hoisted(() => {
  const moduleApi = {
    name: 'portainer.app.components.tls-fieldset',
    component: vi.fn().mockReturnThis(),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  const withFormValidation = vi.fn();
  return { angularMock, withFormValidation, moduleApi };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react-tools/withFormValidation', () => ({
  withFormValidation,
}));

vi.mock('@/react/components/TLSFieldset', () => ({
  TLSFieldset: vi.fn(),
  tlsConfigValidation: vi.fn(),
}));

describe('tls-fieldset angular module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers the React TLSFieldset with form validation', async () => {
    const mod = await import('./index');

    expect(angularMock.module).toHaveBeenCalledWith(
      'portainer.app.components.tls-fieldset',
      []
    );
    expect(withFormValidation).toHaveBeenCalled();
    const [, component, name, props, schema] = vi.mocked(withFormValidation).mock
      .calls[0];
    expect(name).toBe('tlsFieldset');
    expect(props).toEqual([]);
    expect(component).toBeTruthy();
    expect(schema).toBeTruthy();
    expect(mod.tlsFieldsetModule).toBe(
      'portainer.app.components.tls-fieldset'
    );
  });
});
