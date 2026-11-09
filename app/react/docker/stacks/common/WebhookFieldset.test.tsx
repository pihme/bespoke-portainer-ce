import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';

import { AuthorizedWebhook, WebhookFieldset } from './WebhookFieldset';

vi.mock('@/portainer/helpers/webhookHelper', () => ({
  baseStackWebhookUrl: () => 'https://portainer.example/api/webhooks',
}));

// Avoid BE feature gating side-effects on the switch in CE unit tests.
vi.mock('@/react/portainer/feature-flags/feature-flags.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/react/portainer/feature-flags/feature-flags.service')>();
  return {
    ...actual,
    isLimitedToBE: () => false,
  };
});

function renderAuthorized(props: {
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  webhookId?: string;
}) {
  const Wrapped = withTestRouter(
    withTestQueryProvider(
      withUserProvider(() => (
        <AuthorizedWebhook
          value={props.value}
          onChange={props.onChange ?? vi.fn()}
          disabled={props.disabled}
          webhookId={props.webhookId ?? 'hook-1'}
        />
      ))
    )
  );
  return render(<Wrapped />);
}

describe('AuthorizedWebhook', () => {
  it('renders the webhook switch and notifies on toggle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAuthorized({ value: false, onChange });

    expect(screen.getByText('Webhooks')).toBeVisible();
    expect(screen.getByText('Create a Stack webhook')).toBeVisible();

    await user.click(screen.getByTestId('stack-webhook-switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the webhook URL when value is true', () => {
    renderAuthorized({ value: true, webhookId: 'abc' });
    expect(screen.getByLabelText('webhook url')).toBeInTheDocument();
    expect(screen.getByTestId('copy-webhook-link-button')).toBeInTheDocument();
  });

  it('does not call onChange when the switch is disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAuthorized({ value: false, disabled: true, onChange });

    await user.click(screen.getByTestId('stack-webhook-switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('WebhookFieldset', () => {
  it('renders for an authorized admin user', () => {
    const Wrapped = withTestRouter(
      withTestQueryProvider(
        withUserProvider(() => (
          <WebhookFieldset
            value={false}
            onChange={() => {}}
            webhookId="hook-9"
          />
        ))
      )
    );
    render(<Wrapped />);
    expect(screen.getByText('Create a Stack webhook')).toBeVisible();
  });
});
