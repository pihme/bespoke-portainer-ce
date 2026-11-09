import { useCurrentStateAndParams } from '@uirouter/react';

export type TemplateViewType = 'docker' | 'edge';

export function useViewType(): TemplateViewType {
  const {
    state: { name = '' },
  } = useCurrentStateAndParams();
  if (name.includes('docker')) {
    return 'docker';
  }

  if (name.includes('edge')) {
    return 'edge';
  }

  throw new Error(`Unknown view type: ${name}`);
}
