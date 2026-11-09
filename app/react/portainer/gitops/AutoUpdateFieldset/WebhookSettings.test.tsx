import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { WebhookSettings } from './WebhookSettings';

vi.mock('@/portainer/filters/filters', () => ({
  truncateLeftRight: (v: string) => `trunc:${v}`,
}));

vi.mock('@@/HelpLink', () => ({
  HelpLink: ({
    children,
    docLink,
  }: {
    children: React.ReactNode;
    docLink: string;
  }) => <a href={docLink}>{children}</a>,
}));

vi.mock('@@/buttons', () => ({
  CopyButton: ({
    children,
    copyText,
  }: {
    children: React.ReactNode;
    copyText: string;
  }) => <button type="button" data-copy={copyText}>{children}</button>,
}));

vi.mock('@@/form-components/FormControl', () => ({
  FormControl: ({
    label,
    tooltip,
    children,
  }: {
    label: string;
    tooltip?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <span>{label}</span>
      <div data-cy="tooltip">{tooltip}</div>
      {children}
    </div>
  ),
}));

describe('REQ-STK-09 WebhookSettings', () => {
  it('shows truncated webhook URL and copy target', () => {
    render(
      <WebhookSettings
        baseUrl="https://example.com/hooks"
        value="abc-123"
      />
    );
    expect(screen.getByLabelText('webhook url')).toHaveTextContent(
      'trunc:https://example.com/hooks/abc-123'
    );
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveAttribute(
      'data-copy',
      'https://example.com/hooks/abc-123'
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders docs link tooltip when docsLink is set', () => {
    render(
      <WebhookSettings
        baseUrl="https://example.com/hooks"
        value="abc"
        docsLink="/docs/webhooks"
      />
    );
    expect(
      screen.getByRole('link', {
        name: 'Portainer documentation on webhook usage',
      })
    ).toHaveAttribute('href', '/docs/webhooks');
  });
});
