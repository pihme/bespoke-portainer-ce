import { render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders children with the mapped success badge type', () => {
    render(
      <StatusBadge color="success" icon={Check}>
        Healthy
      </StatusBadge>
    );
    expect(screen.getByText('Healthy')).toBeVisible();
  });

  it('uses the default custom badge type when color is omitted', () => {
    render(<StatusBadge>Default</StatusBadge>);
    expect(screen.getByText('Default')).toBeVisible();
  });

  it('maps lite and muted colors', () => {
    const { rerender } = render(
      <StatusBadge color="warningLite">Warn</StatusBadge>
    );
    expect(screen.getByText('Warn')).toBeVisible();
    rerender(<StatusBadge color="mutedLite">Muted</StatusBadge>);
    expect(screen.getByText('Muted')).toBeVisible();
    rerender(<StatusBadge color="info">Info</StatusBadge>);
    expect(screen.getByText('Info')).toBeVisible();
  });
});
