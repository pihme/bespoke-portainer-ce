import { describe, expect, it, vi, beforeEach } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor =
        Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/portainer/environments/ItemView/tls-options', () => ({
  tlsOptions: [{ id: 'tls_only', value: 'tls_only' }],
}));

await import('./porEndpointSecurityController.js');

describe('porEndpointSecurityController TLS fields', () => {
  let $scope;

  beforeEach(() => {
    $scope = { $evalAsync: (fn) => fn() };
  });

  function createCtrl(endpoint) {
    const ctrl = {
      formData: {
        TLS: false,
        TLSMode: 'tls_client_ca',
        TLSCACert: null,
        TLSCert: null,
        TLSKey: null,
      },
      endpoint,
    };
    controllerState.ctor.call(ctrl, $scope);
    return ctrl;
  }

  it('exposes tls options and toggles TLS fields', () => {
    const ctrl = createCtrl();
    expect(ctrl.tlsOptions).toEqual([{ id: 'tls_only', value: 'tls_only' }]);
    ctrl.onToggleTLS(true);
    expect(ctrl.formData.TLS).toBe(true);
    ctrl.onChangeTLSMode('tls_ca');
    expect(ctrl.formData.TLSMode).toBe('tls_ca');
  });

  it('leaves form data alone when no endpoint is provided', () => {
    const ctrl = createCtrl(undefined);
    ctrl.$onInit();
    expect(ctrl.formData.TLS).toBe(false);
  });

  it('maps full client+CA TLS config from the endpoint', () => {
    const ctrl = createCtrl({
      TLSConfig: {
        TLS: true,
        TLSCACert: 'ca',
        TLSCert: 'cert',
        TLSKey: 'key',
      },
    });
    ctrl.$onInit();
    expect(ctrl.formData.TLS).toBe(true);
    expect(ctrl.formData.TLSMode).toBe('tls_client_ca');
  });

  it('maps client cert without CA', () => {
    const ctrl = createCtrl({
      TLSConfig: {
        TLS: true,
        TLSCACert: null,
        TLSCert: 'cert',
        TLSKey: 'key',
      },
    });
    ctrl.$onInit();
    expect(ctrl.formData.TLSMode).toBe('tls_client_noca');
  });

  it('maps CA-only TLS', () => {
    const ctrl = createCtrl({
      TLSConfig: {
        TLS: true,
        TLSCACert: 'ca',
        TLSCert: null,
        TLSKey: null,
      },
    });
    ctrl.$onInit();
    expect(ctrl.formData.TLSMode).toBe('tls_ca');
  });

  it('maps TLS-only mode when no cert files are present', () => {
    const ctrl = createCtrl({
      TLSConfig: {
        TLS: true,
        TLSCACert: null,
        TLSCert: null,
        TLSKey: null,
      },
    });
    ctrl.$onInit();
    expect(ctrl.formData.TLSMode).toBe('tls_only');
  });
});
