import { User } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { DashboardItem } from './DashboardItem';
import { DashboardGrid } from './DashboardGrid';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    to,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    to: string;
    'data-cy'?: string;
  }) => (
    <a href={`#${to}`} data-cy={dataCy}>
      {children}
    </a>
  ),
}));

vi.mock('@/react/components/Icon', () => ({
  Icon: () => <span data-cy="dash-icon" />,
}));

describe('DashboardItem', () => {
  it('should show provided resource value', () => {
    render(
      <DashboardItem value={1} icon={User} type="Container" data-cy="example" />
    );
    expect(screen.getByLabelText('value')).toHaveTextContent('1');
  });

  it('should show provided resource type', () => {
    render(
      <DashboardItem value={0} icon={User} type="Test" data-cy="example" />
    );
    expect(screen.getByLabelText('resourceType')).toHaveTextContent('Test');
  });

  it('should have accessibility label created from the provided resource type', () => {
    render(
      <DashboardItem
        value={0}
        icon={User}
        type="testLabel"
        data-cy="example"
      />
    );
    expect(screen.getByLabelText('testLabel')).toBeTruthy();
  });

  it('shows dash when value is undefined and loading/refetching labels', () => {
    render(
      <DashboardItem
        icon={User}
        type="Image"
        isLoading
        isRefetching
        data-cy="ex"
      />
    );
    expect(screen.getByLabelText('value')).toHaveTextContent('-');
    expect(screen.getByText('Loading total')).toBeInTheDocument();
    expect(screen.getByText('Refreshing total')).toBeInTheDocument();
  });

  it('uses pluralType when provided and wraps in a link', () => {
    render(
      <DashboardItem
        value={2}
        icon={User}
        type="box"
        pluralType="boxes"
        to="docker.containers"
        data-cy="item"
      >
        <span>child</span>
      </DashboardItem>
    );
    expect(screen.getByLabelText('resourceType')).toHaveTextContent('boxes');
    expect(screen.getByTestId('item-link')).toHaveAttribute(
      'href',
      '#docker.containers'
    );
    expect(screen.getByText('child')).toBeVisible();
  });
});

describe('DashboardGrid', () => {
  it('renders children in a grid container', () => {
    const { container } = render(
      <DashboardGrid>
        <div>a</div>
      </DashboardGrid>
    );
    expect(container.firstChild).toHaveClass('grid');
    expect(screen.getByText('a')).toBeVisible();
  });
});
