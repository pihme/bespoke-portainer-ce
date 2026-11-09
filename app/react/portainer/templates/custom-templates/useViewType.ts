import { useCurrentStateAndParams } from '@uirouter/react';

// Edge custom templates went with Edge computing (TAI-004).
export type TemplateViewType = 'docker';

export function useViewType(): TemplateViewType {
  const {
    state: { name = '' },
  } = useCurrentStateAndParams();
  if (name.includes('docker')) {
    return 'docker';
  }

  throw new Error(`Unknown view type: ${name}`);
}
