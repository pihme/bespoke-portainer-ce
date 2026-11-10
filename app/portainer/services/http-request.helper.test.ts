import {
  registryAuthenticationHeader,
  setRegistryAuthenticationHeader,
  resetAgentHeaders,
} from './http-request.helper';
import * as helper from './http-request.helper';

afterEach(() => {
  resetAgentHeaders();
});

test('registryAuthenticationHeader', () => {
  const header = 'header';

  expect(registryAuthenticationHeader()).toBeUndefined();

  setRegistryAuthenticationHeader(header);

  expect(registryAuthenticationHeader()).toBe(header);

  resetAgentHeaders();

  expect(registryAuthenticationHeader()).toBeUndefined();
});

// REQ-TAI-007: the Portainer Agent and per-node targeting are removed, so the
// helper no longer queues an X-PortainerAgent-Target or manager-operation header.
test('REQ-TAI-007 exposes no agent target or manager operation header', () => {
  const exported = Object.keys(helper);
  expect(exported).not.toContain('portainerAgentTargetHeader');
  expect(exported).not.toContain('setPortainerAgentTargetHeader');
  expect(exported).not.toContain('setPortainerAgentManagerOperation');
  expect(exported).not.toContain('portainerAgentManagerOperation');

  const angularHelper = helper.HttpRequestHelperAngular();
  expect(Object.keys(angularHelper).sort()).toEqual([
    'registryAuthenticationHeader',
    'resetAgentHeaders',
    'setRegistryAuthenticationHeader',
  ]);
});
