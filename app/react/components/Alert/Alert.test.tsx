import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { Alert, AlertContainer } from './Alert';

vi.mock('@@/Icon', () => ({
  Icon: ({ icon: IconComp }: { icon: React.ComponentType }) => (
    <span data-cy="icon">{IconComp ? 'icon' : 'none'}</span>
  ),
}));

describe('Alert', () => {
  it.each(['success', 'error', 'info', 'warn', 'default'] as const)(
    'renders %s color with title and body',
    (color) => {
      render(
        <Alert color={color} title={`${color}-title`}>
          {color}-body
        </Alert>
      );
      const role = color === 'error' || color === 'warn' ? 'alert' : 'status';
      expect(screen.getByRole(role)).toBeVisible();
      expect(screen.getByText(`${color}-title`)).toBeVisible();
      expect(screen.getByText(`${color}-body`)).toBeVisible();
    }
  );

  it('renders without title using body-only layout', () => {
    render(<Alert color="info">body-only</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('body-only');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('applies custom className on the container', () => {
    render(
      <Alert color="default" className="extra-class">
        x
      </Alert>
    );
    expect(screen.getByRole('status')).toHaveClass('extra-class');
  });
});

describe('AlertContainer', () => {
  it('renders children with optional role', () => {
    render(<AlertContainer role="alert">nested</AlertContainer>);
    expect(screen.getByRole('alert')).toHaveTextContent('nested');
  });
});
