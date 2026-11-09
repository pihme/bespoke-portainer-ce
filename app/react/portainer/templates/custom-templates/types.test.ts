import * as types from './types';
import { getDefaultEdgeTemplateSettings } from './types';

describe('REQ-TPL-03 custom template types', () => {
  it('REQ-TAI-002 exposes no Kubernetes template type constant', () => {
    expect('CustomTemplateKubernetesType' in types).toBe(false);
  });

  it('returns undefined edge settings on CE', () => {
    expect(getDefaultEdgeTemplateSettings()).toBeUndefined();
  });
});
