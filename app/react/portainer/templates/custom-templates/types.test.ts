import {
  CustomTemplateKubernetesType,
  getDefaultEdgeTemplateSettings,
} from './types';
import { StackType } from '@/react/common/stacks/types';

describe('REQ-TPL-03 custom template types', () => {
  it('exposes the kubernetes stack type constant', () => {
    expect(CustomTemplateKubernetesType).toBe(StackType.Kubernetes);
  });

  it('returns undefined edge settings on CE', () => {
    expect(getDefaultEdgeTemplateSettings()).toBeUndefined();
  });
});
