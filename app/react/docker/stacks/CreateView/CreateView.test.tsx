import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { CreateView } from './CreateView';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 42,
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@@/Widget', () => {
  function Widget({ children }: { children: React.ReactNode }) {
    return <div data-cy="widget">{children}</div>;
  }
  Widget.Body = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Widget };
});

vi.mock('./CreateStackForm/CreateStackForm', () => ({
  CreateStackForm: (props: Record<string, unknown>) => (
    <div data-cy="create-stack-form">
      {Object.entries(props)
        .map(([key, value]) => `${key}:${String(value)}`)
        .join(';')}
    </div>
  ),
}));

describe('CreateView parent chrome', () => {
  it('renders the compose create form for the current environment', () => {
    render(<CreateView />);
    expect(screen.getByText('Create stack')).toBeVisible();
    expect(screen.getByTestId('create-stack-form')).toHaveTextContent(
      'environmentId:42'
    );
  });

  it('REQ-TAI-003 passes no Docker Swarm settings to the create form', () => {
    render(<CreateView />);
    expect(screen.getByTestId('create-stack-form')).toHaveTextContent(
      /^environmentId:42$/
    );
  });
});
