import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../ContainerActionsSection/SecondaryActions/useCanRecreateContainer', () => ({
  useCanRecreateContainer: vi.fn(() => false),
}));

vi.mock('@/react/hooks/useUser', () => ({
  useAuthorizations: vi.fn(() => ({ authorized: true })),
}));

vi.mock('@/react/portainer/webhooks/useWebhooks', () => ({
  useWebhooks: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/react/portainer/webhooks/useCreateWebhook', () => ({
  useCreateWebhook: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('@/react/portainer/webhooks/useDeleteWebhook', () => ({
  useDeleteWebhook: vi.fn(() => ({ mutate: vi.fn() })),
}));

import { WebhookRow } from './WebhookRow';

describe('WebhookRow', () => {
  it('returns null when container recreate webhook is not available', () => {
    const { container } = render(
      <WebhookRow
        containerId="abc"
        environmentId={1}
        autoRemove={false}
        partOfSwarmService={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
