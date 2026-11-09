import { render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EnvironmentStatusBadgeItem } from './EnvironmentStatusBadgeItem';

describe('EnvironmentStatusBadgeItem', () => {
  it('renders children with a success icon', () => {
    render(
      <EnvironmentStatusBadgeItem color="success" icon={Check} aria-label="ok">
        Ready
      </EnvironmentStatusBadgeItem>
    );
    expect(screen.getByLabelText('ok')).toHaveTextContent('Ready');
  });

  it('renders a danger badge without an icon', () => {
    render(
      <EnvironmentStatusBadgeItem color="danger">Error</EnvironmentStatusBadgeItem>
    );
    expect(screen.getByText('Error')).toBeVisible();
  });
});
