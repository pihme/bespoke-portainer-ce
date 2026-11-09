import * as types from './types';

describe('REQ-TPL-03 custom template types', () => {
  it('REQ-TAI-002 exposes no Kubernetes template type constant', () => {
    expect('CustomTemplateKubernetesType' in types).toBe(false);
  });

  it('REQ-TAI-004 exposes no Edge template settings helpers', () => {
    expect('getDefaultEdgeTemplateSettings' in types).toBe(false);
  });
});
